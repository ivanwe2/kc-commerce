'use client'

/* eslint-disable no-restricted-syntax, @next/next/no-html-link-for-pages --
 * The only sanctioned exception to the no-hardcoded-colour rule.
 *
 * This boundary catches failures in the ROOT LAYOUT, so nothing it normally
 * depends on can be assumed: the theme stylesheet may never have loaded, and
 * the router may not be mounted. Semantic tokens would resolve to nothing and
 * <Link> could itself throw. Inline styles and a plain anchor are the only
 * things guaranteed to work here.
 *
 * These values are intentionally NOT part of the themeable palette — this page
 * should look like a plain browser error page, not a branded one.
 */

/**
 * Last-resort boundary for errors in the root layout itself.
 *
 * It must render its own <html> and <body> because the layout that normally
 * provides them is the thing that failed. For the same reason it cannot use
 * next-intl (no provider) or the theme stylesheet (not guaranteed loaded), so
 * the copy is bilingual and the styling inline.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="bg">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          color: '#334155',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            Възникна грешка / Something went wrong
          </h1>
          <p style={{ marginTop: '0.5rem' }}>
            Моля, опитайте отново по-късно. / Please try again later.
          </p>
          {error.digest && (
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              Ref: {error.digest}
            </p>
          )}
          <a href="/" style={{ display: 'inline-block', marginTop: '1.5rem', color: '#1e40af' }}>
            Начало / Home
          </a>
        </div>
      </body>
    </html>
  )
}
