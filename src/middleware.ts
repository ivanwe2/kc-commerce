import { NextRequest, NextResponse } from 'next/server'

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

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Apply all security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Apply Strict-Transport-Security (only in production / HTTPS contexts)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }

  // Apply CSP — use relaxed CSP for admin routes (Payload needs inline scripts)
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  if (!isAdminRoute) {
    response.headers.set('Content-Security-Policy', storefrontCSP)
  }

  return response
}

export const config = {
  // Run on all routes except API routes, static assets, and Payload internals
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .png, .svg, etc. (static assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|\.ico).*)',
  ],
}
