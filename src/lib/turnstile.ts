/**
 * Cloudflare Turnstile verification.
 *
 * Turnstile rather than reCAPTCHA for reasons that matter here specifically: it
 * is on the platform this shop already runs on, it does not profile visitors or
 * set advertising cookies — so it stays outside the consent banner and keeps the
 * "necessary cookies only" claim in the cookie policy true — and most visitors
 * never see a challenge at all.
 *
 * The token is verified SERVER-SIDE. A widget that renders and is never checked
 * is decoration: the token proves nothing until Cloudflare confirms it, and a
 * bot posting directly to the server action would skip the widget entirely.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' | 'error' }

/** Whether Turnstile is configured. Both halves are required to be meaningful. */
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
}

export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  /**
   * Not configured means not enforced.
   *
   * The shop has to remain fully usable before the Turnstile keys exist —
   * locally, in CI, and on a first deploy. Failing closed here would make the
   * contact and withdrawal forms unusable the moment this shipped, including
   * the withdrawal form, which is legally required to work.
   */
  if (!secret) return { ok: true }

  if (!token) return { ok: false, reason: 'missing' }

  try {
    const body = new FormData()
    body.append('secret', secret)
    body.append('response', token)
    // Cloudflare uses the IP to spot a token being replayed from elsewhere.
    if (ip && ip !== 'unknown') body.append('remoteip', ip)

    const response = await fetch(SITEVERIFY_URL, { method: 'POST', body })
    const result = (await response.json()) as { success?: boolean; 'error-codes'?: string[] }

    if (result.success) return { ok: true }

    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'Turnstile verification rejected a submission',
        codes: result['error-codes'] ?? [],
      }),
    )

    return { ok: false, reason: 'invalid' }
  } catch (error) {
    /**
     * Fail OPEN when Cloudflare itself is unreachable.
     *
     * The same reasoning as the rate limiter: for a shop, turning away genuine
     * customers because a third-party endpoint is down costs more than letting
     * through the spam an admin can delete. The honeypot and the rate limit are
     * both still in front of this.
     */
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'Turnstile verification unreachable — allowing the submission',
        err: error instanceof Error ? error.message : String(error),
      }),
    )
    return { ok: true }
  }
}
