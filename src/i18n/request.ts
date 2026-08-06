import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale

  // Falling back rather than 404-ing on an unknown locale: a stale bookmark to a
  // locale we no longer serve should still show the shop.
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Bulgarian conventions for dates and numbers by default; the euro is the
    // currency across both locales since Bulgaria adopted it on 2026-01-01.
    formats: {
      number: {
        currency: {
          style: 'currency',
          currency: 'EUR',
        },
      },
    },
  }
})
