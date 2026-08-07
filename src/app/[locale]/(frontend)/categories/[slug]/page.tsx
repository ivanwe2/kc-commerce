import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ProductCard } from '@/components/product/ProductCard'
import { referencePricesForMany } from '@/lib/discount'
import { Pagination } from '@/components/ui/Pagination'
import { Link } from '@/i18n/routing'
import {
  findCategoryBySlug,
  findProducts,
  getPayloadClient,
  type StorefrontLocale,
} from '@/lib/payload'

export const revalidate = 3600

const PAGE_SIZE = 12

export async function generateStaticParams() {
  const payload = await getPayloadClient()
  const categories = await payload.find({
    collection: 'categories',
    where: { isActive: { equals: true } },
    limit: 200,
    depth: 0,
    select: { slug: true },
  })

  return categories.docs
    .map((category) => category.slug)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const category = await findCategoryBySlug(slug, locale as StorefrontLocale)

  if (!category) return { title: 'Not found' }

  return {
    title: category.title,
    description: category.description ?? undefined,
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const storefrontLocale = locale as StorefrontLocale
  const category = await findCategoryBySlug(slug, storefrontLocale)

  if (!category) notFound()

  const query = await searchParams
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page
  const page = Math.max(1, Number(rawPage ?? 1) || 1)

  const t = await getTranslations('product')
  const common = await getTranslations('common')

  const results = await findProducts({
    locale: storefrontLocale,
    categoryId: category.id,
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
            <Link href="/categories" className="hover:text-primary">
              {common('categories')}
            </Link>
          </li>
        </ol>
      </nav>

      <h1 className="mt-4 text-2xl font-bold text-heading">{category.title}</h1>
      {category.description && <p className="mt-2 max-w-prose text-body">{category.description}</p>}

      <p className="mt-1 text-sm text-muted">{t('productCount', { count: results.totalDocs })}</p>

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
                referencePrice={references.get(product.id)}
                priority={index < 4}
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
