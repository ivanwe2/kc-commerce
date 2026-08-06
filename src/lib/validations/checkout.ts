import { z } from 'zod'

/**
 * Checkout validation.
 *
 * This exact schema runs on BOTH sides: in the browser for immediate feedback,
 * and again inside the server action, which is the one that counts. Client-side
 * validation is a convenience; it is not a control.
 */

/**
 * Bulgarian mobile and landline formats:
 *   +359 88 123 4567 / 00359..., or national 0888 123 456
 * Spaces, dashes and parentheses are tolerated and stripped before checking —
 * rejecting a correct number because someone typed a space loses an order.
 */
const BG_PHONE = /^(?:\+359|00359|0)(?:[1-9]\d{7,8})$/

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .refine((value) => BG_PHONE.test(value), { message: 'invalidPhone' })

const nameSchema = z
  .string()
  .trim()
  .min(2, { message: 'tooShort' })
  .max(50)
  // No digits in a human name. Catches paste errors and the laziest bots.
  .regex(/^[^\d]+$/, { message: 'fieldRequired' })

export const SHIPPING_METHODS = [
  'econt_office',
  'econt_address',
  'speedy_office',
  'speedy_address',
] as const

export const cartItemInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(10000),
})

export const checkoutSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: z.email({ message: 'invalidEmail' }),
    phone: phoneSchema,

    shippingMethod: z.enum(SHIPPING_METHODS),
    officeCode: z.string().trim().max(120).optional(),

    street: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().optional(),
    notes: z.string().trim().max(500).optional(),

    // Must be literally true. `z.boolean()` would accept false and record a
    // consent that was never given.
    acceptedTerms: z.literal(true, { message: 'fieldRequired' }),
    acceptedPrivacy: z.literal(true, { message: 'fieldRequired' }),
    acceptedWithdrawal: z.literal(true, { message: 'fieldRequired' }),
    marketingConsent: z.boolean().default(false),

    items: z.array(cartItemInputSchema).min(1).max(100),
    locale: z.enum(['bg', 'en']).default('bg'),
  })
  /**
   * Conditional requirements. Which fields matter depends on the shipping
   * method, so they cannot be expressed as plain field-level rules.
   */
  .superRefine((data, ctx) => {
    const toOffice = data.shippingMethod.endsWith('_office')

    if (toOffice) {
      if (!data.officeCode || data.officeCode.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['officeCode'], message: 'fieldRequired' })
      }
      return
    }

    if (!data.street || data.street.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['street'], message: 'fieldRequired' })
    }
    if (!data.city || data.city.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['city'], message: 'fieldRequired' })
    }
    // Bulgarian postal codes are exactly four digits.
    if (!data.postalCode || !/^\d{4}$/.test(data.postalCode)) {
      ctx.addIssue({ code: 'custom', path: ['postalCode'], message: 'invalidPostalCode' })
    }
  })

export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutData = z.output<typeof checkoutSchema>

/** Field-keyed errors for rendering beneath each input. */
export type CheckoutFieldErrors = Partial<Record<keyof CheckoutData | 'form', string>>

export function flattenCheckoutErrors(error: z.ZodError): CheckoutFieldErrors {
  const result: CheckoutFieldErrors = {}

  for (const issue of error.issues) {
    const key = (issue.path[0] as keyof CheckoutData | undefined) ?? 'form'
    // Keep the first message per field; a stack of messages under one input is
    // noise, not help.
    if (!result[key]) result[key] = issue.message
  }

  return result
}
