'use client'

import { useTranslations } from 'next-intl'
import { useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/Button'
import { Link } from '@/i18n/routing'

const CONSENT_COOKIE = 'kc-cookie-consent'
const ONE_YEAR = 60 * 60 * 24 * 365

type Consent = {
  necessary: true
  analytics: boolean
  marketing: boolean
  timestamp: string
}

function readConsentRaw(): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${CONSENT_COOKIE}=`))
  return match ?? null
}

/**
 * Whether a decision has already been recorded.
 *
 * `useSyncExternalStore` rather than reading the cookie in an effect: the
 * server snapshot is null (no cookie access during SSR) and the client snapshot
 * is the real value, so React reconciles the difference itself. Doing this with
 * useEffect + setState would render the banner and then hide it, flashing it at
 * every visitor who already decided.
 */
const subscribe = () => () => {}

function useHasDecided(): boolean {
  const cookie = useSyncExternalStore(
    subscribe,
    readConsentRaw,
    () => null,
  )
  return cookie !== null
}

function writeConsent(consent: Consent) {
  const value = encodeURIComponent(JSON.stringify(consent))
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`
}

/**
 * Cookie consent banner.
 *
 * The site currently sets only strictly necessary cookies — locale, this
 * consent record, and the admin session — so under the ePrivacy Directive no
 * consent is legally required today. The banner exists anyway because the
 * categories and the plumbing must be in place *before* anything non-essential
 * is added; retrofitting consent after adding analytics is how sites end up
 * having collected data they had no basis for.
 *
 * Analytics and marketing therefore default to OFF and stay off until a real
 * choice is made. No non-essential cookie is set before consent, because there
 * are none to set.
 */
export function CookieConsent() {
  const t = useTranslations('legal')
  const hasDecided = useHasDecided()
  const [justDecided, setJustDecided] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  if (hasDecided || justDecided) return null

  const decide = (choice: { analytics: boolean; marketing: boolean }) => {
    writeConsent({
      necessary: true,
      analytics: choice.analytics,
      marketing: choice.marketing,
      timestamp: new Date().toISOString(),
    })
    setJustDecided(true)
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-default bg-background shadow-overlay"
    >
      <div className="container-page py-4">
        <h2 id="cookie-title" className="text-base font-semibold text-heading">
          {t('cookieTitle')}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-body">
          {t('cookieText')}{' '}
          <Link href="/cookies" className="text-primary hover:underline">
            {t('cookies')}
          </Link>
        </p>

        {showDetails && (
          <div className="mt-4 space-y-2 rounded-[--radius-surface] border border-border-default bg-surface p-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked disabled className="mt-0.5 size-4" />
              <span>
                <span className="font-medium text-heading">{t('cookieNecessary')}</span>
                <span className="block text-xs text-muted">{t('cookieNecessaryDesc')}</span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-0.5 size-4 rounded border-border-strong text-primary"
              />
              <span className="font-medium text-heading">{t('cookieAnalytics')}</span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="mt-0.5 size-4 rounded border-border-strong text-primary"
              />
              <span className="font-medium text-heading">{t('cookieMarketing')}</span>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => decide({ analytics: true, marketing: true })}>
            {t('cookieAccept')}
          </Button>
          <Button variant="quiet" onClick={() => decide({ analytics: false, marketing: false })}>
            {t('cookieReject')}
          </Button>

          {showDetails ? (
            <Button variant="ghost" onClick={() => decide({ analytics, marketing })}>
              {t('cookieSave')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setShowDetails(true)}>
              {t('cookieCustomize')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
