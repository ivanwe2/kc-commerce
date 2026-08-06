import { multiplyMoney, roundMoney } from './money'

export type PricingTier = {
  minQuantity: number
  maxQuantity?: number | null
  pricePerUnit: number
}

/**
 * Unit price for a quantity, given a product's bulk tiers.
 *
 * Shared deliberately between the cart (display) and the checkout server action
 * (authoritative). One implementation means the price a customer is shown and
 * the price they are charged cannot drift apart — but note that the cart's
 * result is never trusted: checkout recomputes from database values.
 */
export function calculateTierPrice(
  quantity: number,
  tiers: PricingTier[] | null | undefined,
  basePrice: number,
): number {
  if (!tiers || tiers.length === 0) return roundMoney(basePrice)

  // Descending by minQuantity: the first tier the quantity clears is the best
  // one it qualifies for, which also makes an open-ended top tier fall out
  // naturally rather than needing a special case.
  const applicable = [...tiers]
    .sort((a, b) => b.minQuantity - a.minQuantity)
    .find((tier) => {
      if (quantity < tier.minQuantity) return false
      if (tier.maxQuantity != null && quantity > tier.maxQuantity) return false
      return true
    })

  return roundMoney(applicable ? applicable.pricePerUnit : basePrice)
}

/** Line total for a quantity at the correct tier. */
export function calculateLineTotal(
  quantity: number,
  tiers: PricingTier[] | null | undefined,
  basePrice: number,
): number {
  return multiplyMoney(calculateTierPrice(quantity, tiers, basePrice), quantity)
}

/** Lowest advertisable unit price — drives "from €X" on product cards. */
export function lowestPrice(
  tiers: PricingTier[] | null | undefined,
  basePrice: number,
): number {
  if (!tiers || tiers.length === 0) return roundMoney(basePrice)
  return roundMoney(Math.min(basePrice, ...tiers.map((tier) => tier.pricePerUnit)))
}

/**
 * The next tier a customer could reach, for "add N more to save" prompts.
 * Returns null when they are already on the best tier.
 */
export function nextTierHint(
  quantity: number,
  tiers: PricingTier[] | null | undefined,
  basePrice: number,
): { unitsNeeded: number; newUnitPrice: number } | null {
  if (!tiers || tiers.length === 0) return null

  const currentPrice = calculateTierPrice(quantity, tiers, basePrice)

  const upcoming = tiers
    .filter((tier) => tier.minQuantity > quantity && tier.pricePerUnit < currentPrice)
    .sort((a, b) => a.minQuantity - b.minQuantity)[0]

  if (!upcoming) return null

  return {
    unitsNeeded: upcoming.minQuantity - quantity,
    newUnitPrice: roundMoney(upcoming.pricePerUnit),
  }
}

/**
 * Validates a tier set. Returns an error message, or null when valid.
 *
 * Overlapping tiers are not a cosmetic problem: two tiers matching the same
 * quantity means the price depends on array order, so the same basket can be
 * priced differently after an unrelated admin edit.
 */
export function validatePricingTiers(
  tiers: PricingTier[] | null | undefined,
  minOrderQuantity: number,
): string | null {
  if (!tiers || tiers.length === 0) return null

  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)

  const first = sorted[0]
  if (first && first.minQuantity < minOrderQuantity) {
    return `The first tier starts at ${first.minQuantity}, below the minimum order quantity of ${minOrderQuantity}.`
  }

  for (let index = 0; index < sorted.length; index++) {
    const tier = sorted[index]
    if (!tier) continue

    if (!Number.isInteger(tier.minQuantity) || tier.minQuantity < 1) {
      return 'Each tier needs a whole minimum quantity of at least 1.'
    }
    if (tier.pricePerUnit < 0) {
      return 'Tier prices cannot be negative.'
    }
    if (tier.maxQuantity != null && tier.maxQuantity < tier.minQuantity) {
      return `Tier starting at ${tier.minQuantity} ends at ${tier.maxQuantity}, before it begins.`
    }

    const next = sorted[index + 1]
    if (!next) continue

    if (tier.maxQuantity == null) {
      return `The tier starting at ${tier.minQuantity} is open-ended, so no tier can follow it. Give it a maximum quantity, or make it the last tier.`
    }
    if (next.minQuantity <= tier.maxQuantity) {
      return `Tiers overlap: the tier starting at ${next.minQuantity} begins before the previous tier ends at ${tier.maxQuantity}.`
    }
  }

  return null
}
