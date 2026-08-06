import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ContactForm } from '@/components/legal/ContactForm'
import { getSettings, type StorefrontLocale } from '@/lib/payload'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: t('contact') }
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('common')
  const legal = await getTranslations('legal')
  const settings = await getSettings(locale as StorefrontLocale)

  return (
    <main className="container-page py-12">
      <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-2">
        <div>
          <h1 className="text-2xl font-bold text-heading">{t('contact')}</h1>

          <address className="mt-6 space-y-2 text-base text-body not-italic">
            {settings.companyName && (
              <p className="font-semibold text-heading">{settings.companyName}</p>
            )}
            {settings.registrationNumber && (
              <p>
                {legal('uic')}: {settings.registrationNumber}
              </p>
            )}
            {settings.vatNumber && (
              <p>
                {legal('vat')}: {settings.vatNumber}
              </p>
            )}
            {settings.address && <p className="whitespace-pre-line">{settings.address}</p>}
            {settings.contactEmail && (
              <p>
                <a href={`mailto:${settings.contactEmail}`} className="text-primary hover:underline">
                  {settings.contactEmail}
                </a>
              </p>
            )}
            {settings.contactPhone && (
              <p>
                <a href={`tel:${settings.contactPhone}`} className="text-primary hover:underline">
                  {settings.contactPhone}
                </a>
              </p>
            )}
          </address>
        </div>

        <ContactForm />
      </div>
    </main>
  )
}
