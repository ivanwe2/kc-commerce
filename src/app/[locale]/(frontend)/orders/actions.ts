'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'

import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * Public order lookup: order number plus the email it was placed with.
 *
 * The highest-value part of Phase 15, and it needs no account at all. Customers
 * check "where is my parcel" far more often than they would ever log in, and a
 * guest checkout with no way to check status generates support email.
 *
 * SECURITY: the order number alone is not sufficient. Numbers are sequential —
 * KC-2026-00001 tells you KC-2026-00002 exists — so knowing one would let
 * anyone walk the whole order book and read names, phone numbers and addresses.
 * Requiring the matching email turns a guessable identifier into a pair that
 * has to be known together.
 */

const lookupSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .regex(/^KC-\d{4}-\d{5}$/, { message: 'fieldRequired' }),
  email: z.email({ message: 'invalidEmail' }),
})

export type OrderStatusResult =
  | {
      success: true
      order: {
        orderNumber: string
        status: string
        createdAt: string
        total: number
        shippingMethod: string
        trackingNumber: string | null
        courierService: string | null
        items: { title: string; quantity: number; unitPrice: number; totalPrice: number }[]
      }
    }
  | { success: false; error: string }

export async function lookupOrder(input: unknown): Promise<OrderStatusResult> {
  const parsed = lookupSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'fieldRequired' }
  }

  // Rate limited because this endpoint compares a secret. Without it, the email
  // requirement above could be brute-forced against a known order number.
  const ip = await getClientIp()
  const limit = await checkRateLimit({ identifier: ip, action: 'order-lookup', limit: 20 })
  if (!limit.allowed) return { success: false, error: 'tooManyRequests' }

  const payload = await getPayload({ config })

  const orders = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: parsed.data.orderNumber } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const order = orders.docs[0]

  /**
   * One error message for "no such order" and "wrong email", deliberately.
   *
   * Distinguishing them would confirm whether an order number exists, which is
   * exactly the enumeration this design prevents.
   */
  const emailMatches =
    order && order.customer?.email?.toLowerCase() === parsed.data.email.toLowerCase()

  if (!order || !emailMatches) {
    return { success: false, error: 'orderNotFound' }
  }

  // Only fields a customer needs. Admin notes and the internal status history
  // are deliberately not returned.
  return {
    success: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status ?? 'pending',
      createdAt: order.createdAt,
      total: order.total ?? 0,
      shippingMethod: order.shippingMethod ?? '',
      trackingNumber: order.trackingNumber ?? null,
      courierService: order.courierService ?? null,
      items: (order.items ?? []).map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    },
  }
}
