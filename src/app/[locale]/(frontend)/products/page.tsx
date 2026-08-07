import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ProductFilters } from '@/components/product/ProductFilters'
import { ProductCard } from '@/components/product/ProductCard'
import { Pagination } from '@/components/ui/Pagination'
import { findBrands, findCategories, findProducts, type StorefrontLocale } from '@/lib/payload'

export const revalidate = 3600

const PAGE_SIZE = 12

const SORT_MAP: Record<string, string> = {
  newest: '-createdAt',
  price_asc: 'basePrice',
  price_desc: '-basePrice',
  name_asc: 'title',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function positiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: t('products') }
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const storefrontLocale = locale as StorefrontLocale
  const query = await searchParams
  const t = await getTranslations('product')

  const page = Math.max(1, Number(single(query.page) ?? 1) || 1)
  const search = single(query.q)
  const categorySlug = single(query.category)
  const brandSlug = single(query.brand)
  const sortKey = single(query.sort) ?? 'newest'
  const inStockOnly = single(query.inStock) === '1'
  const onSaleOnly = single(query.onSale) === '1'
  const minPrice = positiveNumber(single(query.min))
  const maxPrice = positiveNumber(single(query.max))

  const [categories, brands] = await Promise.all([
    findCategories(storefrontLocale),
    findBrands(storefrontLocale),
  ])

  // Slugs are resolved to ids here rather than queried by slug directly: the
  // lists are already loaded for the sidebar, so this costs no extra query.
  const selectedCategory = categorySlug
    ? categories.find((category) => category.slug === categorySlug)
    : undefined
  const selectedBrand = brandSlug ? brands.find((brand) => brand.slug === brandSlug) : undefined

  const results = await findProducts({
    locale: storefrontLocale,
    page,
    limit: PAGE_SIZE,
    search,
    categoryId: selectedCategory?.id,
    brandId: selectedBrand?.id,
    // Whitelisted rather than passed through: `sort` reaches the database, and
    // accepting arbitrary values lets a visitor sort by any column, including
    // ones that are not indexed and would scan the table.
    sort: SORT_MAP[sortKey] ?? SORT_MAP.newest,
    inStockOnly,
    onSaleOnly,
    minPrice,
    maxPrice,
  })

  return (
    <main className="container-page py-8">
      <h1 className="text-2xl font-bold text-heading">
        {t('productCount', { count: results.totalDocs })}
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ProductFilters categories={categories} brands={brands} />

        <div>
          {results.docs.length === 0 ? (
            <div className="rounded-[--radius-surface] border border-border-default bg-surface p-12 text-center">
              <p className="text-base text-body">{t('noProducts')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.docs.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locale={locale}
                    priority={index < 3}
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
        </div>
      </div>
    </main>
  )
}
