import { getTranslations } from 'next-intl/server'

import { formatPrice } from '@/lib/money'
import type { PricingTier } from '@/lib/pricing'
import { cn } from '@/lib/utils'

/**
 * Bulk pricing table.
 *
 * Shows the saving against the base price explicitly. Bulk buyers are the
 * higher-value customers here, and making them compute the discount themselves
 * is a good way to lose the larger order.
 */
export async function PricingTierTable({
  tiers,
  basePrice,
  locale,
  highlightQuantity,
  className,
}: {
  tiers: PricingTier[]
  basePrice: number
  locale: string
  highlightQuantity?: number
  className?: string
}) {
  const t = await getTranslations('product')

  if (tiers.length === 0) return null

  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-default text-left">
            <th scope="col" className="py-2 pr-4 font-medium text-secondary">
              {t('quantity')}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium text-secondary">
              {t('perUnit')}
            </th>
            <th scope="col" className="py-2 font-medium text-secondary">
              {t('price')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tier) => {
            const isActive =
              highlightQuantity != null &&
              highlightQuantity >= tier.minQuantity &&
              (tier.maxQuantity == null || highlightQuantity <= tier.maxQuantity)

            const savingPercent =
              basePrice > 0 ? Math.round((1 - tier.pricePerUnit / basePrice) * 100) : 0

            return (
              <tr
                key={`${tier.minQuantity}-${tier.pricePerUnit}`}
                className={cn(
                  'border-b border-border-default last:border-0',
                  isActive && 'bg-primary-subtle',
                )}
              >
                <td className="py-2 pr-4 text-body">
                  {tier.maxQuantity == null
                    ? t('tierRangeOpen', { min: tier.minQuantity })
                    : t('tierRange', { min: tier.minQuantity, max: tier.maxQuantity })}
                </td>
                <td className="py-2 pr-4 font-semibold text-price">
                  {formatPrice(tier.pricePerUnit, locale)}
                </td>
                <td className="py-2">
                  {savingPercent > 0 && (
                    <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-foreground">
                      {t('savePercent', { percent: savingPercent })}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
