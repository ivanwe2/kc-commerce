import { getCloudflareContext } from '@opennextjs/cloudflare'

import { nextCounterValue } from './counters'

/**
 * IP-based rate limiting, backed by the D1 counters table.
 *
 * Why not an in-memory counter: Workers runs many isolates, each with its own
 * memory, and they are created and destroyed constantly. A module-level Map
 * would limit requests *per isolate*, which is not a limit at all — it would
 * look like it worked in testing and do nothing under load. Anything claiming
 * to be a rate limit has to live in shared storage.
 *
 * This is the inner defence. The outer one is a Cloudflare WAF rate-limiting
 * rule configured in the dashboard (see Phase 10), which rejects abuse before
 * it ever reaches the Worker and costs us anything.
 */

/**
 * Hash the client IP rather than storing it.
 *
 * An IP address is personal data under GDPR, and a plaintext one sitting in a
 * counters table is a liability with no upside — we only ever need to compare
 * it to itself.
 */
async function hashIdentifier(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Client IP from Cloudflare's connecting-IP header. */
export async function getClientIp(): Promise<string> {
  try {
    const { cf } = await getCloudflareContext({ async: true })
    void cf
  } catch {
    // Not inside a request context; fall through to the header read below.
  }

  const { headers } = await import('next/headers')
  const headerList = await headers()

  return (
    headerList.get('cf-connecting-ip') ??
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export type RateLimitResult = {
  allowed: boolean
  current: number
  limit: number
}

/**
 * Consume one unit against a fixed window.
 *
 * The window is encoded in the counter key, so expiry is implicit: a new hour
 * means a new key starting at zero. Old keys become inert rows — cheap, and
 * cleaned up by the maintenance job rather than by a TTL D1 does not have.
 */
export async function checkRateLimit({
  identifier,
  action,
  limit,
  windowSeconds = 3600,
}: {
  identifier: string
  action: string
  limit: number
  windowSeconds?: number
}): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
  const hashed = await hashIdentifier(identifier)
  const key = `ratelimit:${action}:${hashed}:${bucket}`

  try {
    const current = await nextCounterValue(key)
    return { allowed: current <= limit, current, limit }
  } catch {
    /**
     * Fail OPEN, deliberately.
     *
     * If the counter write fails, the choice is between rejecting a genuine
     * customer's order and briefly allowing an abusive one. For a
     * cash-on-delivery shop the first is a lost sale and the second is an
     * order an admin can cancel. The WAF rule is still in front of this.
     */
    return { allowed: true, current: 0, limit }
  }
}
