import config from '@payload-config'
import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'

import { renderInvoiceHtml } from '@/lib/invoice'

/**
 * Invoice for an order. STAFF ONLY.
 *
 * Placed under (payload) rather than the storefront so it sits outside the
 * locale routing and is covered by the same CSP exclusion as the admin.
 *
 * Authorisation is checked against the Payload session rather than a secret in
 * the URL: an invoice contains a customer's full name, address and phone
 * number, and a guessable link to that is a data breach waiting to be indexed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: await nextHeaders() })

  // Must be an admin-panel user. A signed-in CUSTOMER must not reach this —
  // `user` alone would be satisfied by any authenticated session.
  if (!user || user.collection !== 'users') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { orderNumber } = await params

  const orders = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const order = orders.docs[0]
  if (!order) return new Response('Not found', { status: 404 })

  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })

  return new Response(renderInvoiceHtml({ order, settings, locale: order.locale ?? 'bg' }), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Never let an invoice end up in a search index or a shared cache.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
