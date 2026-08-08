import { APIError } from 'payload'
import type { CollectionAfterChangeHook, CollectionBeforeValidateHook } from 'payload'

/**
 * Applies a ledger movement to the product's running balance.
 *
 * Runs only on create — movements are immutable, so there is no update path to
 * handle. The write uses a single guarded UPDATE for the same reason checkout
 * does: two admins receiving goods at once must not lose one of the deliveries
 * to a read-modify-write race.
 *
 * Negative movements are guarded against pushing stock below zero. A write-off
 * larger than the stock on hand is a data-entry error, and silently producing
 * negative inventory would corrupt every downstream calculation rather than
 * surfacing the mistake.
 */
export const applyStockMovement: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (operation !== 'create') return doc

  const productId = typeof doc.product === 'object' ? doc.product?.id : doc.product
  const delta = doc.delta

  if (typeof productId !== 'number' || typeof delta !== 'number' || delta === 0) return doc

  // Movements recorded BY the stock helpers (sale, cancellation) have already
  // moved the balance — applying it again here would double-count.
  if (req.context?.stockAlreadyApplied) return doc

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })

    /**
     * Each branch binds exactly the parameters its own statement uses.
     *
     * Binding a spare ?3 to the positive statement is not harmless — D1 rejects
     * the call, the update never runs, and because the failure is caught the
     * symptom is a ledger row whose balance silently never moved. Received
     * goods appeared to record and stock did not budge.
     */
    const row =
      delta > 0
        ? await env.D1.prepare(`UPDATE products SET stock = stock + ?1 WHERE id = ?2 RETURNING stock`)
            .bind(delta, productId)
            .first<{ stock: number }>()
        : // The guard applies only to removals: stock must not go negative.
          await env.D1.prepare(
            `UPDATE products SET stock = stock + ?1 WHERE id = ?2 AND stock >= ?3 RETURNING stock`,
          )
            .bind(delta, productId, Math.abs(delta))
            .first<{ stock: number }>()

    if (!row) {
      /**
       * The balance did not move, so this row must not survive.
       *
       * A ledger is only trustworthy if it reconciles: the sum of its movements
       * has to equal the running balance. Leaving an unapplied row breaks that
       * invariant permanently, and a ledger that does not add up is worse than
       * no ledger, because it invites people to trust a wrong number.
       *
       * Reaching here means a concurrent write consumed the stock between
       * validation and application — genuinely rare, and the honest response is
       * to remove the row rather than record a movement that never happened.
       */
      req.payload.logger.error(
        { productId, delta },
        'Stock movement not applied (insufficient stock at write time) — removing the ledger row',
      )

      await req.payload.delete({
        collection: 'stock-movements',
        id: doc.id,
        overrideAccess: true,
        context: { skipApply: true },
      })

      return doc
    }

    await req.payload.update({
      collection: 'stock-movements',
      id: doc.id,
      overrideAccess: true,
      context: { skipApply: true },
      data: { balanceAfter: row.stock },
    })
  } catch (error) {
    req.payload.logger.error({ err: error, productId, delta }, 'Failed to apply stock movement')
  }

  return doc
}

/**
 * Stamps who recorded the movement, rejects a no-op, and refuses a removal
 * larger than the stock on hand.
 *
 * The negative-stock check lives here as well as in the UPDATE guard, and the
 * duplication is deliberate. Validation gives the admin a sentence explaining
 * what went wrong; the guard in the UPDATE closes the race between checking and
 * writing. One produces a good error message, the other produces correctness,
 * and neither substitutes for the other.
 */
export const stampStockMovement: CollectionBeforeValidateHook = async ({ data, req, operation }) => {
  if (!data) return data

  // APIError rather than Error: a plain throw is masked as "Something went
  // wrong" by the REST layer, which tells the admin nothing about what to fix.
  if (data.delta === 0) {
    throw new APIError(
      'A stock movement of zero changes nothing. Use a positive or negative amount.',
      400,
    )
  }

  if (!data.recordedBy) {
    data.recordedBy = req.user?.email ?? 'system'
  }

  if (operation === 'create' && typeof data.delta === 'number' && data.delta < 0) {
    const productId = typeof data.product === 'object' ? data.product?.id : data.product

    if (typeof productId === 'number') {
      const product = await req.payload.findByID({
        collection: 'products',
        id: productId,
        depth: 0,
        overrideAccess: true,
      })

      const available = product.stock ?? 0
      if (available + data.delta < 0) {
        throw new APIError(
          `Cannot remove ${Math.abs(data.delta)} units — only ${available} in stock. ` +
            `Record a stocktake if the physical count differs.`,
          400,
        )
      }
    }
  }

  return data
}
