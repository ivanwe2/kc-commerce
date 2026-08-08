import type { CollectionAfterChangeHook } from 'payload'

import { releaseStock, reserveStock, type StockRequest } from '@/lib/stock'

/**
 * Returns stock to the catalogue when an order is cancelled or returned.
 *
 * Stock is decremented at checkout, which is correct — it is what prevents
 * overselling between placing an order and fulfilling it. But it means the
 * inverse has to happen too, and it did not: cancelling an order left its units
 * permanently deducted.
 *
 * That matters more here than it would elsewhere. This is a cash-on-delivery
 * shop, where a customer simply refusing the parcel is a routine outcome, not
 * an exception. Every refusal was silently shrinking the catalogue.
 *
 * Symmetry is enforced by `stockRestored`, a flag on the order rather than an
 * inference from status. Statuses can move more than once — cancelled today,
 * reopened tomorrow — and deciding from status alone would either double-credit
 * stock or skip it, depending on the path taken. The flag records what actually
 * happened to the inventory.
 */

const RELEASING_STATUSES = new Set(['cancelled', 'returned'])

export const restoreStockOnCancel: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'update' || !previousDoc) return doc

  const wasReleasing = RELEASING_STATUSES.has(previousDoc.status)
  const isReleasing = RELEASING_STATUSES.has(doc.status)
  const alreadyRestored = Boolean(doc.stockRestored)

  const items: StockRequest[] = (doc.items ?? [])
    .map((item: { product?: unknown; quantity?: number }) => ({
      productId: typeof item.product === 'object' ? (item.product as { id: number })?.id : item.product,
      quantity: item.quantity ?? 0,
    }))
    .filter(
      (item: StockRequest) =>
        typeof item.productId === 'number' && Number.isFinite(item.quantity) && item.quantity > 0,
    )

  if (items.length === 0) return doc

  // Entering a releasing status: give the units back.
  if (isReleasing && !wasReleasing && !alreadyRestored) {
    try {
      await releaseStock(items, {
        reason: doc.status === 'returned' ? 'return' : 'cancellation',
        reference: doc.orderNumber,
      })
      await req.payload.update({
        collection: 'orders',
        id: doc.id,
        overrideAccess: true,
        // Skip hooks: this write only records that the release happened, and
        // re-entering this hook would loop.
        context: { skipStockHooks: true },
        data: { stockRestored: true },
      })
      req.payload.logger.info(
        { orderNumber: doc.orderNumber, status: doc.status },
        'Stock restored after order cancellation',
      )
    } catch (error) {
      req.payload.logger.error(
        { err: error, orderNumber: doc.orderNumber },
        'Failed to restore stock after cancellation — inventory may be understated',
      )
    }
    return doc
  }

  /**
   * Leaving a releasing status: an order reinstated after cancellation must
   * take its stock back, or the same units could be sold twice.
   *
   * UNREACHABLE TODAY, and deliberately kept anyway. `cancelled` and `returned`
   * are terminal in ALLOWED_TRANSITIONS, so the state machine rejects any move
   * out of them before this hook runs — verified by testing exactly that.
   *
   * It stays because the alternative is worse: if someone later makes those
   * states non-terminal (a "reopen order" feature is an obvious request), the
   * missing half of this symmetry would silently oversell, and nothing would
   * fail loudly enough to notice. This branch means relaxing the state machine
   * is safe by default rather than by remembering.
   *
   * Uses reserveStock rather than a blind decrement, so if the goods have since
   * been sold to someone else the reinstatement is refused rather than pushing
   * stock negative. An admin then sees the order is not fulfillable, which is
   * the honest outcome.
   */
  if (!isReleasing && wasReleasing && alreadyRestored) {
    try {
      const result = await reserveStock(items, { reason: 'sale', reference: doc.orderNumber })

      if (!result.ok) {
        req.payload.logger.warn(
          { orderNumber: doc.orderNumber, productId: result.failedProductId },
          'Reinstated order could not re-reserve stock — insufficient inventory',
        )
        return doc
      }

      await req.payload.update({
        collection: 'orders',
        id: doc.id,
        overrideAccess: true,
        context: { skipStockHooks: true },
        data: { stockRestored: false },
      })
    } catch (error) {
      req.payload.logger.error(
        { err: error, orderNumber: doc.orderNumber },
        'Failed to re-reserve stock for reinstated order',
      )
    }
  }

  return doc
}
