import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/**
 * Cache invalidation from the admin panel.
 *
 * Storefront pages are cached with `revalidate`, so without this an editor
 * would change a price and then watch the old one sit on the site for the rest
 * of the hour. These hooks flush the affected tags the moment content changes.
 *
 * Tags are granular on purpose: editing one product must not flush the entire
 * catalogue, which on a metered platform means paying to re-render every page.
 *
 * Next 16 requires an expiration profile as the second argument. 'max' means
 * "expire this tag now and let the next request repopulate it" — which is the
 * behaviour the old single-argument form had.
 */
const EXPIRE_NOW = 'max'

export const revalidateProduct: CollectionAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('products', EXPIRE_NOW)
    if (doc.slug) revalidateTag(`product:${doc.slug}`, EXPIRE_NOW)
  } catch (error) {
    // revalidateTag throws outside a request context (e.g. the seed script).
    // A failed cache flush must not fail the write that triggered it.
    req.payload.logger.warn({ err: error }, 'revalidateTag failed')
  }
  return doc
}

export const revalidateProductDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  try {
    revalidateTag('products', EXPIRE_NOW)
    if (doc?.slug) revalidateTag(`product:${doc.slug}`, EXPIRE_NOW)
  } catch (error) {
    req.payload.logger.warn({ err: error }, 'revalidateTag failed')
  }
  return doc
}

export const revalidateCategory: CollectionAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('categories', EXPIRE_NOW)
    revalidateTag('products', EXPIRE_NOW)
  } catch (error) {
    req.payload.logger.warn({ err: error }, 'revalidateTag failed')
  }
  return doc
}

export const revalidatePage: CollectionAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('pages', EXPIRE_NOW)
    if (doc.slug) revalidateTag(`page:${doc.slug}`, EXPIRE_NOW)
  } catch (error) {
    req.payload.logger.warn({ err: error }, 'revalidateTag failed')
  }
  return doc
}

export const revalidateBrand: CollectionAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('brands', EXPIRE_NOW)
    // Product cards show the brand name, so they go stale too.
    revalidateTag('products', EXPIRE_NOW)
  } catch (error) {
    req.payload.logger.warn({ err: error }, 'revalidateTag failed')
  }
  return doc
}

/** Settings appear in the header and footer of every page, so flush everything. */
export const revalidateSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  try {
    revalidateTag('settings', EXPIRE_NOW)
    revalidateTag('products', EXPIRE_NOW)
    revalidateTag('categories', EXPIRE_NOW)
    revalidateTag('pages', EXPIRE_NOW)
  } catch (error) {
    req.payload.logger.warn({ err: error }, 'revalidateTag failed')
  }
  return doc
}
