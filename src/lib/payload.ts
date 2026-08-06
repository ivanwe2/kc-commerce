import config from '@payload-config'
import { getPayload } from 'payload'
import type { Payload, TypedLocale, Where } from 'payload'

import { CACHE_TAGS, cachedQuery } from './cache'
import type { Category, Product, Setting } from '@/payload-types'

/**
 * Data access for the storefront, all through Payload's Local API.
 *
 * The Local API runs in-process — no HTTP round-trip, no serialisation, and it
 * is type-safe against payload-types.ts. On Workers, where every millisecond is
 * billed CPU time, avoiding a self-request also avoids paying for the same
 * request twice.
 *
 * Queries here follow two rules that matter on D1, which bills by rows read:
 *   - `depth` as low as the view allows (0 unless a relationship is rendered)
 *   - never fetch fields the page does not display
 */

export async function getPayloadClient(): Promise<Payload> {
  return getPayload({ config })
}

export type StorefrontLocale = TypedLocale

type ProductQueryOptions = {
  locale: StorefrontLocale
  limit?: number
  page?: number
  categoryId?: number
  search?: string
  minPrice?: number
  maxPrice?: number
  inStockOnly?: boolean
  sort?: string
  featuredOnly?: boolean
}

/** Public product listing. Only active products are ever returned. */
export async function findProducts({
  locale,
  limit = 12,
  page = 1,
  categoryId,
  search,
  minPrice,
  maxPrice,
  inStockOnly,
  sort = '-createdAt',
  featuredOnly,
}: ProductQueryOptions) {
  const payload = await getPayloadClient()

  const and: Where[] = [{ isActive: { equals: true } }]

  if (categoryId) and.push({ category: { equals: categoryId } })
  if (featuredOnly) and.push({ isFeatured: { equals: true } })
  if (inStockOnly) and.push({ stock: { greater_than: 0 } })
  if (typeof minPrice === 'number') and.push({ basePrice: { greater_than_equal: minPrice } })
  if (typeof maxPrice === 'number') and.push({ basePrice: { less_than_equal: maxPrice } })

  if (search) {
    and.push({
      or: [
        { title: { like: search } },
        { shortDescription: { like: search } },
        { sku: { like: search } },
      ],
    })
  }

  return payload.find({
    collection: 'products',
    locale,
    where: { and },
    limit,
    page,
    sort,
    // depth 1 resolves category and image relationships, which product cards render.
    depth: 1,
  })
}

/** A single product by slug, or null. */
export const findProductBySlug = (
  slug: string,
  locale: StorefrontLocale,
): Promise<Product | null> =>
  cachedQuery(
    async (s: string, loc: StorefrontLocale) => {
      const payload = await getPayloadClient()
      const result = await payload.find({
        collection: 'products',
        locale: loc,
        where: { and: [{ slug: { equals: s } }, { isActive: { equals: true } }] },
        limit: 1,
        depth: 2,
      })
      return result.docs[0] ?? null
    },
    // Slug and locale are part of the key: without the locale a Bulgarian
    // visitor and an English one would share one cache entry.
    ['product', slug, locale],
    [CACHE_TAGS.products, CACHE_TAGS.product(slug)],
  )(slug, locale)

/** Other products in the same category, excluding the one being viewed. */
export async function findRelatedProducts(
  product: Product,
  locale: StorefrontLocale,
  limit = 4,
): Promise<Product[]> {
  const categoryId = typeof product.category === 'object' ? product.category?.id : product.category
  if (!categoryId) return []

  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'products',
    locale,
    where: {
      and: [
        { isActive: { equals: true } },
        { category: { equals: categoryId } },
        { id: { not_equals: product.id } },
      ],
    },
    limit,
    depth: 1,
  })

  return result.docs
}

export const findCategories = (locale: StorefrontLocale): Promise<Category[]> =>
  cachedQuery(
    async (loc: StorefrontLocale) => {
      const payload = await getPayloadClient()
      const result = await payload.find({
        collection: 'categories',
        locale: loc,
        where: { isActive: { equals: true } },
        limit: 100,
        sort: 'sortOrder',
        depth: 1,
      })
      return result.docs
    },
    ['categories'],
    [CACHE_TAGS.categories],
  )(locale)

export async function findCategoryBySlug(
  slug: string,
  locale: StorefrontLocale,
): Promise<Category | null> {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'categories',
    locale,
    where: { and: [{ slug: { equals: slug } }, { isActive: { equals: true } }] },
    limit: 1,
    depth: 1,
  })

  return result.docs[0] ?? null
}

/**
 * Site settings.
 *
 * Read on every page for the header and footer, so this is the single hottest
 * query in the app. Phase 8 wraps it in a cache tag invalidated by an
 * afterChange hook; until then it is a cheap single-row read.
 */
export const getSettings = (locale: StorefrontLocale): Promise<Setting> =>
  cachedQuery(
    async (loc: StorefrontLocale) => {
      const payload = await getPayloadClient()
      return payload.findGlobal({ slug: 'settings', locale: loc, depth: 1 })
    },
    ['settings'],
    [CACHE_TAGS.settings],
  )(locale)

export async function findPageBySlug(slug: string, locale: StorefrontLocale) {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'pages',
    locale,
    where: { and: [{ slug: { equals: slug } }, { isPublished: { equals: true } }] },
    limit: 1,
    depth: 1,
  })

  return result.docs[0] ?? null
}
