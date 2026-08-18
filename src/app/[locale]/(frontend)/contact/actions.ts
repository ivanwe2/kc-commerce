'use server'

import { z } from 'zod'

import { sendContactMessage } from '@/lib/email-withdrawal'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/turnstile'

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email({ message: 'invalidEmail' }),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(2000),
  // Honeypot: a hidden field real users never fill in. Kept alongside
  // Turnstile rather than replaced by it — it costs nothing, needs no network
  // call, and disposes of the low-effort bots before anything else runs.
  website: z.string().max(0).optional(),
  turnstileToken: z.string().optional(),
})

export type ContactResult = { success: true } | { success: false; error: string }

export async function sendContact(input: unknown): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'fieldRequired' }
  }

  // Silently accept and discard honeypot hits, so a bot cannot tell it failed.
  if (parsed.data.website) return { success: true }

  const ip = await getClientIp()

  // Three layers, cheapest first: honeypot (free, above), Turnstile (one
  // network call), then the rate limit (a database write). Ordering them this
  // way means the most expensive check runs least often.
  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, { ip, action: 'contact' })
  if (!turnstile.ok) return { success: false, error: 'botCheckFailed' }

  const limit = await checkRateLimit({ identifier: ip, action: 'contact', limit: 5 })
  if (!limit.allowed) return { success: false, error: 'tooManyRequests' }

  try {
    await sendContactMessage(parsed.data)
    return { success: true }
  } catch {
    return { success: false, error: 'genericText' }
  }
}
