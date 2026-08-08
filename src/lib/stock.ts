import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Stock reservation on D1.
 *
 * D1 HAS NO INTERACTIVE TRANSACTIONS. You cannot BEGIN, do work across awaits,
 * and COMMIT or ROLLBACK. Payload's `beginTransaction()` is a no-op on this
 * adapter. Everything below exists to get correctness without one.
 *
 * The load-bearing property is that a SINGLE UPDATE statement is atomic in
 * SQLite. So the stock check and the decrement happen in one statement, with
 * the check in the WHERE clause:
 *
 *   UPDATE products SET stock = stock - ?1 WHERE id = ?2 AND stock >= ?1
 *
 * Two concurrent orders for the last unit: one matches a row and succeeds, the
 * other matches zero rows and fails. No lock, no retry, no lost update, and
 * overselling is impossible by construction.
 *
 * What is NOT free is multi-item atomicity. Reserving three products means
 * three statements, and the third can fail after the first two succeeded. That
 * is handled by compensation — releasing what was taken — which makes this a
 * saga rather than a transaction. It is eventually consistent, and that is
 * acceptable precisely because the compensating direction only ever RETURNS
 * stock. The system can briefly under-sell; it can never oversell.
 */

export type StockRequest = { productId: number; quantity: number }

export type MovementReason = 'sale' | 'cancellation' | 'return'

/**
 * Writes ledger rows for movements made here.
 *
 * These paths use raw D1 rather than Payload, so no collection hook fires and
 * the ledger would otherwise miss exactly the movements that matter most —
 * every sale. Written with the same binding, in the same request, immediately
 * after the balance moves.
 *
 * `balance_after` is recorded from the UPDATE's RETURNING value, so the ledger
 * reflects what the balance actually became rather than what we assumed.
 */
async function recordMovements(
  db: D1Database,
  rows: { productId: number; delta: number; balanceAfter: number | null }[],
  reason: MovementReason,
  reference?: string,
): Promise<number[]> {
  if (rows.length === 0) return []

  const now = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  const ids: number[] = []

  try {
    for (const row of rows) {
      const inserted = await db
        .prepare(
          `INSERT INTO stock_movements
             (product_id, delta, reason, balance_after, reference, recorded_by, updated_at, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'system', ${now}, ${now})
           RETURNING id`,
        )
        .bind(row.productId, row.delta, reason, row.balanceAfter, reference ?? null)
        .first<{ id: number }>()

      if (inserted?.id) ids.push(inserted.id)
    }
  } catch {
    // A missing ledger row is a reporting gap, not a correctness failure — the
    // balance already moved correctly. Never fail a customer's order over it.
  }

  return ids
}

/**
 * Attaches an order number to movements written before it existed.
 *
 * Stock is reserved BEFORE the order number is claimed, so that a checkout that
 * fails does not burn a sequence number and leave a visible gap in the order
 * book. The consequence is that sale movements are written without a reference,
 * and a ledger entry reading "-3, sale" with no order attached answers "how much
 * changed" but not "because of what" — which is most of the point of keeping it.
 *
 * Back-filling by id avoids the race a "most recent unreferenced sale" query
 * would have under concurrent checkouts.
 */
export async function attachReferenceToMovements(
  movementIds: number[],
  reference: string,
): Promise<void> {
  if (movementIds.length === 0) return

  try {
    const { env } = await getCloudflareContext({ async: true })
    await env.D1.batch(
      movementIds.map((id) =>
        env.D1.prepare(`UPDATE stock_movements SET reference = ?1 WHERE id = ?2`).bind(reference, id),
      ),
    )
  } catch {
    // Reporting detail only; never worth failing a placed order.
  }
}

export type ReservationResult =
  | { ok: true; movementIds: number[] }
  | { ok: false; failedProductId: number; available: number }

/**
 * Atomically reserve stock for every item, or reserve none of it.
 *
 * On failure, every successful reservation made during this call is released
 * before returning.
 */
export async function reserveStock(
  items: StockRequest[],
  options: { reason?: MovementReason; reference?: string } = {},
): Promise<ReservationResult> {
  const { env } = await getCloudflareContext({ async: true })

  const reserved: StockRequest[] = []
  const ledger: { productId: number; delta: number; balanceAfter: number | null }[] = []

  for (const item of items) {
    const row = await env.D1.prepare(
      `UPDATE products
         SET stock = stock - ?1
       WHERE id = ?2
         AND stock >= ?1
       RETURNING stock`,
    )
      .bind(item.quantity, item.productId)
      .first<{ stock: number }>()

    const changed = row ? 1 : 0

    if (changed === 0) {
      // Insufficient stock. Undo everything reserved so far, then report which
      // product failed and how much is actually left so the customer gets a
      // specific message rather than "something went wrong".
      await releaseStock(reserved)

      const row = await env.D1.prepare(`SELECT stock FROM products WHERE id = ?1`)
        .bind(item.productId)
        .first<{ stock: number }>()

      return {
        ok: false,
        failedProductId: item.productId,
        available: row?.stock ?? 0,
      }
    }

    reserved.push(item)
    ledger.push({ productId: item.productId, delta: -item.quantity, balanceAfter: row?.stock ?? null })
  }

  const movementIds = await recordMovements(
    env.D1,
    ledger,
    options.reason ?? 'sale',
    options.reference,
  )

  return { ok: true, movementIds }
}

/**
 * Return reserved stock.
 *
 * Used to compensate a failed reservation, and to restore stock when an order
 * fails to write after its stock was already taken. Failures here are swallowed
 * on purpose: this runs on an error path, and throwing would replace a
 * recoverable inconsistency with an unhandled exception in front of a customer.
 * Under-counted stock is visible to an admin and fixable; a 500 at the moment
 * of purchase is not.
 */
export async function releaseStock(
  items: StockRequest[],
  options: { reason?: MovementReason; reference?: string } = {},
): Promise<void> {
  if (items.length === 0) return

  try {
    const { env } = await getCloudflareContext({ async: true })

    const ledger: { productId: number; delta: number; balanceAfter: number | null }[] = []

    for (const item of items) {
      const row = await env.D1.prepare(
        `UPDATE products SET stock = stock + ?1 WHERE id = ?2 RETURNING stock`,
      )
        .bind(item.quantity, item.productId)
        .first<{ stock: number }>()

      ledger.push({ productId: item.productId, delta: item.quantity, balanceAfter: row?.stock ?? null })
    }

    await recordMovements(env.D1, ledger, options.reason ?? 'cancellation', options.reference)
  } catch {
    // Intentionally swallowed — see above.
  }
}
