import type { CollectionAfterChangeHook } from 'payload'

import { isSaleActive } from '@/lib/discount'
import { roundMoney } from '@/lib/money'

/**
 * Records the effective price whenever it changes.
 *
 * Runs on create and on any update that moves `basePrice`, `salePrice` or the
 * sale window. Writing on every save regardless would fill the table with
 * duplicates from unrelated edits (a typo fix in the description), and a table
 * full of identical prices makes the 30-day minimum no harder to compute but a
 * great deal harder to audit.
 *
 * Failures are logged, never thrown: losing one history row is recoverable,
 * whereas blocking an admin from saving a product because an audit write failed
 * is not a trade worth making.
 */
export const recordPriceHistory: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  const priceChanged =
    operation === 'create' ||
    doc.basePrice !== previousDoc?.basePrice ||
    doc.salePrice !== previousDoc?.salePrice ||
    doc.saleStartsAt !== previousDoc?.saleStartsAt ||
    doc.saleEndsAt !== previousDoc?.saleEndsAt

  if (!priceChanged) return doc

  // Record what a customer would actually be charged for one unit right now —
  // the sale price when a sale is live, otherwise the base price. Recording the
  // base price during a sale would let a later "reduction" be measured against
  // a price nobody was ever asked to pay.
  const effective = isSaleActive(doc) ? doc.salePrice : doc.basePrice

  try {
    await req.payload.create({
      collection: 'price-history',
      overrideAccess: true,
      data: {
        product: doc.id,
        price: roundMoney(typeof effective === 'number' ? effective : doc.basePrice),
        recordedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    req.payload.logger.error(
      { err: error, productId: doc.id },
      'Failed to record price history — the 30-day reference price for this product may be incomplete',
    )
  }

  return doc
}
