import type { Order } from '@/payload-types'

/**
 * Courier integration boundary.
 *
 * THIS IS AN INTERFACE, NOT AN IMPLEMENTATION — and the distinction is stated
 * plainly rather than hidden behind a function that looks like it works.
 *
 * Econt and Speedy both require a commercial contract and per-merchant API
 * credentials before their APIs return anything at all. Neither can be
 * implemented, and more importantly neither can be TESTED, without those
 * credentials. Shipping code that has never once talked to the real service is
 * not an integration; it is a guess that will be discovered to be wrong on the
 * day it first handles a real parcel.
 *
 * So this file defines the shape the rest of the app codes against, and the
 * manual fallbacks that are genuinely in use today:
 *
 *   - office selection: the customer types an office name at checkout
 *   - label generation: the shop creates labels in the courier's own portal
 *   - tracking: the admin pastes the tracking number, and the storefront deep
 *     links to the courier's public tracking page
 *
 * Everything above works, today, with no contract. When the contracts exist,
 * implement `EcontClient` and `SpeedyClient` against this interface and the
 * call sites do not change.
 */

export type CourierOffice = {
  code: string
  name: string
  city: string
  address: string
}

export type ShipmentLabel = {
  trackingNumber: string
  labelUrl: string
}

export interface CourierClient {
  readonly name: 'econt' | 'speedy'

  /** Offices available for pickup, for a searchable selector at checkout. */
  listOffices(city?: string): Promise<CourierOffice[]>

  /** Register a shipment and return its tracking number and printable label. */
  createShipment(order: Order): Promise<ShipmentLabel>

  /** Current status, for syncing an order without manual entry. */
  getTrackingStatus(trackingNumber: string): Promise<string>
}

/** Public tracking URLs. These need no credentials and are live now. */
export const TRACKING_URLS: Record<'econt' | 'speedy', (trackingNumber: string) => string> = {
  econt: (n) => `https://www.econt.com/services/track-shipment/${encodeURIComponent(n)}`,
  speedy: (n) => `https://www.speedy.bg/en/track-shipment?shipmentNumber=${encodeURIComponent(n)}`,
}

/**
 * Resolves a courier client once credentials are configured.
 *
 * Returns null today, and every caller must handle null rather than assume a
 * client exists — which is what keeps the manual path working instead of
 * failing at the moment a parcel needs to ship.
 */
export function getCourierClient(_courier: 'econt' | 'speedy'): CourierClient | null {
  const econtConfigured = Boolean(process.env.ECONT_USERNAME && process.env.ECONT_PASSWORD)
  const speedyConfigured = Boolean(process.env.SPEEDY_USERNAME && process.env.SPEEDY_PASSWORD)

  if (!econtConfigured && !speedyConfigured) return null

  // Implement EcontClient / SpeedyClient here once the contracts are signed.
  return null
}
