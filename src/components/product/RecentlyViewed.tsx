'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { Link } from '@/i18n/routing'
import { formatPrice } from '@/lib/money'

const STORAGE_KEY = 'kc-recently-viewed'
const MAX_ITEMS = 8

/**
 * Subscribers are notified through a custom event as well as `storage`.
 *
 * `storage` only fires in OTHER tabs, so without the custom event the list
 * would not refresh in the tab that just recorded a view.
 */
const CHANGE_EVENT = 'kc-recently-viewed-change'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/**
 * Returns the raw string, not a parsed array.
 *
 * useSyncExternalStore compares snapshots by identity, so returning a freshly
 * parsed array on every call would loop forever. The string is stable when the
 * data has not changed; parsing happens in a memo downstream.
 */
function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export type ViewedProduct = {
  id: number
  slug: string
  title: string
  price: number
  image: string | null
}

/**
 * Records a product view. Called from the product page.
 *
 * localStorage rather than a cookie, deliberately: a cookie would be sent to
 * the server on every request and would need a consent category under the
 * ePrivacy Directive. localStorage stays on the device, never reaches us, and so
 * remains outside the consent banner entirely — a genuinely better privacy
 * position, not just a cheaper one.
 */
export function trackProductView(product: ViewedProduct): void {
  if (typeof window === 'undefined') return

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const existing: ViewedProduct[] = raw ? JSON.parse(raw) : []

    const next = [product, ...existing.filter((item) => item.id !== product.id)].slice(0, MAX_ITEMS)

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Private browsing or a full quota. Losing this history is not worth an error.
  }
}

/** Records the current product on mount. Renders nothing. */
export function TrackProductView({ product }: { product: ViewedProduct }) {
  useEffect(() => {
    trackProductView(product)
    // Keyed on id: re-tracking on every prop identity change would reorder the
    // list on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  return null
}

export function RecentlyViewed({ excludeId }: { excludeId?: number }) {
  const t = useTranslations('product')
  const locale = useLocale()

  // Server snapshot is null: SSR has no localStorage, and React reconciles the
  // difference itself rather than us setting state after mount.
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null)

  const items = useMemo(() => {
    if (!raw) return []
    try {
      const parsed: ViewedProduct[] = JSON.parse(raw)
      return parsed.filter((item) => item.id !== excludeId)
    } catch {
      return []
    }
  }, [raw, excludeId])

  if (items.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-heading">{t('recentlyViewed')}</h2>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/products/${item.slug}`}
              className="block rounded-[--radius-surface] border border-border-default bg-background p-2 transition-shadow hover:shadow-floating"
            >
              <div className="relative aspect-square bg-surface">
                {item.image && (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-contain p-1"
                  />
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium text-heading">{item.title}</p>
              <p className="text-sm font-bold text-price">{formatPrice(item.price, locale)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
