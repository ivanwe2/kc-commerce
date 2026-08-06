'use client'

import { useLocale } from 'next-intl'
import { useTransition } from 'react'

import { Link, usePathname } from '@/i18n/routing'
import { LOCALES } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const LABELS: Record<string, string> = {
  bg: 'BG',
  en: 'EN',
}

/**
 * BG | EN toggle.
 *
 * Rendered as real links rather than a JavaScript-driven control so that the
 * alternate language is crawlable and works without hydration. `usePathname`
 * from the i18n routing helpers returns the pathname *without* the locale
 * prefix, so switching preserves the page the visitor is on instead of dumping
 * them back on the homepage.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname()
  const activeLocale = useLocale()
  const [isPending, startTransition] = useTransition()

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="group"
      aria-label="Language"
      data-pending={isPending ? '' : undefined}
    >
      {LOCALES.map((locale) => {
        const isActive = locale === activeLocale

        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => startTransition(() => {})}
            className={cn(
              // 44px minimum touch target — this sits in the header where it is
              // easy to make too small to tap on a phone.
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[--radius-control] px-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-subtle text-primary'
                : 'text-secondary hover:bg-surface-alt hover:text-primary',
            )}
          >
            {LABELS[locale] ?? locale.toUpperCase()}
          </Link>
        )
      })}
    </div>
  )
}
