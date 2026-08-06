import { createNavigation } from 'next-intl/navigation'
import { defineRouting } from 'next-intl/routing'

export const LOCALES = ['bg', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/**
 * Bulgarian is the primary language of this store; English is the secondary.
 *
 * `localePrefix: 'as-needed'` encodes that in the URLs themselves: Bulgarian
 * pages live at `/products`, English at `/en/products`. The Bulgarian customer —
 * the majority — gets clean, canonical URLs with no redirect hop, and the
 * default language is unambiguous to both users and crawlers.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'bg',
  localePrefix: 'as-needed',
  localeDetection: true,
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  },
})

/**
 * Locale-aware navigation primitives. Import these instead of next/link and
 * next/navigation anywhere inside the storefront — they carry the active locale
 * through automatically, so an English visitor stays in English when they click.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
