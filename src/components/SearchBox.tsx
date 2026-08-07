'use client'

import { Search, X } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'

import { useRouter } from '@/i18n/routing'
import { formatPrice } from '@/lib/money'
import { cn } from '@/lib/utils'

type Hit = {
  id: number
  slug: string
  title: string
  sku: string
  price: number
  image: string | null
}

/**
 * Header search with an autocomplete dropdown.
 *
 * Implemented as a combobox rather than a plain input, because a results list
 * that only exists visually is unusable with a keyboard or a screen reader.
 * Arrow keys move through results, Enter opens the highlighted one, Escape
 * closes, and aria-activedescendant announces the selection.
 */
export function SearchBox({ className }: { className?: string }) {
  const t = useTranslations('common')
  const productT = useTranslations('product')
  const locale = useLocale()
  const router = useRouter()

  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)

  /**
   * Debounced fetch. 250ms is long enough to skip most intermediate keystrokes
   * and short enough that results feel immediate.
   *
   * No setState runs synchronously in this effect body — that triggers a
   * cascading render, and the lint rule flags it. `isLoading` is set in the
   * change handler where the user action actually happens, and a short query
   * simply performs no fetch: the dropdown is already gated on length, so there
   * is nothing to clear.
   */
  useEffect(() => {
    if (query.trim().length < 2) return

    const timer = setTimeout(async () => {
      // Cancel the previous request: without this, a slow early response can
      // land after a fast later one and overwrite newer results.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&locale=${locale}`,
          { signal: controller.signal },
        )
        const data = (await response.json()) as { results: Hit[] }
        setHits(data.results)
        setActiveIndex(-1)
      } catch {
        // Aborted or failed: leave the previous results rather than flashing empty.
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query, locale])

  // Close when focus or the pointer leaves the component.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const goTo = (hit: Hit) => {
    setIsOpen(false)
    setQuery('')
    router.push(`/products/${hit.slug}`)
  }

  const submit = () => {
    if (!query.trim()) return
    setIsOpen(false)
    router.push(`/products?q=${encodeURIComponent(query.trim())}`)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => Math.min(index + 1, hits.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const hit = hits[activeIndex]
      if (hit) goTo(hit)
      else submit()
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const showDropdown = isOpen && query.trim().length >= 2

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-label={t('search')}
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(event) => {
            const value = event.target.value
            setQuery(value)
            setIsOpen(true)
            if (value.trim().length >= 2) setIsLoading(true)
            else setHits([])
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-[--radius-control] border border-border-default bg-background pr-9 pl-9 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => {
              setQuery('')
              setHits([])
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-primary"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-[--radius-surface] border border-border-default bg-background shadow-overlay">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">
              {isLoading ? t('loading') : productT('noProducts')}
            </p>
          ) : (
            <>
              <ul id={listId} role="listbox" aria-label={t('search')}>
                {hits.map((hit, index) => (
                  <li
                    key={hit.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => goTo(hit)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2',
                      index === activeIndex && 'bg-surface-alt',
                    )}
                  >
                    <div className="relative size-10 shrink-0 overflow-hidden rounded bg-surface">
                      {hit.image && (
                        <Image
                          src={hit.image}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-contain p-0.5"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-heading">{hit.title}</p>
                      <p className="text-xs text-muted">{hit.sku}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-price">
                      {formatPrice(hit.price, locale)}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={submit}
                className="w-full border-t border-border-default px-4 py-2 text-left text-sm font-medium text-primary hover:bg-surface-alt"
              >
                {t('viewAll')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
