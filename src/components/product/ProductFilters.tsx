'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'

import { buttonVariants } from '@/components/ui/Button'
import { usePathname, useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import type { Brand, Category } from '@/payload-types'

/**
 * Catalogue filters.
 *
 * All state lives in the URL rather than component state. That makes a filtered
 * view shareable and bookmarkable, keeps the back button meaningful, and lets
 * the page stay a Server Component reading searchParams — no client-side
 * product fetching and no duplicated filter logic.
 *
 * Multi-select values travel as one comma-separated parameter
 * (?category=cleaning,tools) rather than repeated keys: shorter URLs, and one
 * parsing rule instead of two.
 */

const MULTI_KEYS = ['category', 'brand'] as const
const TOGGLE_KEYS = ['featured', 'onSale', 'inStock'] as const
const ALL_KEYS = ['q', 'category', 'brand', 'min', 'max', 'inStock', 'onSale', 'featured', 'sort']

export function ProductFilters({
  categories,
  brands,
}: {
  categories: Category[]
  brands: Brand[]
}) {
  const t = useTranslations('filters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  /**
   * Optimistic state so a control reflects its own click immediately.
   *
   * Without it a checkbox stays visibly unticked until the server round-trip
   * returns, which reads as a broken control and makes people click twice.
   */
  const [optimistic, applyOptimistic] = useOptimistic(
    searchParams,
    (current: URLSearchParams, update: { key: string; value: string | null }) => {
      const next = new URLSearchParams(current.toString())
      if (update.value === null || update.value === '') next.delete(update.key)
      else next.set(update.key, update.value)
      return next
    },
  )

  const commit = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '') params.delete(key)
    else params.set(key, value)

    // Any filter change invalidates the page number — otherwise narrowing from
    // 10 pages to 1 strands you on an empty page 7.
    params.delete('page')

    const query = params.toString()
    startTransition(() => {
      applyOptimistic({ key, value })
      router.push(query ? `${pathname}?${query}` : pathname)
    })
  }

  const values = (key: string) => (optimistic.get(key) ?? '').split(',').filter(Boolean)

  /** Add or remove one value from a comma-separated multi-select parameter. */
  const toggleValue = (key: string, value: string) => {
    const current = values(key)
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]
    commit(key, next.join(','))
  }

  const activeChips: { key: string; value: string | null; label: string }[] = [
    ...MULTI_KEYS.flatMap((key) =>
      values(key).map((slug) => {
        const label =
          key === 'category'
            ? String(categories.find((entry) => entry.slug === slug)?.title ?? slug)
            : String(brands.find((entry) => entry.slug === slug)?.name ?? slug)

        return {
          key: key as string,
          // Removing one value from a multi-select must keep the others.
          value: values(key)
            .filter((entry) => entry !== slug)
            .join(','),
          label,
        }
      }),
    ),
    ...TOGGLE_KEYS.filter((key) => optimistic.get(key) === '1').map((key) => ({
      key: key as string,
      value: null,
      label: t(`${key}Filter` as 'inStockFilter'),
    })),
    ...(optimistic.get('q') ? [{ key: 'q', value: null, label: `"${optimistic.get('q')}"` }] : []),
    ...(optimistic.get('min') || optimistic.get('max')
      ? [
          {
            key: 'price',
            value: null,
            label: `${optimistic.get('min') ?? '0'} – ${optimistic.get('max') ?? '∞'} €`,
          },
        ]
      : []),
  ]

  const hasFilters = ALL_KEYS.some((key) => searchParams.has(key))

  const removeChip = (chip: { key: string; value: string | null }) => {
    if (chip.key === 'price') {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('min')
      params.delete('max')
      params.delete('page')
      const query = params.toString()
      startTransition(() => router.push(query ? `${pathname}?${query}` : pathname))
      return
    }
    commit(chip.key, chip.value)
  }

  const panel = (
    <FilterPanel
      t={t}
      categories={categories}
      brands={brands}
      values={values}
      optimistic={optimistic}
      commit={commit}
      toggleValue={toggleValue}
    />
  )

  return (
    <div>
      {/* Chips summarise what is applied and let one filter be removed without
          hunting for the control that set it. */}
      {activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={`${chip.key}-${chip.label}`}
              type="button"
              onClick={() => removeChip(chip)}
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary-subtle px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {chip.label}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
          {hasFilters && (
            <button
              type="button"
              onClick={() => startTransition(() => router.push(pathname))}
              className="min-h-8 text-xs font-medium text-secondary underline hover:text-primary"
            >
              {t('reset')}
            </button>
          )}
        </div>
      )}

      {/* Mobile gets a sheet. A stacked sidebar pushes the products off-screen
          entirely on a phone, which is the whole reason this exists. */}
      <MobileFilterSheet label={t('title')} activeCount={activeChips.length} applyLabel={t('apply')}>
        {panel}
      </MobileFilterSheet>

      <aside
        aria-label={t('title')}
        data-pending={isPending ? '' : undefined}
        className="hidden h-fit space-y-6 rounded-[--radius-surface] border border-border-default bg-surface p-4 transition-opacity data-pending:opacity-60 lg:sticky lg:top-20 lg:block"
      >
        {panel}
      </aside>
    </div>
  )
}

