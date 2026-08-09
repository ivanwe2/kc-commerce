import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { MediaImage } from '@/components/MediaImage'
import { ProductCard } from '@/components/product/ProductCard'
import { referencePricesForMany } from '@/lib/discount'
import { collectSlugs } from '@/lib/staticParams'
import { Pagination } from '@/components/ui/Pagination'
import { Link } from '@/i18n/routing'
import { findBrandBySlug, findProducts, getPayloadClient, type StorefrontLocale } from '@/lib/payload'

export const revalidate = 3600

const PAGE_SIZE = 12

export async function generateStaticParams() {
  const payload = await getPayloadClient()
  return collectSlugs(payload, 'brands', { isActive: { equals: true } }, 200)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const brand = await findBrandBySlug(slug, locale as StorefrontLocale)
  if (!brand) return { title: 'Not found' }

  return { title: brand.name, description: brand.description ?? undefined }
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const brand = await findBrandBySlug(slug, locale as StorefrontLocale)
  if (!brand) notFound()

  const query = await searchParams
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page
  const page = Math.max(1, Number(rawPage ?? 1) || 1)

  const t = await getTranslations('product')
  const common = await getTranslations('common')

  const results = await findProducts({
    locale: locale as StorefrontLocale,
    brandIds: [brand.id],
    page,
    limit: PAGE_SIZE,
  })

  // One history query for the whole page, not one per card.
  const references = await referencePricesForMany(await getPayloadClient(), results.docs)

  return (
    <main className="container-page py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-primary">
              {common('home')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/brands" className="hover:text-primary">
              {common('brands')}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-4 flex items-center gap-4">
        {brand.logo && (
          <div className="relative size-16 shrink-0 bg-surface">
            <MediaImage media={brand.logo} sizes="64px" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-heading">{brand.name}</h1>
          {brand.description && <p className="mt-1 max-w-prose text-body">{brand.description}</p>}
        </div>
      </div>

      <p className="mt-2 text-sm text-muted">{t('productCount', { count: results.totalDocs })}</p>

      {results.docs.length === 0 ? (
        <div className="mt-6 rounded-[--radius-surface] border border-border-default bg-surface p-12 text-center">
          <p className="text-base text-body">{t('noProducts')}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.docs.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                priority={index < 4}
                referencePrice={references.get(product.id)}
              />
            ))}
          </div>
          <Pagination
            currentPage={results.page ?? 1}
            totalPages={results.totalPages ?? 1}
            className="mt-8"
          />
        </>
      )}
    </main>
  )
}
