import config from '@payload-config'
import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'

import { renderPackingSlip, renderPickList } from '@/lib/fulfilment'

/**
 * Warehouse paperwork. STAFF ONLY.
 *
 *   /api/fulfilment?type=packing-slip&order=BD-2026-00001
 *   /api/fulfilment?type=pick-list&status=confirmed
 *
 * Same authorisation as invoices: a Payload session belonging to the `users`
 * collection specifically. These documents contain customer names, phone
 * numbers and delivery addresses, so `user` alone — which any signed-in
 * customer would satisfy — is not sufficient.
 */
export async function GET(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (!user || user.collection !== 'users') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'pick-list'
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })

  if (type === 'packing-slip') {
    const orderNumber = searchParams.get('order')
    if (!orderNumber) return new Response('Missing order', { status: 400 })

    const found = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const order = found.docs[0]
    if (!order) return new Response('Not found', { status: 404 })

    return html(renderPackingSlip(order, settings))
  }

  // Pick list: everything at a given status that still needs picking.
  const status = searchParams.get('status') ?? 'confirmed'
  const orders = await payload.find({
    collection: 'orders',
    where: { status: { equals: status } },
    limit: 200,
    depth: 0,
    sort: 'createdAt',
    overrideAccess: true,
  })

  return html(renderPickList(orders.docs, settings))
}

function html(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
