import type { CollectionAfterChangeHook } from 'payload'

import { sendLowStockAlert } from '@/lib/email-withdrawal'

/**
 * Emails the shop when a product crosses below its low-stock threshold.
 *
 * Fires only on the CROSSING, not on every save while stock is low. A product
 * sitting at 3 units would otherwise send an alert on every unrelated edit, and
 * an alert that arrives constantly is an alert nobody reads.
 *
 * Stock reaching exactly 0 always alerts, because "out of stock" is a different
 * and more urgent fact than "getting low".
 */
export const alertOnLowStock: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'update' || !previousDoc) return doc

  const threshold = doc.lowStockThreshold ?? 10
  const before = previousDoc.stock ?? 0
  const after = doc.stock ?? 0

  if (after >= before) return doc // restocked, or unrelated edit

  const crossedThreshold = before > threshold && after <= threshold
  const wentOutOfStock = before > 0 && after === 0

  if (!crossedThreshold && !wentOutOfStock) return doc

  try {
    await sendLowStockAlert({
      title: typeof doc.title === 'string' ? doc.title : doc.sku,
      sku: doc.sku,
      stock: after,
      threshold,
      outOfStock: after === 0,
    })
  } catch (error) {
    // Never throw: an alert failing must not roll back the stock decrement that
    // triggered it, which would leave the catalogue overstated after a sale.
    req.payload.logger.error({ err: error, sku: doc.sku }, 'Low stock alert failed to send')
  }

  return doc
}
