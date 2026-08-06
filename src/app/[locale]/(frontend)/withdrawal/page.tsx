import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { LegalPage } from '@/components/legal/LegalPage'
import { WithdrawalForm } from '@/components/legal/WithdrawalForm'
import type { StorefrontLocale } from '@/lib/payload'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'legal' })
  return { title: t('withdrawal') }
}

export default async function WithdrawalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <LegalPage slug="withdrawal" documentKey="withdrawal" locale={locale as StorefrontLocale}>
      <WithdrawalForm />
    </LegalPage>
  )
}
