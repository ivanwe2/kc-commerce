import type { CollectionAfterChangeHook } from 'payload'

/**
 * Records a ledger entry when someone edits a product's stock directly.
 *
 * The intended workflow is to add a Stock Movement, and the field description
 * says so. But the number remains editable, because forcing a ledger entry for
 * every correction would make fixing a typo needlessly ceremonial — and a
 * read-only field that people work around by other means is worse than one that
 * records what they did.
 *
 * So direct edits are allowed and logged as `correction`, which keeps the
 * ledger complete: the running balance can always be reconciled against the sum
 * of its movements, whichever route a change took.
 */
export const auditManualStockEdit: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'update' || !previousDoc) return doc

  const before = previousDoc.stock ?? 0
  const after = doc.stock ?? 0
  const delta = after - before

  if (delta === 0) return doc

  // Movements applied by the ledger itself, or by the raw-SQL stock helpers,
  // are already recorded. Only a change made through the admin form is new.
  if (req.context?.stockAlreadyApplied || req.context?.skipApply) return doc

  try {
    await req.payload.create({
      collection: 'stock-movements',
      overrideAccess: true,
      // The balance has already moved — this row records it, it must not
      // re-apply it.
      context: { stockAlreadyApplied: true },
      data: {
        product: doc.id,
        delta,
        reason: 'correction',
        balanceAfter: after,
        recordedBy: req.user?.email ?? 'admin',
        note: 'Stock edited directly on the product.',
      },
    })
  } catch (error) {
    req.payload.logger.error(
      { err: error, productId: doc.id, delta },
      'Failed to record a manual stock edit in the ledger',
    )
  }

  return doc
}
