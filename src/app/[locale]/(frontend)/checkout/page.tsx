import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CheckoutForm } from '@/components/checkout/CheckoutForm'
import { getSettings, type StorefrontLocale } from '@/lib/payload'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'checkout' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('checkout')
  const settings = await getSettings(locale as StorefrontLocale)

  // Rates are passed in for display only; the server action reads them again
  // from Settings when it computes what the customer actually owes.
  const shippingRates = settings.shippingRates
  const rates = {
    econt_office: shippingRates?.econtOffice ?? 3.5,
    econt_address: shippingRates?.econtAddress ?? 5,
    speedy_office: shippingRates?.speedyOffice ?? 3.5,
    speedy_address: shippingRates?.speedyAddress ?? 5,
    freeShippingThreshold: shippingRates?.freeShippingThreshold ?? null,
  }

  return (
    <main className="container-page py-8">
      <h1 className="text-2xl font-bold text-heading">{t('title')}</h1>
      <div className="mt-6">
        <CheckoutForm rates={rates} />
      </div>
    </main>
  )
}
