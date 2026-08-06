import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Admin and API are not content and must never be crawled.
          '/admin',
          '/api',
          // Per-visitor pages. Indexing a confirmation URL would put order
          // numbers into search results.
          '/cart',
          '/checkout',
          '/en/cart',
          '/en/checkout',
          // Filtered listings are infinite permutations of the same products —
          // crawling them wastes budget and creates duplicate content.
          '/products?',
          '/en/products?',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
