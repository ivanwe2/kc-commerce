import type { Payload } from 'payload'

import { roundMoney } from './money'
import type { Coupon } from '@/payload-types'

/**
 * Coupon validation and discount calculation.
 *
 * Always runs server-side against the database. A coupon that the client claims
 * is valid is worth exactly nothing — the checkout action re-resolves the code
 * itself, and the amount below is never taken from the request.
 */

export type CouponResult =
  | { valid: true; coupon: Coupon; discount: number; freeShipping: boolean }
  | { valid: false; reason: 'notFound' | 'expired' | 'notStarted' | 'minimumNotMet' | 'exhausted' }

export async function validateCoupon(
  payload: Payload,
  code: string,
  subtotal: number,
  now: Date = new Date(),
): Promise<CouponResult> {
  const normalised = code.trim().toUpperCase()
  if (!normalised) return { valid: false, reason: 'notFound' }

  const found = await payload.find({
    collection: 'coupons',
    where: { and: [{ code: { equals: normalised } }, { isActive: { equals: true } }] },
    limit: 1,
    depth: 0,
    // The collection is staff-only by design; this is the sanctioned read.
    overrideAccess: true,
  })

  const coupon = found.docs[0]
  if (!coupon) return { valid: false, reason: 'notFound' }

  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { valid: false, reason: 'notStarted' }
  }
  if (coupon.endsAt && new Date(coupon.endsAt) < now) {
    return { valid: false, reason: 'expired' }
  }
  if (typeof coupon.maxUses === 'number' && coupon.maxUses > 0) {
    if ((coupon.timesUsed ?? 0) >= coupon.maxUses) {
      return { valid: false, reason: 'exhausted' }
    }
  }
  if (typeof coupon.minimumSubtotal === 'number' && subtotal < coupon.minimumSubtotal) {
    return { valid: false, reason: 'minimumNotMet' }
  }

  if (coupon.discountType === 'free_shipping') {
    return { valid: true, coupon, discount: 0, freeShipping: true }
  }

  const value = coupon.discountValue ?? 0

  const discount =
    coupon.discountType === 'percent'
      ? roundMoney((subtotal * value) / 100)
      : roundMoney(value)

  return {
    valid: true,
    coupon,
    // Never let a discount exceed the subtotal: a €20 fixed coupon on a €5
    // order would otherwise produce a negative total, and a courier cannot
    // collect a negative amount on delivery.
    discount: Math.min(discount, subtotal),
    freeShipping: false,
  }
}

/**
 * Records a redemption.
 *
 * Read-modify-write is acceptable here in a way it was not for order numbers:
 * an over-redeemed coupon by one or two under heavy concurrency costs a small
 * discount, whereas a duplicate order number fails a customer's checkout. If
 * coupons ever back a genuinely limited promotion, move this to the same atomic
 * counter used by lib/counters.ts.
 */
export async function recordCouponUse(payload: Payload, couponId: number): Promise<void> {
  try {
    const coupon = await payload.findByID({
      collection: 'coupons',
      id: couponId,
      depth: 0,
      overrideAccess: true,
    })

    await payload.update({
      collection: 'coupons',
      id: couponId,
      overrideAccess: true,
      data: { timesUsed: (coupon.timesUsed ?? 0) + 1 },
    })
  } catch (error) {
    // The order already exists and the customer has been charged the discounted
    // amount. Failing here would be worse than an inaccurate usage count.
    payload.logger.error({ err: error, couponId }, 'Failed to record coupon use')
  }
}
