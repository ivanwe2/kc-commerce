// TODO: Replace with e-commerce meta generation in Phase 2
import type { Page, Product } from '@/payload-types'

export function generateMeta(page?: Page | Product) {
  return {
    title: page?.title || 'KC Trading',
    description: page?.seo?.metaDescription || 'Bulgarian e-commerce store',
  }
}
