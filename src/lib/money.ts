/**
 * Money handling.
 *
 * Prices are stored as decimal euros because that is what a shop owner types
 * into the admin panel, but ALL arithmetic runs in integer cents and is rounded
 * back at the boundary. Multiplying a float unit price by a quantity and summing
 * is how you end up with a €12.299999999999999 order total; doing it in cents
 * makes that impossible.
 *
 * Rule: never add or multiply a euro value directly. Convert, compute, convert back.
 */

/** Decimal euros → integer cents. */
export function toCents(euros: number): number {
  return Math.round(euros * 100)
}

/** Integer cents → decimal euros, rounded to 2dp. */
export function toEuros(cents: number): number {
  return Math.round(cents) / 100
}

/** Round a euro amount to a valid 2dp currency value. */
export function roundMoney(euros: number): number {
  return toEuros(toCents(euros))
}

/** Multiply a unit price by a quantity without float drift. */
export function multiplyMoney(unitPrice: number, quantity: number): number {
  return toEuros(toCents(unitPrice) * quantity)
}

/** Sum euro amounts without float drift. */
export function sumMoney(amounts: number[]): number {
  return toEuros(amounts.reduce((total, amount) => total + toCents(amount), 0))
}

/**
 * Format for display in the given locale.
 *
 * Bulgaria adopted the euro on 2026-01-01. If the stakeholder confirms that dual
 * BGN display is still required for the transition period, that belongs here and
 * nowhere else — which is the reason formatting is centralised rather than
 * inlined at each call site.
 */
export function formatPrice(euros: number, locale: string = 'bg'): string {
  return new Intl.NumberFormat(locale === 'bg' ? 'bg-BG' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros)
}
