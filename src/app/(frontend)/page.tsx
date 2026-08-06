/**
 * Placeholder storefront.
 *
 * Phase 2 moves these routes under `[locale]`, Phase 3 replaces this with the
 * real homepage. It exists now so the scaffold is verifiably running — and it
 * doubles as a live check that the theme tokens resolve.
 */
export default function HomePage() {
  return (
    <main className="container-page py-12">
      <section className="rounded-[--radius-surface] border border-border-default bg-surface p-8">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Phase 0</p>
        <h1 className="mt-2 text-2xl font-bold text-heading">KC Trading</h1>
        <p className="mt-2 max-w-prose text-base text-body">
          Cloudflare Workers scaffold is running. Storefront arrives in Phase 3.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              the Payload admin is a separate application shell; a full document
              load is intentional rather than a client-side transition. */}
          <a
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-[--radius-control] bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Admin panel
          </a>
          <span className="inline-flex items-center rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-foreground">
            D1 + R2 bound
          </span>
        </div>
      </section>
    </main>
  )
}
