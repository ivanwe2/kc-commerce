'use client'

import { Check, ShoppingCart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { useCartStore, type CartItem } from '@/stores/cart'

/**
 * Add to cart directly from a listing card.
 *
 * The audit flagged that a bulk buyer reordering known SKUs needed a full page
 * load per product. This adds the minimum order quantity in one click, without
 * leaving the grid.
 *
 * Deliberately NOT a quick-view modal. A modal duplicates the product page in a
 * cramped box, has to re-solve the gallery and tier table, and adds a second
 * place for pricing to be rendered — and therefore to disagree. Someone who
 * needs the detail can open the product; someone who already knows what they
 * want just needs the button.
 */
export function QuickAdd({
  item,
  disabled,
  className,
}: {
  item: Omit<CartItem, 'quantity'>
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations('product')
  const addItem = useCartStore((state) => state.addItem)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), 1800)
    return () => clearTimeout(timer)
  }, [justAdded])

  if (disabled) return null

  return (
    <button
      type="button"
      aria-label={`${t('addToCart')}: ${item.title}`}
      onClick={(event) => {
        // The card is one big link with a stretched ::after; without this the
        // click navigates to the product page instead of adding to the cart.
        event.preventDefault()
        event.stopPropagation()
        addItem(item, Math.max(1, item.minOrderQuantity))
        setJustAdded(true)
      }}
      className={cn(
        // z-10 lifts it above the card's stretched link overlay.
        'relative z-10 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[--radius-control] text-sm font-medium transition-colors',
        justAdded
          ? 'bg-success-subtle text-success-foreground'
          : 'border border-primary bg-background text-primary hover:bg-primary-subtle',
        className,
      )}
    >
      {justAdded ? (
        <>
          <Check className="size-4" aria-hidden="true" />
          {t('addedToCart')}
        </>
      ) : (
        <>
          <ShoppingCart className="size-4" aria-hidden="true" />
          {t('addToCart')}
        </>
      )}
    </button>
  )
}
