'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { usePathname } from '@/i18n/routing'
import { useOptimistic, useTransition } from 'react'

import { buttonVariants } from '@/components/ui/Button'
import type { Category } from '@/payload-types'

/**
 * Filter sidebar.
 *
 * All state lives in the URL rather than in component state. That makes a
 * filtered view shareable and bookmarkable, keeps the back button meaningful,
 * and lets the page stay a Server Component that reads searchParams — no
 * client-side product fetching, no loading spinner, no duplicated filter logic.
 */
export function ProductFilters({ categories }: { categories: Category[] }) {
  const t = useTranslations('filters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  /**
   * Optimistic filter state.
   *
   * The controls are driven by the URL, which only updates after the server
   * round-trip. Without this, ticking "in stock only" leaves the checkbox
   * visibly unticked until the new page arrives — it reads as a broken control,
   * and users click it again. Playwright caught exactly this: `.check()` failed
   * because the checkbox did not reflect its own click.
   *
   * The optimistic value shows the intent immediately and is reconciled when the
   * real searchParams land.
   */
  const [optimisticParams, applyOptimistic] = useOptimistic(
    searchParams,
    (current: URLSearchParams, update: { key: string; value: string | null }) => {
      const next = new URLSearchParams(current.toString())
      if (update.value === null || update.value === '') next.delete(update.key)
      else next.set(update.key, update.value)
      return next
    },
  )

  const update = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === null || value === '') params.delete(key)
    else params.set(key, value)

    // Any filter change invalidates the current page number — otherwise
    // narrowing a search from 10 pages to 1 leaves you on an empty page 7.
    params.delete('page')

    const query = params.toString()
    startTransition(() => {
      applyOptimistic({ key, value })
      router.push(query ? `${pathname}?${query}` : pathname)
    })
  }

  const hasFilters = ['q', 'category', 'min', 'max', 'inStock', 'onSale', 'sort'].some((key) =>
    searchParams.has(key),
  )

  return (
    <aside
      aria-label={t('title')}
      data-pending={isPending ? '' : undefined}
      className="h-fit space-y-6 rounded-[--radius-surface] border border-border-default bg-surface p-4 transition-opacity data-pending:opacity-60 lg:sticky lg:top-20"
    >
      <div>
        <label htmlFor="filter-search" className="mb-1.5 block text-sm font-medium text-body">
          {t('title')}
        </label>
        <input
          id="filter-search"
          type="search"
          defaultValue={searchParams.get('q') ?? ''}
          onBlur={(event) => update('q', event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') update('q', event.currentTarget.value)
          }}
          className="w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="filter-category" className="mb-1.5 block text-sm font-medium text-body">
          {t('category')}
        </label>
        <select
          id="filter-category"
          value={optimisticParams.get('category') ?? ''}
          onChange={(event) => update('category', event.target.value || null)}
          className="w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:outline-none"
        >
          <option value="">—</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug ?? ''}>
              {category.title}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-body">{t('priceRange')}</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            aria-label={t('minPrice')}
            placeholder={t('minPrice')}
            defaultValue={searchParams.get('min') ?? ''}
            onBlur={(event) => update('min', event.target.value)}
            className="w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:outline-none"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            aria-label={t('maxPrice')}
            placeholder={t('maxPrice')}
            defaultValue={searchParams.get('max') ?? ''}
            onBlur={(event) => update('max', event.target.value)}
            className="w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:outline-none"
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <input
          id="filter-sale"
          type="checkbox"
          checked={optimisticParams.get('onSale') === '1'}
          onChange={(event) => update('onSale', event.target.checked ? '1' : null)}
          className="size-4 rounded border-border-strong text-primary focus:ring-primary/20"
        />
        <label htmlFor="filter-sale" className="text-sm text-body">
          {t('onSaleFilter')}
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="filter-stock"
          type="checkbox"
          checked={optimisticParams.get('inStock') === '1'}
          onChange={(event) => update('inStock', event.target.checked ? '1' : null)}
          className="size-4 rounded border-border-strong text-primary focus:ring-primary/20"
        />
        <label htmlFor="filter-stock" className="text-sm text-body">
          {t('inStockOnly')}
        </label>
      </div>

      <div>
        <label htmlFor="filter-sort" className="mb-1.5 block text-sm font-medium text-body">
          {t('sort')}
        </label>
        <select
          id="filter-sort"
          value={optimisticParams.get('sort') ?? 'newest'}
          onChange={(event) => update('sort', event.target.value)}
          className="w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:outline-none"
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="price_asc">{t('sortPriceAsc')}</option>
          <option value="price_desc">{t('sortPriceDesc')}</option>
          <option value="name_asc">{t('sortNameAsc')}</option>
        </select>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push(pathname))}
          className={buttonVariants({ variant: 'quiet', size: 'sm', block: true })}
        >
          {t('reset')}
        </button>
      )}
    </aside>
  )
}
