import { unstable_cache } from 'next/cache'

/**
 * Tagged caching for Payload queries.
 *
 * This exists because the revalidate hooks in collections/hooks/revalidate.ts
 * were, until now, invalidating tags that nothing was tagged with. They ran, they
 * logged nothing, and they did nothing — pages only ever expired on their
 * time-based `revalidate`. An editor changing a price still waited up to an hour
 * to see it.
 *
 * `unstable_cache` is used rather than the newer `use cache` directive because
 * the latter requires the `cacheComponents` flag, which changes rendering
 * semantics across the whole app. That is a deliberate change to make on its
 * own, not a side effect of fixing cache invalidation.
 *
 * TAG DISCIPLINE — tags here must match the hooks exactly, or invalidation
 * silently does nothing again:
 *   products          every product query
 *   product:<slug>    one product's detail page
 *   categories        every category query
 *   brands            every brand query
 *   pages             CMS pages
 *   settings          the Settings global (read on every page)
 */

export const CACHE_TAGS = {
  products: 'products',
  product: (slug: string) => `product:${slug}`,
  categories: 'categories',
  brands: 'brands',
  banners: 'banners',
  reviews: 'reviews',
  pages: 'pages',
  page: (slug: string) => `page:${slug}`,
  settings: 'settings',
} as const

/**
 * Wrap a Payload query in a tagged cache entry.
 *
 * `keyParts` must include every argument that changes the result — locale above
 * all. Omitting it would serve Bulgarian content to English visitors from cache,
 * which is the classic and very visible way to get this wrong.
 */
export function cachedQuery<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  tags: string[],
  revalidateSeconds = 3600,
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, keyParts, { tags, revalidate: revalidateSeconds })
}
