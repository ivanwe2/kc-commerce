import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { MediaImage } from '@/components/MediaImage'
import { Link } from '@/i18n/routing'
import { findBrands, type StorefrontLocale } from '@/lib/payload'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: t('brands') }
}

export default async function BrandsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('common')
  const brands = await findBrands(locale as StorefrontLocale)

  return (
    <main className="container-page py-8">
      <h1 className="text-2xl font-bold text-heading">{t('brands')}</h1>

      {brands.length === 0 ? (
        <p className="mt-6 text-body">{t('loading')}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/brands/${brand.slug}`}
              className="flex flex-col items-center gap-2 rounded-[--radius-surface] border border-border-default bg-background p-4 shadow-raised transition-shadow hover:shadow-floating"
            >
              <div className="relative h-16 w-full bg-surface">
                <MediaImage media={brand.logo} sizes="160px" />
              </div>
              <span className="text-sm font-semibold text-heading">{brand.name}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
