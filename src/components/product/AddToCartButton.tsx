'use client'

import { Check, Minus, Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/money'
import { calculateTierPrice, nextTierHint, type PricingTier } from '@/lib/pricing'
import { useCartStore, type CartItem } from '@/stores/cart'

/**
 * Quantity selector plus add-to-cart.
 *
 * The displayed unit price updates live as the quantity crosses a bulk tier —
 * this is the moment the tiered pricing becomes visible, and it is what nudges
 * a retail buyer toward a wholesale quantity.
 */
export function AddToCartButton({
  item,
  disabled,
}: {
  item: Omit<CartItem, 'quantity'>
  disabled?: boolean
}) {
  const t = useTranslations('product')
  const cartT = useTranslations('cart')
  const locale = useLocale()
  const addItem = useCartStore((state) => state.addItem)

  const minQuantity = Math.max(1, item.minOrderQuantity)
  const [quantity, setQuantity] = useState(minQuantity)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), 2000)
    return () => clearTimeout(timer)
  }, [justAdded])

  const tiers = item.pricingTiers as PricingTier[]
  const unitPrice = calculateTierPrice(quantity, tiers, item.basePrice)
  const hint = nextTierHint(quantity, tiers, item.basePrice)
  const atMaxStock = quantity >= item.maxStock

  const clamp = (value: number) =>
    Math.min(Math.max(value, minQuantity), Math.max(minQuantity, item.maxStock))

  if (disabled) {
    return (
      <Button variant="primary" size="lg" block disabled>
        {t('outOfStock')}
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium text-body">
          {t('quantity')}
        </label>

        <div className="inline-flex items-center rounded-[--radius-control] border border-border-default">
          <button
            type="button"
            onClick={() => setQuantity((value) => clamp(value - 1))}
            disabled={quantity <= minQuantity}
            aria-label="-"
            className="inline-flex size-11 items-center justify-center text-secondary transition-colors hover:bg-surface-alt disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>

          <input
            id="quantity"
            type="number"
            inputMode="numeric"
            value={quantity}
            min={minQuantity}
            max={item.maxStock}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (Number.isFinite(parsed)) setQuantity(clamp(parsed))
            }}
            className="w-16 border-x border-border-default bg-background py-2 text-center text-base focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setQuantity((value) => clamp(value + 1))}
            disabled={atMaxStock}
            aria-label="+"
            className="inline-flex size-11 items-center justify-center text-secondary transition-colors hover:bg-surface-alt disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>

        <span className="text-sm text-body">
          × {formatPrice(unitPrice, locale)} {t('perUnit')}
        </span>
      </div>

      {atMaxStock && <p className="text-sm text-warning-foreground">{cartT('maxStockReached')}</p>}

      {hint && (
        <p className="rounded-[--radius-control] bg-success-subtle px-3 py-2 text-sm text-success-foreground">
          {t('addMoreToSave', {
            count: hint.unitsNeeded,
            price: formatPrice(hint.newUnitPrice, locale),
          })}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        block
        onClick={() => {
          addItem(item, quantity)
          setJustAdded(true)
        }}
      >
        {justAdded ? (
          <>
            <Check className="size-5" aria-hidden="true" />
            {t('addedToCart')}
          </>
        ) : (
          t('addToCart')
        )}
      </Button>
    </div>
  )
}
