import { PackageCheck, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { MediaImage } from '@/components/MediaImage'
import { ProductCard } from '@/components/product/ProductCard'
import { buttonVariants } from '@/components/ui/Button'
import { Link } from '@/i18n/routing'
import { findCategories, findProducts, getSettings, type StorefrontLocale } from '@/lib/payload'

// Rebuilt at most twice an hour. Featured products and categories change rarely,
// and on a metered platform re-rendering identical markup per request is waste.
export const revalidate = 1800

const TRUST_SIGNALS = [
  { key: 'shipping', Icon: Truck },
  { key: 'cod', Icon: PackageCheck },
  { key: 'returns', Icon: RotateCcw },
  { key: 'quality', Icon: ShieldCheck },
] as const

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const storefrontLocale = locale as StorefrontLocale
  const t = await getTranslations('common')
  const productT = await getTranslations('product')
  const trust = await getTranslations('trust')

  const [settings, featured, categories, onSale] = await Promise.all([
    getSettings(storefrontLocale),
    findProducts({ locale: storefrontLocale, featuredOnly: true, limit: 8 }),
    findCategories(storefrontLocale),
    findProducts({ locale: storefrontLocale, onSaleOnly: true, limit: 4 }),
  ])

  return (
    <main>
      {settings.announcementBar?.isActive && settings.announcementBar.text && (
        <div className="bg-primary-subtle">
          <div className="container-page py-2 text-center text-sm font-medium text-primary">
            {settings.announcementBar.link ? (
              <Link href={settings.announcementBar.link}>{settings.announcementBar.text}</Link>
            ) : (
              settings.announcementBar.text
            )}
          </div>
        </div>
      )}

      <section className="bg-surface">
        <div className="container-page flex max-h-[400px] flex-col items-center gap-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-heading sm:text-3xl">
            {settings.heroHeading ?? 'Качествени стоки на едро и дребно'}
          </h1>
          {settings.heroSubheading && (
            <p className="max-w-2xl text-base text-body">{settings.heroSubheading}</p>
          )}
          <Link href="/products" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            {t('products')}
          </Link>
        </div>
      </section>

      {/*
        Sale section sits above featured: a live promotion is the most
        time-sensitive thing on the page, and burying it below the evergreen
        featured grid wastes it. Rendered only when something is actually on
        sale, so the homepage never shows an empty "Offers" heading.
      */}
      {onSale.docs.length > 0 && (
        <section className="container-page py-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold text-heading">{productT('saleSection')}</h2>
            <Link
              href="/products?onSale=1"
              className="text-sm font-medium text-primary hover:underline"
            >
              {productT('viewAllSales')}
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {onSale.docs.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                priority={index < 4}
              />
            ))}
          </div>
        </section>
      )}

      {featured.docs.length > 0 && (
        <section className="container-page py-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold text-heading">{productT('featured')}</h2>
            <Link href="/products" className="text-sm font-medium text-primary hover:underline">
              {t('viewAll')}
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.docs.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                // Only the first row is above the fold; eager-loading the rest
                // would compete with it for bandwidth and hurt LCP.
                priority={index < 4}
              />
            ))}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="bg-surface">
          <div className="container-page py-12">
            <h2 className="text-xl font-semibold text-heading">{t('categories')}</h2>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.slice(0, 8).map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group overflow-hidden rounded-[--radius-surface] border border-border-default bg-background shadow-raised transition-shadow hover:shadow-floating"
                >
                  <div className="relative aspect-[4/3] bg-surface-alt">
                    <MediaImage
                      media={category.image}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-heading">{category.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-page py-12">
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_SIGNALS.map(({ key, Icon }) => (
            <div key={key} className="flex gap-3">
              <Icon className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-base font-semibold text-heading">{trust(key)}</dt>
                <dd className="mt-1 text-sm text-body">{trust(`${key}Desc`)}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </main>
  )
}
