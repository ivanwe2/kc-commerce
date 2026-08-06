'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { buttonVariants } from '@/components/ui/Button'
import { Link } from '@/i18n/routing'

/**
 * Checkout-specific error boundary.
 *
 * Separate from the storefront one because the recovery action differs: a
 * customer whose checkout failed needs to get back to their cart with items
 * intact, not retry a render. The cart is untouched — order creation either
 * completed or released its stock — so returning to it is always safe.
 */
export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')
  const cart = useTranslations('cart')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-heading">{t('genericTitle')}</h1>
      <p className="max-w-prose text-base text-body">{t('orderFailed')}</p>

      {error.digest && <p className="text-xs text-muted">Ref: {error.digest}</p>}

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonVariants({ variant: 'primary' })}>
          {t('tryAgain')}
        </button>
        <Link href="/cart" className={buttonVariants({ variant: 'secondary' })}>
          {cart('viewCart')}
        </Link>
      </div>
    </main>
  )
}
