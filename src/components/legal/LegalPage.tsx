import { RichText } from '@/components/RichText'
import { fillPlaceholders, LEGAL_CONTENT, PLACEHOLDER_WARNING } from '@/lib/legal-content'
import { findPageBySlug, getSettings, type StorefrontLocale } from '@/lib/payload'

/**
 * Renders a legal page.
 *
 * CMS content from the Pages collection wins when it exists; otherwise the
 * hardcoded template renders. The template is not a nicety — it guarantees the
 * legally mandated sections are present whether or not anyone has filled in the
 * CMS, so the site is never missing a required disclosure because of an empty
 * content field.
 */
export async function LegalPage({
  slug,
  documentKey,
  locale,
  children,
}: {
  slug: string
  documentKey: 'terms' | 'privacy' | 'cookies' | 'withdrawal'
  locale: StorefrontLocale
  children?: React.ReactNode
}) {
  const [page, settings] = await Promise.all([
    findPageBySlug(slug, locale),
    getSettings(locale),
  ])

  const lang = locale === 'en' ? 'en' : 'bg'
  const template = LEGAL_CONTENT[lang][documentKey]

  const values = {
    companyName: settings.companyName,
    uic: settings.registrationNumber,
    vat: settings.vatNumber,
    address: settings.registeredAddress,
    email: settings.contactEmail,
    phone: settings.contactPhone,
    updated: new Date().toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB'),
  }

  const hasCmsContent = Boolean(page?.content)

  return (
    <main className="container-page py-12">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-heading">{page?.title ?? template?.title}</h1>

        {template && (
          <p className="mt-1 text-sm text-muted">{fillPlaceholders(template.updated, values)}</p>
        )}

        {/*
          Visible while the copy is still provisional. Deliberately not hidden
          in a comment: a placeholder legal page that looks final is worse than
          one that admits what it is.
        */}
        {!hasCmsContent && (
          <p className="mt-4 rounded-[--radius-control] bg-warning-subtle px-3 py-2 text-sm text-warning-foreground">
            {PLACEHOLDER_WARNING[lang]}
          </p>
        )}

        {hasCmsContent ? (
          <div className="mt-8">
            <RichText data={page?.content} />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {template?.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-semibold text-heading">{section.heading}</h2>
                {section.body.map((paragraph, index) => (
                  <p key={index} className="mt-2 max-w-prose text-base leading-relaxed text-body">
                    {fillPlaceholders(paragraph, values)}
                  </p>
                ))}
              </section>
            ))}
          </div>
        )}

        {children}
      </article>
    </main>
  )
}
