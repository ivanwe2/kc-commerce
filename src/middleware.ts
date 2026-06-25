import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'

// Security headers applied to all non-admin responses
const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'off',
}

// CSP for public storefront — relaxed for admin (Payload needs inline scripts)
const storefrontCSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"

const intlMiddleware = createMiddleware(routing)

export function middleware(request: NextRequest) {
  // Skip security headers for Payload admin/API routes — let intlMiddleware handle routing first
  const isAdminRoute =
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/api')

  // Run locale detection / routing first
  const intlResponse = intlMiddleware(request)

  // If intlMiddleware redirected, return early
  if (intlResponse.status !== 200) {
    return intlResponse
  }

  // Apply security headers to the response
  const response = NextResponse.next()

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }

  if (!isAdminRoute) {
    response.headers.set('Content-Security-Policy', storefrontCSP)
  }

  // Copy locale cookie from intlMiddleware
  if (intlResponse.cookies) {
    intlResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
  }

  // Apply the locale header from intlMiddleware
  const localeHeader = intlResponse.headers.get('x-middleware-locale')
  if (localeHeader) {
    response.headers.set('x-middleware-locale', localeHeader)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|\.ico).*)',
  ],
}
