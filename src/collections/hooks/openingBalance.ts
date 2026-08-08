import type { CollectionAfterChangeHook } from 'payload'

/**
 * Records the opening balance when a product is created with stock.
 *
 * Without this the ledger cannot reconcile. A product seeded or created with
 * 240 units has a balance of 240 and no movements explaining any of it, so the
 * sum of the ledger and the running balance disagree from the very first day —
 * and a ledger that does not add up teaches people to ignore it.
 *
 * Recorded as a stocktake, which is what an opening count actually is: this is
 * the quantity we counted when the product entered the system.
 */
export const recordOpeningBalance: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (operation !== 'create') return doc

  const stock = doc.stock ?? 0
  if (stock <= 0) return doc

  try {
    await req.payload.create({
      collection: 'stock-movements',
      overrideAccess: true,
      // The product already has this stock; the row records it rather than
      // adding it again.
      context: { stockAlreadyApplied: true },
      data: {
        product: doc.id,
        delta: stock,
        reason: 'stocktake',
        balanceAfter: stock,
        recordedBy: req.user?.email ?? 'system',
        note: 'Opening balance recorded when the product was created.',
      },
    })
  } catch (error) {
    req.payload.logger.error(
      { err: error, productId: doc.id },
      'Failed to record opening stock balance',
    )
  }

  return doc
}
