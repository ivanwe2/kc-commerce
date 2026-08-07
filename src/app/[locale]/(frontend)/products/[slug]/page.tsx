import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { AddToCartButton } from '@/components/product/AddToCartButton'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductGallery } from '@/components/product/ProductGallery'
import { PriceDisplay } from '@/components/product/PriceDisplay'
import { StockBadge } from '@/components/ui/Badge'
import { Link } from '@/i18n/routing'
import { displayPrice, isSaleActive, referencePrice } from '@/lib/discount'
import type { PricingTier } from '@/lib/pricing'
import {
  findProductBySlug,
  findRelatedProducts,
  getPayloadClient,
  type StorefrontLocale,
} from '@/lib/payload'

export const revalidate = 3600

/**
 * Pre-render product pages at build time.
 *
 * `select` keeps this to one column: at a few thousand products, fetching whole
 * documents here would read every row's full payload for nothing, and D1 bills
 * by rows read.
 */
export async function generateStaticParams() {
  const payload = await getPayloadClient()
  const products = await payload.find({
    collection: 'products',
    where: { isActive: { equals: true } },
    limit: 1000,
    depth: 0,
    select: { slug: true },
  })

  return products.docs
    .map((product) => product.slug)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const product = await findProductBySlug(slug, locale as StorefrontLocale)

  if (!product) return { title: 'Not found' }

  const description = product.seo?.metaDescription ?? product.shortDescription ?? undefined
  const image = product.images?.[0]?.image

  return {
    title: product.seo?.metaTitle ?? product.title,
    description,
    openGraph: {
      title: product.seo?.metaTitle ?? product.title,
      description,
      type: 'website',
      images:
        image && typeof image === 'object' && image.url ? [{ url: image.url }] : undefined,
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const storefrontLocale = locale as StorefrontLocale
  const product = await findProductBySlug(slug, storefrontLocale)

  if (!product) notFound()

  const t = await getTranslations('product')
  const common = await getTranslations('common')
  const units = await getTranslations('units')

  const related = await findRelatedProducts(product, storefrontLocale)
  const tiers = (product.pricingTiers ?? []) as PricingTier[]
  const stock = product.stock ?? 0
  const category = typeof product.category === 'object' ? product.category : null

  const firstImage = product.images?.[0]?.image
  const firstImageUrl =
    firstImage && typeof firstImage === 'object' ? (firstImage.url ?? null) : null

  const onSale = isSaleActive(product)
  const unitPrice = displayPrice(product)
  // Only looked up when a sale is running — it is a query, and there is nothing
  // to strike through otherwise.
  const reference = onSale ? await referencePrice(await getPayloadClient(), product) : null

  // Structured data. Priced from basePrice with lowPrice reflecting bulk tiers,
  // so search results do not advertise a price the customer cannot actually get
  // at quantity one.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription ?? undefined,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: unitPrice.toFixed(2),
      priceCurrency: 'EUR',
      availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: 'KC Trading' },
    },
  }

  return (
    <main className="container-page py-8">
      <script
        type="application/ld+json"
        // Serialised from our own database values, not user input. Still worth
        // noting: never interpolate untrusted strings into a script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-primary">
              {common('home')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/products" className="hover:text-primary">
              {common('products')}
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/categories/${category.slug}`} className="hover:text-primary">
                  {category.title}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images ?? []} title={product.title} />

        <div>
          <h1 className="text-2xl font-bold text-heading">{product.title}</h1>

          <p className="mt-1 text-sm text-muted">
            {t('sku')}: {product.sku}
          </p>

          {product.shortDescription && (
            <p className="mt-4 text-base text-body">{product.shortDescription}</p>
          )}

          <div className="mt-6">
            <PriceDisplay price={unitPrice} reference={reference} locale={locale} size="lg" />
            <p className="mt-1 text-sm text-muted">/ {units(product.unit ?? 'piece')}</p>
            {onSale && product.saleEndsAt && (
              <p className="mt-1 text-sm text-danger-foreground">
                {t('saleEndsIn', {
                  date: new Date(product.saleEndsAt).toLocaleDateString(
                    locale === 'bg' ? 'bg-BG' : 'en-GB',
                  ),
                })}
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <StockBadge
              stock={stock}
              lowStockThreshold={product.lowStockThreshold}
              labels={{
                inStock: t('inStock'),
                lowStock: t('lowStock'),
                outOfStock: t('outOfStock'),
              }}
            />
            {stock > 0 && (
              <span className="text-sm text-body">{t('stockCount', { count: stock })}</span>
            )}
          </div>

          {(product.minOrderQuantity ?? 1) > 1 && (
            <p className="mt-4 text-sm text-body">
              {t('minOrder', { count: product.minOrderQuantity ?? 1 })}
            </p>
          )}

          <div className="mt-6">
            <AddToCartButton
              disabled={stock <= 0}
              showTierTable
              item={{
                productId: product.id,
                slug: product.slug ?? '',
                title: product.title,
                image: firstImageUrl,
                // The cart prices from this, so it must be the sale price when
                // one is live — otherwise the cart quotes more than the page did.
                basePrice: unitPrice,
                maxStock: stock,
                minOrderQuantity: product.minOrderQuantity ?? 1,
                unit: product.unit ?? 'piece',
                pricingTiers: tiers,
              }}
            />
          </div>
        </div>
      </div>

      {product.description && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-heading">{t('description')}</h2>
          {/* Rich text rendering arrives with the Lexical serialiser in Phase 6,
              alongside the legal pages that need the same component. */}
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-heading">{t('relatedProducts')}</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
