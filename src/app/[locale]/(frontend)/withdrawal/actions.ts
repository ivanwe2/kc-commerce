'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'

import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * Electronic withdrawal function.
 *
 * MANDATORY under EU Directive 2023/2673 since 19 June 2026: consumers must be
 * able to withdraw through a clearly labelled online function, not only by
 * writing an email. This action is that function.
 *
 * Confirming receipt to the consumer is also required, which is why the
 * acknowledgement email goes to them as well as to the trader.
 */

const withdrawalSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .regex(/^KC-\d{4}-\d{5}$/, { message: 'fieldRequired' }),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.email({ message: 'invalidEmail' }),
  reason: z.string().trim().max(1000).optional(),
})

export type WithdrawalResult =
  | { success: true }
  | { success: false; error: string }

export async function submitWithdrawal(input: unknown): Promise<WithdrawalResult> {
  const parsed = withdrawalSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'fieldRequired' }
  }
  const data = parsed.data

  const ip = await getClientIp()
  const limit = await checkRateLimit({ identifier: ip, action: 'withdrawal', limit: 10 })
  if (!limit.allowed) return { success: false, error: 'tooManyRequests' }

  const payload = await getPayload({ config })

  const orders = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: data.orderNumber } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const order = orders.docs[0]

  /**
   * A mismatch is NOT reported as "no such order".
   *
   * Confirming whether an order number exists would let anyone enumerate the
   * order book, and pairing a number with an email would confirm who placed it.
   * The withdrawal is instead recorded for an admin to reconcile, and the
   * consumer is told their request was received either way — which is also what
   * the Directive requires, since a consumer must not be blocked from
   * withdrawing by a data-entry mistake.
   */
  const emailMatches =
    order && order.customer?.email?.toLowerCase() === data.email.toLowerCase()

  const note =
    `[WITHDRAWAL REQUEST ${new Date().toISOString()}]\n` +
    `Name: ${data.firstName} ${data.lastName}\n` +
    `Email: ${data.email}\n` +
    `Matched order email: ${emailMatches ? 'yes' : 'NO — verify manually'}\n` +
    `Reason: ${data.reason || '(none given)'}`

  if (order) {
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        adminNotes: order.adminNotes ? `${order.adminNotes}\n\n${note}` : note,
      },
    })
  }

  // Notify the trader. Best-effort: a mail failure must not tell the consumer
  // their withdrawal was rejected, because legally it was not.
  try {
    const { sendWithdrawalNotice } = await import('@/lib/email-withdrawal')
    await sendWithdrawalNotice({
      orderNumber: data.orderNumber,
      customerEmail: data.email,
      customerName: `${data.firstName} ${data.lastName}`,
      reason: data.reason,
      matched: Boolean(emailMatches),
    })
  } catch (error) {
    payload.logger.error({ err: error }, 'Withdrawal notification email failed')
  }

  payload.logger.info(
    { orderNumber: data.orderNumber, matched: Boolean(emailMatches) },
    'Withdrawal request received',
  )

  return { success: true }
}
