import type { MetadataRoute } from 'next'

import { getPayloadClient } from '@/lib/payload'
import { routing } from '@/i18n/routing'

/**
 * Sitemap covering both locales.
 *
 * Bulgarian URLs are unprefixed and English carries /en, matching the
 * `as-needed` locale strategy. Each entry declares its alternate via
 * `alternates.languages`, which is what tells search engines the two URLs are
 * the same page in different languages rather than duplicate content.
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** Bulgarian is unprefixed; English lives under /en. */
function localized(path: string): Record<string, string> {
  const base = siteUrl()
  const normalized = path === '/' ? '' : path

  return {
    bg: `${base}${normalized || '/'}`,
    en: `${base}/en${normalized}`,
  }
}

function entry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
  lastModified?: string | Date,
): MetadataRoute.Sitemap[number] {
  const urls = localized(path)

  return {
    url: urls.bg!,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency,
    priority,
    alternates: { languages: urls },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient()

  // `select` keeps this cheap: D1 bills by rows read, and a sitemap needs two
  // columns per row, not whole documents.
  const [products, categories, pages] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { isActive: { equals: true } },
      limit: 5000,
      depth: 0,
      select: { slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'categories',
      where: { isActive: { equals: true } },
      limit: 500,
      depth: 0,
      select: { slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'pages',
      where: { isPublished: { equals: true } },
      limit: 200,
      depth: 0,
      select: { slug: true, updatedAt: true },
    }),
  ])

  return [
    entry('/', 'daily', 1),
    entry('/products', 'daily', 0.9),
    entry('/categories', 'weekly', 0.8),

    ...products.docs
      .filter((doc) => doc.slug)
      .map((doc) => entry(`/products/${doc.slug}`, 'weekly', 0.8, doc.updatedAt)),

    ...categories.docs
      .filter((doc) => doc.slug)
      .map((doc) => entry(`/categories/${doc.slug}`, 'weekly', 0.7, doc.updatedAt)),

    ...pages.docs
      .filter((doc) => doc.slug)
      .map((doc) => entry(`/${doc.slug}`, 'monthly', 0.4, doc.updatedAt)),

    // Legal pages: low priority, but they must be indexable — being findable is
    // part of the point of publishing them.
    entry('/terms', 'yearly', 0.3),
    entry('/privacy', 'yearly', 0.3),
    entry('/cookies', 'yearly', 0.3),
    entry('/withdrawal', 'yearly', 0.4),
    entry('/contact', 'monthly', 0.5),
    entry('/about', 'monthly', 0.5),
  ]
}

export const revalidate = 3600

/** Exported for reuse by robots.ts. */
export { siteUrl }
export const LOCALES = routing.locales
