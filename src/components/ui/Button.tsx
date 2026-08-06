import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/lib/utils'

/**
 * Every variant resolves to a semantic token, never a literal colour — that is
 * what keeps a rebrand to a single file. See src/styles/theme.css.
 *
 * `min-h-11` (44px) on every size is not decoration: it is the minimum
 * comfortable touch target, and this component is used for "Add to cart" and
 * "Place order" on phones.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[--radius-control] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'border border-primary bg-background text-primary hover:bg-primary-subtle',
        ghost: 'text-primary hover:bg-surface-alt',
        danger: 'bg-danger text-primary-foreground hover:opacity-90',
        quiet: 'border border-border-default bg-background text-body hover:bg-surface-alt',
      },
      size: {
        sm: 'min-h-11 px-3 py-2 text-sm',
        md: 'min-h-11 px-4 py-2 text-base',
        lg: 'min-h-12 px-6 py-3 text-base',
        icon: 'min-h-11 min-w-11 p-2',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
}

/**
 * Exported so links can adopt button styling without an `asChild` slot
 * indirection — which would mean pulling in a Radix dependency purely to render
 * an anchor. On a 10MB Worker budget, that trade is not worth making.
 *
 *   <Link href="/products" className={buttonVariants({ variant: 'primary' })}>
 */
export { buttonVariants }
