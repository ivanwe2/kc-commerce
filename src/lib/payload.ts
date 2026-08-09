import config from '@payload-config'
import { getPayload } from 'payload'
import type { Payload, TypedLocale, Where } from 'payload'

import { CACHE_TAGS, cachedQuery } from './cache'
import { searchProductIds } from './search'
import type { Banner, Brand, Category, Product, Setting } from '@/payload-types'

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
  categoryIds?: number[]
  brandIds?: number[]
  search?: string
  minPrice?: number
  maxPrice?: number
  inStockOnly?: boolean
  sort?: string
  featuredOnly?: boolean
  onSaleOnly?: boolean
}

/** Public product listing. Only active products are ever returned. */
export async function findProducts({
  locale,
  limit = 12,
  page = 1,
  categoryIds,
  brandIds,
  search,
  minPrice,
  maxPrice,
  inStockOnly,
  sort = '-createdAt',
  featuredOnly,
  onSaleOnly,
}: ProductQueryOptions) {
  const payload = await getPayloadClient()

  const and: Where[] = [{ isActive: { equals: true } }]

  /**
   * Multi-select uses `in`, so choosing two categories widens the result set
   * rather than narrowing it to nothing. Selecting "Cleaning" AND "Tools" with
   * an equality match would return zero products, since no product is in both —
   * which reads as a broken filter rather than an empty category.
   */
  if (categoryIds?.length) and.push({ category: { in: categoryIds } })
  if (brandIds?.length) and.push({ brand: { in: brandIds } })
  if (featuredOnly) and.push({ isFeatured: { equals: true } })
  if (inStockOnly) and.push({ stock: { greater_than: 0 } })

  if (onSaleOnly) {
    /**
     * "On sale" filtered in the database, not in JavaScript after the fact —
     * post-filtering would break pagination counts.
     *
     * The date bounds mirror isSaleActive(): a null start means "already
     * started" and a null end means "no end", so both must be treated as
     * satisfying the window rather than excluded.
     */
    const now = new Date().toISOString()
    and.push({ salePrice: { greater_than: 0 } })
    and.push({ or: [{ saleStartsAt: { exists: false } }, { saleStartsAt: { less_than_equal: now } }] })
    and.push({ or: [{ saleEndsAt: { exists: false } }, { saleEndsAt: { greater_than_equal: now } }] })
  }
  if (typeof minPrice === 'number') and.push({ basePrice: { greater_than_equal: minPrice } })
  if (typeof maxPrice === 'number') and.push({ basePrice: { less_than_equal: maxPrice } })

  if (search) {
    /**
     * FTS5 first, LIKE only as a fallback.
     *
     * LIKE '%term%' cannot use an index and scans the table — on D1 that is
     * metered as well as slow. FTS also ranks by relevance and matches prefixes,
     * so "почист преп" finds "почистващ препарат".
     *
     * The fallback matters on a deployment where the search migration has not
     * run yet: search degrades rather than 500s.
     */
    const { ids, usedFts } = await searchProductIds(search, 200)

    if (usedFts) {
      // No matches is a real answer, not a reason to fall back — an impossible
      // id keeps the result set empty instead of silently returning everything.
      and.push({ id: { in: ids.length > 0 ? ids : [-1] } })
    } else {
      and.push({
        or: [
          { title: { like: search } },
          { shortDescription: { like: search } },
          { sku: { like: search } },
        ],
      })
    }
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

export const findBrands = (locale: StorefrontLocale): Promise<Brand[]> =>
  cachedQuery(
    async (loc: StorefrontLocale) => {
      const payload = await getPayloadClient()
      const result = await payload.find({
        collection: 'brands',
        locale: loc,
        where: { isActive: { equals: true } },
        limit: 200,
        sort: 'name',
        depth: 1,
      })
      return result.docs
    },
    ['brands'],
    [CACHE_TAGS.brands],
  )(locale)

export async function findBrandBySlug(
  slug: string,
  locale: StorefrontLocale,
): Promise<Brand | null> {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'brands',
    locale,
    where: { and: [{ slug: { equals: slug } }, { isActive: { equals: true } }] },
    limit: 1,
    depth: 1,
  })

  return result.docs[0] ?? null
}

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

/**
 * Banners scheduled to be live right now, for a placement.
 *
 * The date window is applied in the query rather than filtered afterwards, so
 * an unscheduled banner never reaches the client at all — including inside the
 * HTML payload, where a future promotion would otherwise be readable by anyone
 * viewing source.
 *
 * Not cached with a long tag: a banner going live is time-sensitive, and a
 * short revalidate is the difference between a promotion starting on time and
 * starting an hour late.
 */
export async function findActiveBanners(
  placement: 'homepage_hero' | 'homepage_mid' | 'listing_top',
  locale: StorefrontLocale,
): Promise<Banner[]> {
  const payload = await getPayloadClient()
  const now = new Date().toISOString()

  const result = await payload.find({
    collection: 'banners',
    locale,
    where: {
      and: [
        { isActive: { equals: true } },
        { placement: { equals: placement } },
        { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] },
        { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: now } }] },
      ],
    },
    limit: 5,
    sort: 'sortOrder',
    depth: 1,
  })

  return result.docs
}

/**
 * Cross-sell suggestions: curated first, same-category as a fallback.
 *
 * An admin who has picked specific companions knows better than a category
 * match, so their choice wins outright rather than being blended with automatic
 * results.
 */
export async function findCrossSell(
  product: Product,
  locale: StorefrontLocale,
  limit = 4,
): Promise<Product[]> {
  const curated = (product.crossSell ?? []).filter(
    (entry): entry is Product => typeof entry === 'object' && entry !== null,
  )

  if (curated.length > 0) return curated.slice(0, limit)

  return findRelatedProducts(product, locale, limit)
}

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
