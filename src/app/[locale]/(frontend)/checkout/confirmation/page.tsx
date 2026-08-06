import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { buttonVariants } from '@/components/ui/Button'
import { Link } from '@/i18n/routing'

export const metadata: Metadata = {
  // A confirmation page must never be indexed — it would leak order numbers
  // into search results.
  robots: { index: false, follow: false },
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const query = await searchParams
  const raw = Array.isArray(query.order) ? query.order[0] : query.order

  // Shape-check the order number rather than rendering whatever is in the URL.
  const orderNumber = raw && /^KC-\d{4}-\d{5}$/.test(raw) ? raw : null
  if (!orderNumber) redirect('/')

  const t = await getTranslations('confirmation')
  const common = await getTranslations('common')

  return (
    <main className="container-page py-16">
      <div className="mx-auto max-w-xl text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-heading">{t('title')}</h1>

        <p className="mt-4 text-sm text-body">{t('orderNumber')}</p>
        <p className="text-xl font-bold text-heading">{orderNumber}</p>

        <div className="mt-8 rounded-[--radius-surface] border border-border-default bg-surface p-6 text-left">
          <h2 className="text-base font-semibold text-heading">{t('whatNext')}</h2>
          <ol className="mt-3 space-y-2 text-sm text-body">
            <li>1. {t('step1')}</li>
            <li>2. {t('step2')}</li>
            <li>3. {t('step3')}</li>
          </ol>
        </div>

        <p className="mt-6 text-sm text-muted">
          {t('withdrawalInfo')}{' '}
          <Link href="/withdrawal" className="text-primary hover:underline">
            →
          </Link>
        </p>

        <Link href="/products" className={`${buttonVariants({ variant: 'primary' })} mt-8`}>
          {common('continueShopping')}
        </Link>
      </div>
    </main>
  )
}
