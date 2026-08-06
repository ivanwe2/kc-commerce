import type { CollectionAfterChangeHook } from 'payload'

import { sendOrderShipped } from '@/lib/email'

/**
 * Sends the shipping notification when an order moves to "shipped".
 *
 * afterChange, not beforeChange, deliberately: the email must only go out once
 * the status change has actually persisted. Sending from beforeChange would
 * tell a customer their parcel is on its way and then fail to save the status,
 * leaving the order looking unshipped with no way to know the mail went.
 *
 * The status machine in Orders.ts already guarantees a tracking number and
 * courier exist before "shipped" is reachable, so this hook does not re-check
 * them — it would be duplicating a rule that has exactly one owner.
 */
export const sendShippingNotification: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'update') return doc
  if (doc.status !== 'shipped' || previousDoc?.status === 'shipped') return doc

  const email = doc.customer?.email
  const trackingNumber = doc.trackingNumber

  if (!email || !trackingNumber) return doc

  try {
    await sendOrderShipped({
      orderNumber: doc.orderNumber,
      email,
      firstName: doc.customer?.firstName ?? '',
      // Email in the language the order was placed in, not the admin's UI locale.
      locale: doc.locale ?? 'bg',
      trackingNumber,
      courier: doc.courierService === 'speedy' ? 'Speedy' : 'Econt',
      total: doc.total ?? 0,
    })

    req.payload.logger.info(
      { orderNumber: doc.orderNumber },
      'Shipping notification sent',
    )
  } catch (error) {
    // Never throw: an email failure must not roll back an admin's status update
    // or show them an error for something that did succeed.
    req.payload.logger.error(
      { err: error, orderNumber: doc.orderNumber },
      'Shipping notification failed to send',
    )
  }

  return doc
}
