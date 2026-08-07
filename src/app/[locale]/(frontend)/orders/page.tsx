import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { OrderLookup } from '@/components/orders/OrderLookup'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'orders' })
  // Indexable: customers search for "track my order" and should find this.
  return { title: t('trackOrder') }
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('orders')

  return (
    <main className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-heading">{t('trackOrder')}</h1>
        <p className="mt-2 text-base text-body">{t('trackOrderHint')}</p>
        <div className="mt-6">
          <OrderLookup />
        </div>
      </div>
    </main>
  )
}
