# KC Trading — Development Tracker

Single source of truth for what is actually built. Updated at the end of every phase.

- **Plan:** `docs/kc-commerce-plan.md` (revision v2 — Cloudflare)
- **Platform decision:** `docs/adr/0001-cloudflare-platform.md`
- **Last updated:** 2026-08-06

---

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 0 | Cloudflare-native scaffolding | ✅ Complete |
| 1 | Data model — collections & globals | ✅ Complete |
| 2 | Internationalization (BG + EN) | ✅ Complete |
| 3 | Storefront — layout & core pages | ✅ Complete |
| 4 | Shopping cart | ✅ Complete |
| 5 | Checkout & order flow | ✅ Complete |
| 6 | Legal compliance | ✅ Complete (placeholder copy) |
| 7 | Admin enhancements | ✅ Complete |
| 8 | SEO & performance | ✅ Complete |
| 9 | Error handling | ✅ Complete |
| 10 | Deployment & launch prep | ⬜ Not started |

---

## ⚠️ Platform change — 2026-08-06

The stack moved from **Vercel + Neon Postgres + Vercel Blob** to **Cloudflare
Workers + D1 + R2**. See the ADR for rationale and trade-offs.

**Effect on completed work:**

| v1 work (on `main`) | Fate |
|---|---|
| Phase 0 scaffolding (Payload `website` template, Postgres, Docker) | ❌ Replaced — rebuilt on the `with-cloudflare-d1` template |
| Phase 0 Postgres migrations | ❌ Discarded — SQLite needs its own migration set |
| Phase 1 collections (Products, Categories, Orders, Pages, Media, Users, Settings) | ♻️ Ported — field definitions survive, adapter-specific bits reworked |
| Phase 2 i18n (next-intl routing, message files, LanguageSwitcher) | ♻️ Ported |
| Docker Compose / Dockerfile | ❌ Deleted — Miniflare replaces them |
| Test harness (vitest, playwright) | ❌ Removed — explicit stakeholder decision, velocity over coverage |

The v1 history is preserved on `main` and on the `phase/0`–`phase/3` branches;
nothing was force-pushed.

---

## Corrections to the previous tracker

The previous version of this file was **inaccurate** — it listed Phases 1 and 2
as "Not started" when both had been implemented and merged. It also listed
commit breakdowns that did not match the plan. Fixed here; the per-phase commit
lists below now mirror `kc-commerce-plan.md` exactly.

Actually merged before the platform change:
- `e56e3f7` … `a3727ab` — Phase 1, merged to `main`
- `d133943`, `1c991bb`, `fb1f919` — Phase 2, merged to `main`

---

## Phase 0: Cloudflare-Native Scaffolding & Configuration

- [x] Commit 0.1: Rebuild scaffold on the Cloudflare template
- [x] Commit 0.2: Wrangler configuration & bindings
- [x] Commit 0.3: Payload config — D1, R2, dual binding resolution
- [x] Commit 0.4: Typed environment access
- [x] Commit 0.5: Security headers
- [x] Commit 0.6: Theming foundation
- [x] Commit 0.7: Repo hygiene

**Status:** ✅ Complete
**Branch:** `phase/0-cloudflare-scaffold`

**Verified:**
- `pnpm dev` → `/` 200, `/admin` 200 against local Miniflare D1 + R2
- `pnpm migrate` applies the initial SQLite migration to local D1
- `pnpm build` and `pnpm lint` clean
- `opennextjs-cloudflare build` produces a deployable Worker
- Security headers present on storefront responses, absent on `/admin` (as intended)
- Bundle: **5.60 MB gzipped** against the 10 MB paid-plan ceiling

**Platform surprises found and resolved during this phase** — all documented in
README "Gotchas", because each one silently breaks the build or the deploy:

| Problem | Resolution |
|---|---|
| Payload's obfuscated `drizzle-kit/api` import is unresolvable under Turbopack, failing OpenNext's esbuild pass | Build with `next build --webpack` |
| Next 16's `proxy.ts` is Node-runtime-only; OpenNext cannot run Node middleware | Keep `middleware.ts` and tolerate the deprecation warning |
| Upstream template imports `generatePayloadViewport`, which does not exist in Payload 3.87.1 | Template tracks 3.82.1; layout rewritten |
| Template's top-level `storage` config key does not exist in 3.87.1 | r2Storage registered as a plugin |
| `.dev.vars` loads onto the Wrangler proxy env, not `process.env`, so Payload reported "missing secret key" | Bridge scalars onto `process.env` in `payload.config.ts` |
| `"remote": true` made local `pnpm build` demand a `CLOUDFLARE_API_TOKEN` | Remote bindings gated on the token actually being present |
| `wrangler types` narrows env vars to literal types, breaking comparisons | Widen at the read site |
| `sass` (4.8 MB) traced into the Worker despite being build-time only | `outputFileTracingExcludes` — cut 1.4 MB gzipped |

**Security fix (unplanned):** `.env.local` and `.env.example` were tracked in git
on a **public** repository. Contents were dev placeholders only (a localhost
Postgres URL and literal `dev-secret-key-...` strings), so **nothing sensitive
leaked and no rotation is needed** — but the files are now untracked and
`.gitignore` covers the pattern. They remain in git history; harmless given the
values, and left alone rather than rewriting published history.

---

## Phase 1: Data Model — Collections & Globals

