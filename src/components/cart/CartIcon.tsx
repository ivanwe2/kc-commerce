'use client'

import { ShoppingCart } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/routing'
import { cartItemCount, useCartStore } from '@/stores/cart'

/**
 * Cart link with an item-count badge.
 *
 * The badge renders only once the persisted store has rehydrated. Showing "0"
 * and then flipping to the real count would be a visible flash on every page
 * load for anyone with a cart.
 */
export function CartIcon() {
  const t = useTranslations('common')
  const items = useCartStore((state) => state.items)
  const hasHydrated = useCartStore((state) => state.hasHydrated)

  const count = hasHydrated ? cartItemCount(items) : 0

  return (
    <Link
      href="/cart"
      aria-label={t('cart')}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-[--radius-control] text-secondary transition-colors hover:bg-surface-alt hover:text-primary"
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {hasHydrated && count > 0 && (
        <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
