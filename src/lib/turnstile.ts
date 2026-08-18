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
 *
 * `success: true` alone is NOT sufficient, and this is the part that is easy to
 * get wrong. A siteverify response also carries the hostname the token was
 * minted on and the action it was minted for, and both have to be checked
 * against what this request should have produced. See below.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' | 'error' }

type SiteverifyResponse = {
  success?: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

/** Whether Turnstile is configured. Both halves are required to be meaningful. */
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
}

/**
 * Hostnames whose tokens this deployment will accept.
 *
 * This exists because the widget is registered for `bitodom.com`, `localhost`
 * AND `127.0.0.1` — convenient for development, and a genuine bypass without
 * this check. The sitekey is public by design (it sits in the page HTML), so
 * anyone can render the same widget on their own machine at localhost, solve
 * the challenge legitimately, and post the resulting token to production.
 * Cloudflare would answer `success: true`, because the token IS valid — just
 * not for us. Comparing the returned hostname is what makes it ours.
 *
 * Derived from NEXT_PUBLIC_SITE_URL rather than listed by hand, so the
 * production allowlist cannot accidentally contain localhost: in production
 * that variable is https://bitodom.com and localhost simply never appears.
 * TURNSTILE_HOSTNAMES overrides it when a deployment is reachable on a name the
 * site URL does not describe.
 */
function allowedHostnames(): Set<string> {
  const explicit = (process.env.TURNSTILE_HOSTNAMES ?? '')
    .split(',')
    .map((hostname) => hostname.trim())
    .filter(Boolean)

  if (explicit.length > 0) return new Set(explicit)

  try {
    const { hostname } = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '')
    // Cloudflare returns the exact hostname, and www is a different one.
    return new Set(hostname.startsWith('www.') ? [hostname] : [hostname, `www.${hostname}`])
  } catch {
    return new Set()
  }
}

export async function verifyTurnstile(
  token: string | undefined,
  options: { ip?: string; action: string },
): Promise<TurnstileResult> {
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

  // A Turnstile token is ~250 chars; anything of this size is not one, and
  // there is no reason to hand it to Cloudflare to find that out.
  if (token.length > 2048) return { ok: false, reason: 'invalid' }

  try {
    const body = new FormData()
    body.append('secret', secret)
    body.append('response', token)
    // Cloudflare uses the IP to spot a token being replayed from elsewhere.
    if (options.ip && options.ip !== 'unknown') body.append('remoteip', options.ip)

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      // Without a bound timeout a hung siteverify holds the Worker's request
      // open until the platform kills it, turning a slow dependency into a
      // failed submission rather than the fail-open below.
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) throw new Error(`siteverify responded ${response.status}`)

    const result = (await response.json()) as SiteverifyResponse

    const hostnames = allowedHostnames()

    /**
     * An empty allowlist means NEXT_PUBLIC_SITE_URL is unset or unparseable,
     * which is a misconfiguration rather than an attack. Cloudflare's reference
     * implementation rejects here. We log loudly and skip only the hostname
     * comparison instead, for the same reason as the fail-open below: the
     * withdrawal form is legally required to work, and an operator typo must
     * not be able to take it offline. Every deployment sets this variable in
     * wrangler.jsonc, so this branch should be unreachable in practice.
     */
    const hostnameOk =
      hostnames.size === 0 || (result.hostname !== undefined && hostnames.has(result.hostname))

    if (hostnames.size === 0) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'Turnstile hostname check skipped — NEXT_PUBLIC_SITE_URL is not a parseable URL',
        }),
      )
    }

    // Binds the token to the form it was minted for, so a token solved on the
    // contact form cannot be spent on the withdrawal form.
    const actionOk = result.action === options.action

    if (result.success && hostnameOk && actionOk) return { ok: true }

    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'Turnstile verification rejected a submission',
        codes: result['error-codes'] ?? [],
        // Which check failed, without echoing attacker-controlled values back
        // into the log as though they were ours.
        success: Boolean(result.success),
        hostnameOk,
        actionOk,
        expectedAction: options.action,
      }),
    )

    return { ok: false, reason: 'invalid' }
  } catch (error) {
    /**
     * Fail OPEN when Cloudflare itself is unreachable.
     *
     * A deliberate deviation from Cloudflare's reference implementation, which
     * returns 403 here. The same reasoning as the rate limiter: for a shop,
     * turning away genuine customers because a third-party endpoint is down
     * costs more than letting through spam an admin can delete — and the
     * withdrawal form must keep working. The honeypot and the D1 rate limit are
     * both still in front of this, so this path is not unprotected.
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
