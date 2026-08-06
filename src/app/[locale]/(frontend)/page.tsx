import { getTranslations, setRequestLocale } from 'next-intl/server'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'

/**
 * Placeholder storefront. Phase 3 replaces this with the real homepage.
 *
 * It exists now to prove the locale routing end to end: Bulgarian at `/`,
 * English at `/en`, with the switcher preserving the current path.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('common')
  const trust = await getTranslations('trust')

  return (
    <main className="container-page py-12">
      <section className="rounded-[--radius-surface] border border-border-default bg-surface p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Phase 2</p>
            <h1 className="mt-2 text-2xl font-bold text-heading">KC Trading</h1>
          </div>
          <LanguageSwitcher />
        </div>

        <p className="mt-2 max-w-prose text-base text-body">
          {t('loading')} — {t('products')}, {t('categories')}, {t('cart')}, {t('checkout')}
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['shipping', 'cod', 'returns', 'quality'] as const).map((key) => (
            <div
              key={key}
              className="rounded-[--radius-surface] border border-border-default bg-background p-4"
            >
              <dt className="text-sm font-semibold text-heading">{trust(key)}</dt>
              <dd className="mt-1 text-sm text-body">{trust(`${key}Desc`)}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              the Payload admin is a separate application shell; a full document
              load is intentional rather than a client-side transition. */}
          <a
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-[--radius-control] bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Admin panel
          </a>
        </div>
      </section>
    </main>
  )
}
