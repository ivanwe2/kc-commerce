import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-alt text-secondary',
        info: 'bg-primary-subtle text-primary',
        success: 'bg-success-subtle text-success-foreground',
        warning: 'bg-warning-subtle text-warning-foreground',
        danger: 'bg-danger-subtle text-danger-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

/**
 * Stock state as a badge.
 *
 * Centralised because "in stock / low stock / out of stock" appears on cards,
 * on the detail page and in the cart, and the three must agree — a product
 * shown as available on the card and unavailable on its own page is the kind of
 * inconsistency that costs an order.
 */
export function StockBadge({
  stock,
  lowStockThreshold,
  labels,
}: {
  stock: number
  lowStockThreshold?: number | null
  labels: { inStock: string; lowStock: string; outOfStock: string }
}) {
  if (stock <= 0) return <Badge variant="danger">{labels.outOfStock}</Badge>

  const threshold = lowStockThreshold ?? 10
  if (stock <= threshold) return <Badge variant="warning">{labels.lowStock}</Badge>

  return <Badge variant="success">{labels.inStock}</Badge>
}
