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

export type ReservationResult =
  | { ok: true }
  | { ok: false; failedProductId: number; available: number }

/**
 * Atomically reserve stock for every item, or reserve none of it.
 *
 * On failure, every successful reservation made during this call is released
 * before returning.
 */
export async function reserveStock(items: StockRequest[]): Promise<ReservationResult> {
  const { env } = await getCloudflareContext({ async: true })

  const reserved: StockRequest[] = []

  for (const item of items) {
    const result = await env.D1.prepare(
      `UPDATE products
         SET stock = stock - ?1
       WHERE id = ?2
         AND stock >= ?1`,
    )
      .bind(item.quantity, item.productId)
      .run()

    const changed = result.meta?.changes ?? 0

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
  }

  return { ok: true }
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
export async function releaseStock(items: StockRequest[]): Promise<void> {
  if (items.length === 0) return

  try {
    const { env } = await getCloudflareContext({ async: true })

    await env.D1.batch(
      items.map((item) =>
        env.D1.prepare(`UPDATE products SET stock = stock + ?1 WHERE id = ?2`).bind(
          item.quantity,
          item.productId,
        ),
      ),
    )
  } catch {
    // Intentionally swallowed — see above.
  }
}