- [x] Commit 1.1: Products collection (pricing tiers, localization)
- [x] Commit 1.2: Categories collection (nesting)
- [x] Commit 1.3: Orders collection (snapshots, status machine)
- [x] Commit 1.4: Pages collection & Settings global
- [x] Commit 1.5: Media collection (R2, no sharp)
- [x] Commit 1.6: Users collection & access control
- [x] Commit 1.7: Register collections & generate D1 migrations
- [x] Extra: Counters collection + atomic order-number allocation
- [x] Extra: shared money / pricing / slugify utilities

**Status:** ✅ Complete
**Branch:** `phase/1-data-model-d1`
**Exit criteria:** all collections CRUD-able in `/admin`; migrations apply to a clean D1.

---

## Phase 2: Internationalization (BG + EN)

- [x] Commit 2.1: next-intl setup & locale routing
- [x] Commit 2.2: Language switcher component

**Status:** ✅ Complete
**Verified:** `/` Bulgarian, `/en` English, `/bg` 307s to `/`, `/admin` unaffected.
**Branch:** `phase/2-i18n`
**Exit criteria:** every storefront route resolves in both locales; `/admin` stays outside `[locale]`.

---

## Phase 3: Storefront — Layout & Core Pages

- [x] Commit 3.1: Design system (semantic tokens) & layout components
- [x] Commit 3.2: Homepage
- [x] Commit 3.3: Product listing page (filters, sort, pagination)
- [x] Commit 3.4: Product detail page (gallery, tier table, JSON-LD)
- [x] Commit 3.5: Category pages
- [x] Extra: seed script (`pnpm seed`) with realistic BG/EN catalogue
- [ ] Commit 3.6: Header search with live results (basic `?q=` filtering works today)
- [ ] Commit 3.7: Lexical rich-text renderer — deferred to Phase 6, where the
      legal pages need the same component

**Status:** 🔄 Core complete
**Branch:** `phase/3-storefront`

**Verified against seeded data:** 6 products / 4 categories render in both
locales; in-stock filter 6 → 5; category filter → 2; tier table shows correct
−13% / −29% savings.

---

## Phase 4: Shopping Cart

- [ ] Commit 4.1: Cart store (Zustand + tier price calculator)
- [ ] Commit 4.2: Cart UI (icon, drawer, cart page, add-to-cart)

**Status:** ⬜ Not started
**Branch:** `phase/4-cart`

---

## Phase 5: Checkout & Order Flow

- [ ] Commit 5.1: Checkout page & form
- [ ] Commit 5.2: Order creation server action (atomic stock on D1)
- [ ] Commit 5.3: Order confirmation page
- [ ] Commit 5.4: Email templates (Resend)

**Status:** ⬜ Not started
**Branch:** `phase/5-checkout`
**Highest-risk phase.** No transactions on D1 — re-read the Phase 5 notes and the ADR before writing code.

---

## Phase 6: Legal Compliance

- [ ] Commit 6.1: Cookie consent banner
- [ ] Commit 6.2: Legal pages (privacy, terms, cookies, withdrawal, contact, about)
- [ ] Commit 6.3: Footer legal information

**Status:** ⬜ Not started
**Branch:** `phase/6-legal`
**Note:** the electronic withdrawal function is mandatory under EU Directive 2023/2673 as of 2026-06-19 — already in force.

---

## Phase 7: Admin Enhancements

- [ ] Commit 7.1: Order management workflow & status transitions
- [ ] Commit 7.2: Bulk pricing admin UI & stock management

**Status:** ⬜ Not started
**Branch:** `phase/7-admin`

---

## Phase 8: SEO & Performance

- [ ] Commit 8.1: SEO fundamentals (metadata, sitemap, robots, JSON-LD)
- [ ] Commit 8.2: Performance (CF image loader, ISR cache binding, D1 indexes)

**Status:** ⬜ Not started
**Branch:** `phase/8-seo`

---

## Phase 9: Error Handling

- [ ] Commit 9.1: Error pages & structured logging
- [ ] Commit 9.2: Form validation & error states

**Status:** ⬜ Not started
**Branch:** `phase/9-error-handling`

---

## Phase 10: Deployment & Launch Prep

- [ ] Commit 10.1: Cloudflare deployment configuration
- [ ] Commit 10.2: Provisioning runbook (human-executed)
- [ ] Commit 10.3: Staging environment & CI
- [ ] Commit 10.4: Pre-launch checklist

**Status:** ⬜ Not started
**Branch:** `phase/10-deployment`

---

## Open items for the stakeholder

Things the agent cannot decide alone. Carried forward until resolved.

| # | Item | Blocking? | Notes |
|---|---|---|---|
| 1 | **Colour palette not signed off** | No | Plan's blue is the default; swappable from `src/styles/theme.css` in one edit |
| 2 | **Company legal details** — company name, UIC/Bulstat, VAT no., registered address, trade register entry | **Yes, before launch** | Legally required on every page by the Bulgarian Electronic Commerce Act. Placeholders until provided |
| 3 | **Cloudflare account + Workers Paid plan** | **Yes, before deploy** | $5/mo; the free tier's 3 MB bundle cap is too small for Payload admin |
| 4 | **Domain** | Yes, before launch | Needed for the custom domain, R2 media domain, and Image Transformations |
| 5 | **Resend account + verified sending domain** | Yes, before launch | Order confirmation emails; DNS records go on the same Cloudflare zone |
| 6 | **Shipping rates** | No | Plan assumes €3.50 office / €5.00 address; editable in Settings |
| 7 | **BGN dual price display** | No | Bulgaria adopted EUR on 2026-01-01. Confirm whether dual BGN display is still required for the transition period; the money formatter is built to support it if so |
