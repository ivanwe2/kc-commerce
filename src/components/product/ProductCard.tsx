import { getTranslations } from 'next-intl/server'

import { MediaImage } from '@/components/MediaImage'
import { Badge } from '@/components/ui/Badge'
import { Link } from '@/i18n/routing'
import { formatPrice } from '@/lib/money'
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
}: {
  product: Product
  locale: string
  priority?: boolean
}) {
  const t = await getTranslations('product')

  const tiers = (product.pricingTiers ?? []) as PricingTier[]
  const hasTiers = tiers.length > 0
  const displayPrice = hasTiers ? lowestPrice(tiers, product.basePrice) : product.basePrice
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

        {hasTiers && !isOutOfStock && (
          <div className="absolute top-2 left-2">
            <Badge variant="info">{t('bulkPricing')}</Badge>
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
          <p className="text-lg font-bold text-price">
            {hasTiers && <span className="text-sm font-normal text-muted">{t('from')} </span>}
            {formatPrice(displayPrice, locale)}
          </p>
        </div>
      </div>
    </article>
  )
}
