import type { Payload } from 'payload'

import { roundMoney } from './money'
import { calculateTierPrice, type PricingTier } from './pricing'

/**
 * Discount and sale pricing.
 *
 * Two things are going on here and they must not be confused:
 *
 *   - the EFFECTIVE PRICE, which is what the customer pays;
 *   - the REFERENCE PRICE, which is what must be shown struck through next to
 *     it, and which the law defines as the lowest price in the preceding 30
 *     days rather than whatever the current base price happens to be.
 *
 * Getting the second one wrong is a Consumer Protection Act problem, not a
 * cosmetic one. See src/collections/PriceHistory.ts.
 */

export type SaleableProduct = {
  id: number
  basePrice: number
  salePrice?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  pricingTiers?: PricingTier[] | null
}

/**
 * Is a sale live right now?
 *
 * A sale price that is not lower than the base price is not a sale, and
 * displaying it as one would be a false discount announcement. Empty dates mean
 * "no bound" in that direction, so a sale can be open-ended or scheduled.
 */
export function isSaleActive(product: SaleableProduct, now: Date = new Date()): boolean {
  const { salePrice, basePrice, saleStartsAt, saleEndsAt } = product

  if (typeof salePrice !== 'number' || salePrice <= 0) return false
  if (salePrice >= basePrice) return false

  if (saleStartsAt && new Date(saleStartsAt) > now) return false
  if (saleEndsAt && new Date(saleEndsAt) < now) return false

  return true
}

/**
 * Unit price the customer actually pays.
 *
 * A product can carry both a sale price and bulk tiers. Rather than declaring
 * one of them the winner, the customer gets whichever is lower — that is what
 * they will expect, and the alternative (a "sale" that makes a bulk order more
 * expensive) is indefensible at the till.
 */
export function effectiveUnitPrice(
  product: SaleableProduct,
  quantity: number,
  now: Date = new Date(),
): number {
  const tierPrice = calculateTierPrice(quantity, product.pricingTiers, product.basePrice)

  if (!isSaleActive(product, now)) return tierPrice

  return roundMoney(Math.min(tierPrice, product.salePrice!))
}

/** Single-unit display price, before quantity is chosen. */
export function displayPrice(product: SaleableProduct, now: Date = new Date()): number {
  return isSaleActive(product, now) ? roundMoney(product.salePrice!) : roundMoney(product.basePrice)
}

/**
 * The reference ("was") price to display struck through.
 *
 * Legally this is the LOWEST price in the 30 days before the reduction, which is
 * usually — but not always — the base price. If the product was already
 * discounted at some point in that window, that lower figure is the one that
 * must be shown.
 *
 * Where there is not yet 30 days of history, the Act falls back to the lowest
 * price from at least 7 days before the reduction began. With no history at all
 * we return the base price, which is the most conservative available answer:
 * it can only ever understate the discount, never overstate it.
 */
export async function referencePrice(
  payload: Payload,
  product: SaleableProduct,
  now: Date = new Date(),
): Promise<number> {
  /**
   * The window ends when the reduction BEGAN, not now.
   *
   * This is the subtle part, and getting it wrong makes the whole feature
   * useless: the moment a sale starts, the hook records the sale price in the
   * history. A naive "lowest price in the last 30 days" therefore returns the
   * sale price itself, the reference equals the effective price, and nothing
   * ever renders as discounted.
   *
   * The Act asks for the lowest price in the 30 days *preceding* the reduction,
   * so the window must close at the moment the sale started.
   */
  const saleBeganAt = await findSaleStart(payload, product, now)
  const windowEnd = saleBeganAt ?? now
  const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000)

  const history = await payload.find({
    collection: 'price-history',
    where: {
      and: [
        { product: { equals: product.id } },
        { recordedAt: { greater_than_equal: windowStart.toISOString() } },
        { recordedAt: { less_than: windowEnd.toISOString() } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const prices = history.docs
    .map((row) => (typeof row.price === 'number' ? row.price : null))
    .filter((price): price is number => price !== null)

  // No prior history — the base price is the most conservative answer available.
  // It can only understate a discount, never overstate one.
  if (prices.length === 0) return roundMoney(product.basePrice)

  return roundMoney(Math.min(...prices))
}

/**
 * When did the current reduction start?
 *
 * Uses the explicit `saleStartsAt` when the admin set one. Otherwise the sale
 * began when the sale price was first recorded, so we look for the earliest
 * consecutive history row carrying the current sale price.
 */
async function findSaleStart(
  payload: Payload,
  product: SaleableProduct,
  now: Date,
): Promise<Date | null> {
  if (!isSaleActive(product, now)) return null
  if (product.saleStartsAt) return new Date(product.saleStartsAt)

  const recent = await payload.find({
    collection: 'price-history',
    where: { product: { equals: product.id } },
    limit: 50,
    depth: 0,
    sort: '-recordedAt',
    overrideAccess: true,
  })

  let saleStart: Date | null = null

  // Walk backwards while the price is still the sale price; the last such row
  // is where this reduction began. Stopping at the first different price is
  // what prevents an earlier, unrelated sale from being counted as this one.
  for (const row of recent.docs) {
    if (typeof row.price !== 'number' || roundMoney(row.price) !== roundMoney(product.salePrice!)) {
      break
    }
    if (typeof row.recordedAt === 'string') saleStart = new Date(row.recordedAt)
  }

  return saleStart
}

/** Discount percentage against the reference price, for badges. */
export function discountPercent(reference: number, effective: number): number {
  if (reference <= 0 || effective >= reference) return 0
  return Math.round((1 - effective / reference) * 100)
}
