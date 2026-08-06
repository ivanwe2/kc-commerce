'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { formatOrderNumber, nextCounterValue, orderCounterKey } from '@/lib/counters'
import { sendOrderConfirmation } from '@/lib/email'
import { multiplyMoney, roundMoney, sumMoney } from '@/lib/money'
import { calculateTierPrice, type PricingTier } from '@/lib/pricing'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { calculateShippingCost, courierFor, type ShippingMethod } from '@/lib/shipping'
import { releaseStock, reserveStock, type StockRequest } from '@/lib/stock'
import {
  checkoutSchema,
  flattenCheckoutErrors,
  type CheckoutFieldErrors,
} from '@/lib/validations/checkout'

/**
 * Order creation.
 *
 * The most security-sensitive code in this project. Two rules govern all of it:
 *
 *   1. NOTHING about money or stock is taken from the client. The request
 *      carries product ids and quantities; every price, every tier, every
 *      total and the shipping cost are recomputed here from the database.
 *   2. Stock is reserved BEFORE the order is written, using guarded atomic
 *      updates, and released again if anything downstream fails.
 *
 * The client cannot submit a price, a subtotal, a shipping cost or a total.
 * Those fields do not exist in the input schema at all — the strongest form of
 * "do not trust the client" is not giving it a field to lie in.
 */

export type CheckoutResult =
  | { success: true; orderNumber: string }
  | { success: false; errors: CheckoutFieldErrors }

export async function createOrder(input: unknown): Promise<CheckoutResult> {
  // --- 1. Validate ---------------------------------------------------------
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, errors: flattenCheckoutErrors(parsed.error) }
  }
  const data = parsed.data

  // --- 2. Rate limit -------------------------------------------------------
  const ip = await getClientIp()
  const rateLimit = await checkRateLimit({
    identifier: ip,
    action: 'order',
    limit: 5,
    windowSeconds: 3600,
  })

  if (!rateLimit.allowed) {
    return { success: false, errors: { form: 'tooManyRequests' } }
  }

  const payload = await getPayload({ config })

  // --- 3. Re-read every product from the database --------------------------
  const productIds = data.items.map((item) => item.productId)
  const products = await payload.find({
    collection: 'products',
    where: { and: [{ id: { in: productIds } }, { isActive: { equals: true } }] },
    limit: productIds.length,
    depth: 0,
    overrideAccess: true,
  })

  const productsById = new Map(products.docs.map((product) => [product.id, product]))

  type PricedLine = {
    productId: number
    title: string
    sku: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }

  const lines: PricedLine[] = []

  for (const item of data.items) {
    const product = productsById.get(item.productId)

    // Gone, or deactivated between adding to cart and checking out.
    if (!product) {
      return { success: false, errors: { form: 'productUnavailable' } }
    }

    if (item.quantity < (product.minOrderQuantity ?? 1)) {
      return { success: false, errors: { form: 'fieldRequired' } }
    }

    // Server-side price. The cart's number is never consulted.
    const unitPrice = calculateTierPrice(
      item.quantity,
      (product.pricingTiers ?? []) as PricingTier[],
      product.basePrice,
    )

    lines.push({
      productId: product.id,
      // Snapshots: the order must keep showing what was agreed even after the
      // catalogue changes.
      title: product.title,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      totalPrice: multiplyMoney(unitPrice, item.quantity),
    })
  }

  // --- 4. Totals, computed here ------------------------------------------
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })
  const subtotal = sumMoney(lines.map((line) => line.totalPrice))
  const shippingCost = calculateShippingCost({
    method: data.shippingMethod as ShippingMethod,
    subtotal,
    settings,
  })
  const total = roundMoney(subtotal + shippingCost)

  // --- 5. Reserve stock ----------------------------------------------------
  // Before the order is written: reserving stock for an order that then fails
  // is recoverable, selling stock that does not exist is not.
  const stockRequests: StockRequest[] = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
  }))

  const reservation = await reserveStock(stockRequests)

  if (!reservation.ok) {
    const failed = productsById.get(reservation.failedProductId)
    return {
      success: false,
      errors: {
        form: reservation.available > 0 ? 'outOfStock' : 'productUnavailable',
        // Surfaced to the customer so they know which item to adjust.
        items: failed?.title ?? '',
      },
    }
  }

  // --- 6. Create the order -------------------------------------------------
  try {
    const year = new Date().getFullYear()
    // Claimed only after stock is secured, so a failed checkout does not burn a
    // sequence number and leave a visible gap in the order book.
    const sequence = await nextCounterValue(orderCounterKey(year))
    const orderNumber = formatOrderNumber(year, sequence)

    const isToOffice = data.shippingMethod.endsWith('_office')

    const order = await payload.create({
      collection: 'orders',
      // The collection denies public create; this action is the only writer.
      overrideAccess: true,
      data: {
        orderNumber,
        status: 'pending',
        customerName: `${data.firstName} ${data.lastName}`,
        customer: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          acceptedTerms: data.acceptedTerms,
          marketingConsent: data.marketingConsent,
        },
        shippingMethod: data.shippingMethod,
        officeCode: isToOffice ? data.officeCode : undefined,
        shippingAddress: isToOffice
          ? undefined
          : {
              street: data.street,
              city: data.city,
              postalCode: data.postalCode,
              country: 'Bulgaria',
              notes: data.notes,
            },
        items: lines.map((line) => ({
          product: line.productId,
          title: line.title,
          sku: line.sku,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
        })),
        subtotal,
        shippingCost,
        total,
        courierService: courierFor(data.shippingMethod as ShippingMethod),
        locale: data.locale,
      },
    })

    // --- 7. Email, best effort --------------------------------------------
    // A failed email must never fail a placed order. The order exists, the
    // stock is reserved, and the customer is owed a confirmation page.
    try {
      await sendOrderConfirmation({
        orderNumber,
        email: data.email,
        firstName: data.firstName,
        locale: data.locale,
        lines,
        subtotal,
        shippingCost,
        total,
      })
    } catch (error) {
      payload.logger.error(
        { err: error, orderNumber },
        'Order confirmation email failed to send',
      )
    }

    payload.logger.info({ orderNumber, orderId: order.id, total }, 'Order created')

    return { success: true, orderNumber }
  } catch (error) {
    // The order did not persist, so give the stock back rather than leaving it
    // reserved against nothing.
    await releaseStock(stockRequests)

    payload.logger.error({ err: error }, 'Order creation failed after stock reservation')

    // Never leak internals to the client.
    return { success: false, errors: { form: 'orderFailed' } }
  }
}