/** The controls themselves, rendered identically in the sidebar and the sheet. */
function FilterPanel({
  t,
  categories,
  brands,
  values,
  optimistic,
  commit,
  toggleValue,
}: {
  t: ReturnType<typeof useTranslations<'filters'>>
  categories: Category[]
  brands: Brand[]
  values: (key: string) => string[]
  optimistic: URLSearchParams
  commit: (key: string, value: string | null) => void
  toggleValue: (key: string, value: string) => void
}) {
  const inputClass =
    'w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none'

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="filter-search" className="mb-1.5 block text-sm font-medium text-body">
          {t('title')}
        </label>
        <input
          id="filter-search"
          type="search"
          defaultValue={optimistic.get('q') ?? ''}
          onBlur={(event) => commit('q', event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit('q', event.currentTarget.value)
          }}
          className={inputClass}
        />
      </div>

      <CheckboxGroup
        legend={t('category')}
        options={categories.map((category) => ({
          value: category.slug ?? '',
          label: String(category.title),
        }))}
        selected={values('category')}
        onToggle={(value) => toggleValue('category', value)}
      />

      {brands.length > 0 && (
        <CheckboxGroup
          legend={t('brand')}
          options={brands.map((brand) => ({ value: brand.slug ?? '', label: brand.name }))}
          selected={values('brand')}
          onToggle={(value) => toggleValue('brand', value)}
        />
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-body">{t('priceRange')}</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            aria-label={t('minPrice')}
            placeholder={t('minPrice')}
            defaultValue={optimistic.get('min') ?? ''}
            onBlur={(event) => commit('min', event.target.value)}
            className={inputClass}
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            aria-label={t('maxPrice')}
            placeholder={t('maxPrice')}
            defaultValue={optimistic.get('max') ?? ''}
            onBlur={(event) => commit('max', event.target.value)}
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-1.5 text-sm font-medium text-body">{t('showOnly')}</legend>
        {(['featured', 'onSale', 'inStock'] as const).map((key) => (
          <label
            key={key}
            htmlFor={`filter-${key}`}
            className="flex min-h-9 items-center gap-2 text-sm text-body"
          >
            <input
              id={`filter-${key}`}
              type="checkbox"
              checked={optimistic.get(key) === '1'}
              onChange={(event) => commit(key, event.target.checked ? '1' : null)}
              className="size-4 rounded border-border-strong text-primary focus:ring-primary/20"
            />
            {t(`${key}Filter` as 'inStockFilter')}
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="filter-sort" className="mb-1.5 block text-sm font-medium text-body">
          {t('sort')}
        </label>
        <select
          id="filter-sort"
          value={optimistic.get('sort') ?? 'newest'}
          onChange={(event) => commit('sort', event.target.value)}
          className={inputClass}
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="oldest">{t('sortOldest')}</option>
          <option value="price_asc">{t('sortPriceAsc')}</option>
          <option value="price_desc">{t('sortPriceDesc')}</option>
          <option value="name_asc">{t('sortNameAsc')}</option>
          <option value="name_desc">{t('sortNameDesc')}</option>
        </select>
      </div>
    </div>
  )
}

function CheckboxGroup({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-body">{legend}</legend>
      {/* Capped height so a long brand list cannot push the sort control out of
          reach; it scrolls within itself instead. */}
      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
        {options.map((option) => (
          <label key={option.value} className="flex min-h-9 items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="size-4 rounded border-border-strong text-primary focus:ring-primary/20"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Filter sheet for small screens, built on the native <dialog> element.
 *
 * Focus trapping, Escape-to-close and inert background content come from the
 * platform at zero bundle cost — the same reasoning as the mobile nav drawer.
 */
function MobileFilterSheet({
  label,
  activeCount,
  applyLabel,
  children,
}: {
  label: string
  activeCount: number
  applyLabel: string
  children: React.ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(buttonVariants({ variant: 'quiet', block: true }), 'justify-between')}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {label}
        </span>
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setIsOpen(false)
        }}
        className="m-0 mt-auto max-h-[85vh] w-full max-w-full rounded-t-[--radius-surface] bg-background p-0 backdrop:bg-heading/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <span className="font-semibold text-heading">{label}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[--radius-control] text-secondary hover:bg-surface-alt"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-y-auto p-4">{children}</div>

          <div className="border-t border-border-default p-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={buttonVariants({ variant: 'primary', block: true })}
            >
              {applyLabel}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
