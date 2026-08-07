import config from '@payload-config'
import { getPayload } from 'payload'

import { displayPrice } from '@/lib/discount'
import { searchProductIds } from '@/lib/search'

/**
 * Autocomplete endpoint for the header search.
 *
 * A route handler rather than a server action: this is a read triggered by
 * typing, it must be cheap and cancellable, and GET semantics let the browser
 * abort an in-flight request when the query changes.
 *
 * Results are re-read through Payload rather than returned straight from the
 * FTS index, so access control and localization still apply. The index is a
 * lookup, never a source of truth about what a visitor may see.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').slice(0, 100)
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'bg'

  if (query.trim().length < 2) {
    return Response.json({ results: [] })
  }

  const { ids } = await searchProductIds(query, 6)
  if (ids.length === 0) return Response.json({ results: [] })

  const payload = await getPayload({ config })
  const products = await payload.find({
    collection: 'products',
    locale,
    where: { and: [{ id: { in: ids } }, { isActive: { equals: true } }] },
    limit: 6,
    depth: 1,
  })

  // Payload returns rows in its own order; restore the relevance ranking FTS
  // computed, or the "best match" would appear in an arbitrary position.
  const byId = new Map(products.docs.map((doc) => [doc.id, doc]))
  const ordered = ids.map((id) => byId.get(id)).filter((doc) => doc !== undefined)

  return Response.json(
    {
      results: ordered.map((product) => {
        const image = product.images?.[0]?.image
        return {
          id: product.id,
          slug: product.slug,
          title: product.title,
          sku: product.sku,
          price: displayPrice(product),
          image: image && typeof image === 'object' ? (image.url ?? null) : null,
        }
      }),
    },
    {
      headers: {
        // Short edge cache: the same few queries recur constantly while a
        // catalogue changes rarely.
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  )
}
