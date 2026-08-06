import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CartContents } from '@/components/cart/CartContents'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'cart' })
  return {
    title: t('title'),
    // A cart is per-visitor and has no business in search results.
    robots: { index: false, follow: true },
  }
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('cart')

  return (
    <main className="container-page py-8">
      <h1 className="text-2xl font-bold text-heading">{t('title')}</h1>
      <div className="mt-6">
        <CartContents />
      </div>
    </main>
  )
}
