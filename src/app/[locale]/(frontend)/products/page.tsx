import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { BannerStrip } from '@/components/BannerStrip'
import { ProductFilters } from '@/components/product/ProductFilters'
import { ProductCard } from '@/components/product/ProductCard'
import { referencePricesForMany } from '@/lib/discount'
import { Pagination } from '@/components/ui/Pagination'
import {
  findBrands,
  findCategories,
  findProducts,
  getPayloadClient,
  type StorefrontLocale,
} from '@/lib/payload'

export const revalidate = 3600

const PAGE_SIZE = 12

/**
 * Whitelisted sorts. `sort` reaches the database, so accepting arbitrary values
 * would let a visitor sort by any column — including unindexed ones, which on
 * D1 is metered as well as slow.
 */
const SORT_MAP: Record<string, string> = {
  newest: '-createdAt',
  oldest: 'createdAt',
  price_asc: 'basePrice',
  price_desc: '-basePrice',
  name_asc: 'title',
  name_desc: '-title',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Multi-select values travel as one comma-separated parameter
 * (?category=cleaning,tools) rather than a repeated key.
 *
 * It keeps URLs short and readable, and means one parsing rule instead of
 * handling both `?category=a&category=b` and the single-value case separately.
 */
function multi(value: string | string[] | undefined): string[] {
  const raw = single(value)
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
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
  const categorySlugs = multi(query.category)
  const brandSlugs = multi(query.brand)
  const sortKey = single(query.sort) ?? 'newest'
  const inStockOnly = single(query.inStock) === '1'
  const onSaleOnly = single(query.onSale) === '1'
  const featuredOnly = single(query.featured) === '1'
  const minPrice = positiveNumber(single(query.min))
  const maxPrice = positiveNumber(single(query.max))

  const [categories, brands] = await Promise.all([
    findCategories(storefrontLocale),
    findBrands(storefrontLocale),
  ])

  // Slugs are resolved to ids here rather than queried by slug directly: the
  // lists are already loaded for the sidebar, so this costs no extra query.
  const selectedCategories = categories.filter((category) =>
    categorySlugs.includes(category.slug ?? ''),
  )
  const selectedBrands = brands.filter((brand) => brandSlugs.includes(brand.slug ?? ''))

  const results = await findProducts({
    locale: storefrontLocale,
    page,
    limit: PAGE_SIZE,
    search,
    categoryIds: selectedCategories.map((category) => category.id),
    brandIds: selectedBrands.map((brand) => brand.id),
    // Whitelisted rather than passed through: `sort` reaches the database, and
    // accepting arbitrary values lets a visitor sort by any column, including
    // ones that are not indexed and would scan the table.
    sort: SORT_MAP[sortKey] ?? SORT_MAP.newest,
    inStockOnly,
    onSaleOnly,
    featuredOnly,
    minPrice,
    maxPrice,
  })

  // One history query for the whole page, not one per card.
  const references = await referencePricesForMany(await getPayloadClient(), results.docs)

  return (
    <main className="container-page py-8">
      <BannerStrip placement="listing_top" locale={storefrontLocale} />

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
        </div>
      </div>
    </main>
  )
}
