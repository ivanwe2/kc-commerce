import { getTranslations, setRequestLocale } from 'next-intl/server'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('common')

  return (
    <div className="container py-28">
      <h1>{t('recommendedProducts')}</h1>
      <p>{t('browseProducts')}</p>
    </div>
  )
}
