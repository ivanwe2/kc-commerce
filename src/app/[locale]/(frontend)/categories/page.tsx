import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { MediaImage } from '@/components/MediaImage'
import { Link } from '@/i18n/routing'
import { findCategories, type StorefrontLocale } from '@/lib/payload'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: t('categories') }
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('common')
  const categories = await findCategories(locale as StorefrontLocale)

  // Only roots at this level; children are reachable from their parent's page.
  const roots = categories.filter((category) => !category.parent)

  return (
    <main className="container-page py-8">
      <h1 className="text-2xl font-bold text-heading">{t('categories')}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {roots.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group overflow-hidden rounded-[--radius-surface] border border-border-default bg-background shadow-raised transition-shadow hover:shadow-floating"
          >
            <div className="relative aspect-[4/3] bg-surface">
              <MediaImage
                media={category.image}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </div>
            <div className="p-3">
              <h2 className="text-sm font-semibold text-heading">{category.title}</h2>
              {category.description && (
                <p className="mt-1 line-clamp-2 text-xs text-body">{category.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
