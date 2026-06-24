import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

// TODO: Implement proper revalidation in Phase 2 when frontend is built
export const revalidatePage: CollectionAfterChangeHook = async () => {
  // No-op for now
}

export const revalidateDeletedPage: CollectionAfterDeleteHook = async () => {
  // No-op for now
}
