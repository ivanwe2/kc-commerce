import { getTranslations } from 'next-intl/server'

import { ProductCard } from '@/components/product/ProductCard'
import { Link } from '@/i18n/routing'
import type { Product } from '@/payload-types'

/**
 * A horizontally scrollable row of products.
 *
 * This is a SCROLL ROW, not a carousel, and the distinction is the reason it is
 * allowed here at all. The design rules ban carousels, and rightly: an
 * auto-advancing slider moves content out from under the reader, hides most of
 * its items behind a timer, and is awkward with a screen reader.
 *
 * A scroll row has none of those properties. Nothing moves on its own, every
 * item is reachable by swiping, tab, or arrow keys, it degrades to a plain
 * scrollable list without JavaScript, and its overflow is visible — the
 * partially-cut card at the right edge is what tells people there is more.
 *
 * Server Component: no client JavaScript, since native scrolling does the work.
 */
export async function ProductRow({
  title,
  products,
  viewAllHref,
  locale,
  referencePrices,
  priority = false,
}: {
  title: string
  products: Product[]
  viewAllHref?: string
  locale: string
  referencePrices?: Map<number, number>
  priority?: boolean
}) {
  const t = await getTranslations('common')

  if (products.length === 0) return null

  return (
    <section className="py-8">
      <div className="container-page flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold text-heading">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="shrink-0 text-sm font-medium text-primary hover:underline">
            {t('viewAll')}
          </Link>
        )}
      </div>

      {/*
        The scroller spans the full viewport width while its padding keeps the
        first card aligned with the page gutter. Constraining it to the
        container instead would clip the row at the container edge and lose the
        cut-off card that signals "there is more this way".
      */}
      <div
        className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:px-6 lg:px-8 [scrollbar-width:thin]"
        // A labelled, focusable region: keyboard users can tab to the row and
        // scroll it with arrow keys, which a plain overflow container does not
        // allow.
        role="region"
        aria-label={title}
        tabIndex={0}
      >
        {products.map((product, index) => (
          <div
            key={product.id}
            className="w-[70%] shrink-0 snap-start sm:w-[45%] lg:w-[30%] xl:w-[23%]"
          >
            <ProductCard
              product={product}
              locale={locale}
              priority={priority && index < 2}
              referencePrice={referencePrices?.get(product.id)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
