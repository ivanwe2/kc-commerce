import { getTranslations } from 'next-intl/server'

import { MediaImage } from '@/components/MediaImage'
import { PriceDisplay } from '@/components/product/PriceDisplay'
import { Badge } from '@/components/ui/Badge'
import { Link } from '@/i18n/routing'
import { displayPrice, isSaleActive } from '@/lib/discount'
import { lowestPrice } from '@/lib/pricing'
import type { PricingTier } from '@/lib/pricing'
import type { Product } from '@/payload-types'

/**
 * Product card. Server Component — there is nothing interactive here, so it
 * costs no client JavaScript.
 *
 * Price is the most visually prominent element by design: customers scanning a
 * grid are comparing prices, and burying it under the title makes them work.
 */
export async function ProductCard({
  product,
  locale,
  priority = false,
  referencePrice,
}: {
  product: Product
  locale: string
  priority?: boolean
  /**
   * The 30-day reference price, when this card is rendered in a context that
   * has already looked it up. Cards in a grid deliberately do NOT fetch it
   * themselves — that would be one query per card.
   */
  referencePrice?: number | null
}) {
  const t = await getTranslations('product')

  const tiers = (product.pricingTiers ?? []) as PricingTier[]
  const hasTiers = tiers.length > 0
  const onSale = isSaleActive(product)

  /**
   * The headline figure is the price for ONE unit, not the cheapest bulk tier.
   *
   * Showing "from €3.20" when a single unit costs €4.50 sends the customer to a
   * page displaying a different, higher number — and under the Consumer
   * Protection Act an advertised price should be one the buyer can actually
   * obtain. The bulk saving is advertised with a badge instead.
   */
  const unitPrice = displayPrice(product)
  const bestBulk = hasTiers ? lowestPrice(tiers, product.basePrice) : unitPrice
  const bulkSaving =
    hasTiers && bestBulk < unitPrice ? Math.round((1 - bestBulk / unitPrice) * 100) : 0

  const isOutOfStock = (product.stock ?? 0) <= 0

  const firstImage = product.images?.[0]?.image
  const category = typeof product.category === 'object' ? product.category : null

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[--radius-surface] border border-border-default bg-background shadow-raised transition-shadow duration-150 hover:shadow-floating">
      <div className="relative aspect-square bg-surface">
        <MediaImage
          media={firstImage}
          // Matches the responsive grid: 1 column on mobile, 2 on tablet,
          // 3 on desktop, 4 on wide. Wrong values here mean Cloudflare is asked
          // for the wrong width and the saving is lost.
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          className="p-4"
        />

        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Badge variant="danger">{t('outOfStock')}</Badge>
          </div>
        )}

        {!isOutOfStock && (
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {onSale && <Badge variant="danger">{t('onSale')}</Badge>}
            {bulkSaving > 0 && (
              <Badge variant="info">{t('bulkUpTo', { percent: bulkSaving })}</Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {category && <p className="text-xs text-muted">{category.title}</p>}

        <h3 className="line-clamp-2 text-base font-semibold text-heading">
          {/* The card is one link target, stretched across the whole article, so
              the entire card is clickable without nesting interactive elements. */}
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0">
            {product.title}
          </Link>
        </h3>

        <div className="mt-auto pt-2">
          <PriceDisplay
            price={unitPrice}
            reference={onSale ? referencePrice : null}
            locale={locale}
          />
        </div>
      </div>
    </article>
  )
}
