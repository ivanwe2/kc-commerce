'use client'

import { Minus, Plus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'

import { buttonVariants } from '@/components/ui/Button'
import { Link } from '@/i18n/routing'
import { formatPrice } from '@/lib/money'
import { nextTierHint, type PricingTier } from '@/lib/pricing'
import { cartSubtotal, lineTotal, lineUnitPrice, useCartStore } from '@/stores/cart'

/**
 * Full cart page contents.
 *
 * Client component because it reads the persisted store. Prices shown here are
 * recalculated from the tier table on every quantity change, and re-verified
 * server-side at checkout — the customer never sees one number and pays another.
 */
export function CartContents() {
  const t = useTranslations('cart')
  const productT = useTranslations('product')
  const common = useTranslations('common')
  const locale = useLocale()

  const items = useCartStore((state) => state.items)
  const hasHydrated = useCartStore((state) => state.hasHydrated)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)

  // Until the persisted store has loaded we cannot know whether the cart is
  // empty. Rendering the empty state now would flash "your cart is empty" at
  // someone who has ten items in it.
  if (!hasHydrated) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1].map((key) => (
          <div
            key={key}
            className="h-24 animate-pulse rounded-[--radius-surface] border border-border-default bg-surface"
          />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[--radius-surface] border border-border-default bg-surface p-12 text-center">
        <p className="text-base font-medium text-heading">{t('empty')}</p>
        <p className="mt-1 text-sm text-body">{t('emptyHint')}</p>
        <Link href="/products" className={`${buttonVariants({ variant: 'primary' })} mt-4`}>
          {common('continueShopping')}
        </Link>
      </div>
    )
  }

  const subtotal = cartSubtotal(items)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-3">
        {items.map((item) => {
          const unitPrice = lineUnitPrice(item)
          const hint = nextTierHint(item.quantity, item.pricingTiers as PricingTier[], item.basePrice)

          return (
            <li
              key={item.productId}
              className="flex gap-4 rounded-[--radius-surface] border border-border-default bg-background p-4"
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-[--radius-control] bg-surface">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-contain p-1"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-heading">
                  <Link href={`/products/${item.slug}`} className="hover:text-primary">
                    {item.title}
                  </Link>
                </h2>

                <p className="mt-0.5 text-sm text-body">
                  {formatPrice(unitPrice, locale)} {productT('perUnit')}
                </p>

                {hint && (
                  <p className="mt-1 text-xs text-success-foreground">
                    {productT('addMoreToSave', {
                      count: hint.unitsNeeded,
                      price: formatPrice(hint.newUnitPrice, locale),
                    })}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-[--radius-control] border border-border-default">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      aria-label="-"
                      className="inline-flex size-11 items-center justify-center text-secondary hover:bg-surface-alt"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={productT('quantity')}
                      value={item.quantity}
                      min={item.minOrderQuantity}
                      max={item.maxStock}
                      onChange={(event) => {
                        const parsed = Number(event.target.value)
                        if (Number.isFinite(parsed)) updateQuantity(item.productId, parsed)
                      }}
                      className="w-14 border-x border-border-default bg-background py-2 text-center text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxStock}
                      aria-label="+"
                      className="inline-flex size-11 items-center justify-center text-secondary hover:bg-surface-alt disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="inline-flex min-h-11 items-center gap-1 text-sm text-secondary hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('remove')}
                  </button>
                </div>
              </div>

              <p className="shrink-0 text-base font-bold text-price">
                {formatPrice(lineTotal(item), locale)}
              </p>
            </li>
          )
        })}
      </ul>

      <aside className="h-fit rounded-[--radius-surface] border border-border-default bg-surface p-4 lg:sticky lg:top-20">
        <h2 className="text-lg font-semibold text-heading">{t('title')}</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-body">{t('subtotal')}</dt>
            <dd className="font-medium text-heading">{formatPrice(subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-body">{t('shipping')}</dt>
            <dd className="text-muted">{t('shippingCalculated')}</dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-between border-t border-border-default pt-4">
          <span className="text-base font-semibold text-heading">{t('total')}</span>
          <span className="text-lg font-bold text-price">{formatPrice(subtotal, locale)}</span>
        </div>

        <Link
          href="/checkout"
          className={`${buttonVariants({ variant: 'primary', size: 'lg', block: true })} mt-4`}
        >
          {t('proceedToCheckout')}
        </Link>

        <Link
          href="/products"
          className={`${buttonVariants({ variant: 'quiet', block: true })} mt-2`}
        >
          {common('continueShopping')}
        </Link>
      </aside>
    </div>
  )
}
