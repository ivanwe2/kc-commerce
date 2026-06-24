// TODO: Replace with e-commerce preview paths in Phase 2
import type { CollectionSlug } from 'payload'

export function generatePreviewPath(collection: CollectionSlug) {
  return `/preview/${collection}`
}
