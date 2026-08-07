import { formatPrice } from '@/lib/money'
import { discountPercent } from '@/lib/discount'
import { cn } from '@/lib/utils'

/**
 * Price with an optional struck-through reference.
 *
 * One component for cards, detail pages and the cart, because the reference
 * price is legally defined and three implementations would eventually disagree
 * about it. The `reference` passed in must be the 30-day lowest price computed
 * by `referencePrice()` — not the base price, unless they happen to be equal.
 *
 * The old price is marked up with <s> rather than styled with line-through, so
 * screen readers announce it as superseded instead of reading two prices with
 * no indication which one applies.
 */
export function PriceDisplay({
  price,
  reference,
  locale,
  size = 'md',
  fromLabel,
  className,
}: {
  price: number
  reference?: number | null
  locale: string
  size?: 'sm' | 'md' | 'lg'
  fromLabel?: string
  className?: string
}) {
  const showReference = typeof reference === 'number' && reference > price
  const percent = showReference ? discountPercent(reference, price) : 0

  const priceSize = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  }[size]

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-bold', priceSize, showReference ? 'text-price-sale' : 'text-price')}>
        {fromLabel && <span className="text-sm font-normal text-muted">{fromLabel} </span>}
        {formatPrice(price, locale)}
      </span>

      {showReference && (
        <>
          <s className="text-sm text-price-old">{formatPrice(reference, locale)}</s>
          {percent > 0 && (
            <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger-foreground">
              −{percent}%
            </span>
          )}
        </>
      )}
    </div>
  )
}
