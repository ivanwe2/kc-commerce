import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { routing } from '@/i18n/routing'
import '@/styles/globals.css'

// Self-hosted and subset by next/font. Cyrillic is included because the primary
// audience reads Bulgarian — omitting it would fall back to a system font for
// most of the site's actual text.
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
})

/**
 * Pre-render both locales at build time rather than resolving them per request.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })

  return {
    title: {
      default: 'KC Trading',
      template: '%s | KC Trading',
    },
    description: t('searchPlaceholder'),
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Required for static rendering: without it, every page in this tree opts into
  // dynamic rendering the moment it reads a translation, which on a metered
  // platform means paying to re-render identical markup.
  setRequestLocale(locale)

  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
