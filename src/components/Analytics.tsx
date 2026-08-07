import Script from 'next/script'

/**
 * Plausible analytics.
 *
 * Chosen over Google Analytics for a specific and practical reason: Plausible
 * sets no cookies and stores no personal data, so under the ePrivacy Directive
 * it needs no consent at all. That means it measures 100% of traffic instead of
 * only the visitors who accepted a banner — and it keeps the cookie policy
 * honest, since the shop can continue to claim it uses necessary cookies only.
 *
 * It is also why this component does NOT check the consent cookie. Gating a
 * cookie-free, non-personal measurement behind consent would be theatre, and
 * would halve the data for no privacy gain.
 *
 * Renders nothing until NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set, so the site runs
 * unchanged without an analytics account.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

  if (!domain) return null

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.outbound-links.js"
      // afterInteractive, not beforeInteractive: measurement must never sit on
      // the critical path of a page a customer is trying to buy from.
      strategy="afterInteractive"
    />
  )
}
