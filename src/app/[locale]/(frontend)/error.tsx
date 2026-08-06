'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'

/**
 * Storefront error boundary.
 *
 * Shows nothing technical. `error.message` from a server component can carry
 * query fragments or internal paths, and a customer can neither act on it nor
 * be trusted with it. The digest is displayed because it is the only thing that
 * lets a support conversation be matched to a log line.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-heading">{t('genericTitle')}</h1>
      <p className="max-w-prose text-base text-body">{t('genericText')}</p>

      {error.digest && <p className="text-xs text-muted">Ref: {error.digest}</p>}

      <Button variant="primary" onClick={reset}>
        {t('tryAgain')}
      </Button>
    </main>
  )
}
