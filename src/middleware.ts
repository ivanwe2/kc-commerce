import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'

/**
 * Locale routing plus security headers.
 *
 * NOTE: this file is deliberately `middleware.ts` and NOT the `proxy.ts` that
 * Next 16 now prefers, despite the deprecation warning printed on every build.
 *
 * Next 16's `proxy` convention runs exclusively on the Node.js runtime — the
 * edge runtime is not selectable, `export const config = { runtime: 'edge' }`
 * is a build error. OpenNext's Cloudflare adapter cannot run Node middleware
 * and fails the Worker build outright with "Node.js middleware is not
 * currently supported".
 *
 * So: keep `middleware.ts` (edge runtime, supported) and tolerate the warning
 * until OpenNext ships proxy support. Renaming this file to silence the
 * warning will break `pnpm deploy`. Verified against @opennextjs/cloudflare
 * 1.20.2 / next 16.3.0.
 * https://github.com/cloudflare/workers-sdk/issues/13755
 *
 * This runs on every matched request inside the Worker's CPU budget, so it is
 * deliberately allocation-light: no parsing, no crypto, no awaits.
 */

const BASE_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()'],
  ['X-DNS-Prefetch-Control', 'off'],
  // Modern browsers use CSP; the legacy auditor causes its own bugs.
  ['X-XSS-Protection', '0'],
]

/**
 * Storefront CSP.
 *
 * 'unsafe-inline' on script-src is required by Next's inline bootstrap and
 * hydration payload. Tightening this to a nonce is a worthwhile follow-up but
 * needs streaming-friendly nonce plumbing, so it is not attempted here.
 *
 * img-src permits https: because product media may be served from an R2 custom
 * domain that is not known at build time.
 */
const STOREFRONT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ')

const intlMiddleware = createIntlMiddleware(routing)

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Payload owns /admin and /api entirely. Locale routing must not touch them —
  // rewriting /admin to /bg/admin breaks the admin panel — and the storefront
  // CSP would block the inline scripts and styles Payload's UI depends on.
  const isPayloadRoute = pathname.startsWith('/admin') || pathname.startsWith('/api')

  const response = isPayloadRoute ? NextResponse.next() : intlMiddleware(request)

  for (const [key, value] of BASE_HEADERS) {
    response.headers.set(key, value)
  }

  // HSTS is set here and NOT at the Cloudflare zone level. Two sources emitting
  // this header with different max-age values is a real and confusing failure
  // mode; keep exactly one owner.
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  if (!isPayloadRoute) {
    response.headers.set('Content-Security-Policy', STOREFRONT_CSP)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets. Those are served by
    // Cloudflare's asset store and never reach the Worker anyway.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml)$).*)',
  ],
}
