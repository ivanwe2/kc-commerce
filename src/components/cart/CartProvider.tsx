'use client'

import { useEffect } from 'react'

import { useCartStore } from '@/stores/cart'

/**
 * Rehydrates the persisted cart after mount.
 *
 * The store sets `skipHydration`, so reading localStorage is deliberately
 * deferred to here — the first client render matches the server's empty cart,
 * and React never sees a hydration mismatch. Rendering nothing itself keeps
 * this out of the layout's visual tree.
 */
export function CartProvider() {
  useEffect(() => {
    void useCartStore.persist.rehydrate()
  }, [])

  return null
}
