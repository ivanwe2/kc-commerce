import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { CartProvider } from '@/components/cart/CartProvider'
import { CookieConsent } from '@/components/legal/CookieConsent'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { routing } from '@/i18n/routing'
import type { StorefrontLocale } from '@/lib/payload'
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

  const nav = await getTranslations('nav')
  const skip = nav('skipToContent')

  return (
    <html lang={locale} className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <CartProvider />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[--radius-control] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {skip}
          </a>
          <Header locale={locale as StorefrontLocale} />
          <div id="main" className="flex-1">
            {children}
          </div>
          <Footer locale={locale as StorefrontLocale} />
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
