'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { calculateTierPrice, type PricingTier } from '@/lib/pricing'
import { sumMoney, multiplyMoney } from '@/lib/money'

/**
 * Anonymous shopping cart, persisted to localStorage.
 *
 * EVERYTHING HERE IS DISPLAY STATE ONLY.
 *
 * The prices, titles and stock levels below are snapshots taken when the item
 * was added — convenient for rendering, and completely untrusted. The checkout
 * server action re-reads every product from the database and recalculates every
 * price before an order is written. A customer editing localStorage changes
 * what they see and nothing else.
 */

export type CartItem = {
  productId: number
  slug: string
  title: string
  image: string | null
  basePrice: number
  quantity: number
  maxStock: number
  minOrderQuantity: number
  unit: string
  pricingTiers: PricingTier[]
}

type CartState = {
  items: CartItem[]
  hasHydrated: boolean
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  setHasHydrated: (value: boolean) => void
}

/** Clamp a requested quantity into the product's allowed range. */
function clampQuantity(quantity: number, item: Pick<CartItem, 'maxStock' | 'minOrderQuantity'>) {
  const min = Math.max(1, item.minOrderQuantity)
  const max = Math.max(min, item.maxStock)
  return Math.min(Math.max(Math.floor(quantity), min), max)
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hasHydrated: false,

      addItem: (item, quantity) =>
        set((state) => {
          const existing = state.items.find((entry) => entry.productId === item.productId)

          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.productId === item.productId
                  ? { ...entry, quantity: clampQuantity(entry.quantity + quantity, entry) }
                  : entry,
              ),
            }
          }

          return {
            items: [...state.items, { ...item, quantity: clampQuantity(quantity, item) }],
          }
        }),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((entry) => entry.productId !== productId) })),

      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((entry) => entry.productId !== productId) }
          }

          return {
            items: state.items.map((entry) =>
              entry.productId === productId
                ? { ...entry, quantity: clampQuantity(quantity, entry) }
                : entry,
            ),
          }
        }),

      clearCart: () => set({ items: [] }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'kc-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),

      /**
       * Server-rendered HTML cannot know what is in localStorage, so the first
       * client render must match the server's empty cart or React throws a
       * hydration mismatch. `skipHydration` defers reading storage until the
       * provider explicitly rehydrates after mount, and `hasHydrated` lets
       * components render a stable placeholder until then.
       */
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)

/** Unit price for a line, at the tier its quantity qualifies for. */
export function lineUnitPrice(item: CartItem): number {
  return calculateTierPrice(item.quantity, item.pricingTiers, item.basePrice)
}

/** Line total. */
export function lineTotal(item: CartItem): number {
  return multiplyMoney(lineUnitPrice(item), item.quantity)
}

/** Cart subtotal. */
export function cartSubtotal(items: CartItem[]): number {
  return sumMoney(items.map(lineTotal))
}

/** Total number of units in the cart. */
export function cartItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0)
}
