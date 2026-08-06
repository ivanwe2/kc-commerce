import type { Setting } from '@/payload-types'
import { roundMoney } from './money'

export type ShippingMethod =
  | 'econt_office'
  | 'econt_address'
  | 'speedy_office'
  | 'speedy_address'

/** Fallbacks used only if Settings has not been filled in yet. */
const DEFAULT_RATES: Record<ShippingMethod, number> = {
  econt_office: 3.5,
  econt_address: 5,
  speedy_office: 3.5,
  speedy_address: 5,
}

/**
 * Shipping cost for a method and order subtotal.
 *
 * Rates come from the Settings global so the shop owner can change them without
 * a deploy. This is called by the server action with values read from the
 * database — a shipping cost submitted by the client is never trusted, because
 * "shippingCost: 0" is the easiest possible tampering.
 */
export function calculateShippingCost({
  method,
  subtotal,
  settings,
}: {
  method: ShippingMethod
  subtotal: number
  settings: Pick<Setting, 'shippingRates'>
}): number {
  const rates = settings.shippingRates

  const threshold = rates?.freeShippingThreshold
  if (typeof threshold === 'number' && threshold > 0 && subtotal >= threshold) {
    return 0
  }

  const configured: Partial<Record<ShippingMethod, number | null | undefined>> = {
    econt_office: rates?.econtOffice,
    econt_address: rates?.econtAddress,
    speedy_office: rates?.speedyOffice,
    speedy_address: rates?.speedyAddress,
  }

  const rate = configured[method]
  return roundMoney(typeof rate === 'number' ? rate : DEFAULT_RATES[method])
}

/** Courier implied by the shipping method — stored on the order for fulfilment. */
export function courierFor(method: ShippingMethod): 'econt' | 'speedy' {
  return method.startsWith('econt') ? 'econt' : 'speedy'
}
