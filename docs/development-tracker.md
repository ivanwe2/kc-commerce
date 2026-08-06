# KC Trading — Development Tracker

Single source of truth for what is actually built. Updated at the end of every phase.

- **Plan:** `docs/kc-commerce-plan.md` (revision v2 — Cloudflare)
- **Platform decision:** `docs/adr/0001-cloudflare-platform.md`
- **Last updated:** 2026-08-06

---

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 0 | Cloudflare-native scaffolding | 🔄 In progress (rebuild) |
| 1 | Data model — collections & globals | ⏳ Port pending |
| 2 | Internationalization (BG + EN) | ⏳ Port pending |
| 3 | Storefront — layout & core pages | ⬜ Not started |
| 4 | Shopping cart | ⬜ Not started |
| 5 | Checkout & order flow | ⬜ Not started |
| 6 | Legal compliance | ⬜ Not started |
| 7 | Admin enhancements | ⬜ Not started |
| 8 | SEO & performance | ⬜ Not started |
| 9 | Error handling | ⬜ Not started |
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

- [ ] Commit 0.1: Rebuild scaffold on the Cloudflare template
- [ ] Commit 0.2: Wrangler configuration & bindings
- [ ] Commit 0.3: Payload config — D1, R2, dual binding resolution
- [ ] Commit 0.4: Typed environment access
- [ ] Commit 0.5: Security headers
- [ ] Commit 0.6: Theming foundation
- [ ] Commit 0.7: Repo hygiene

**Status:** 🔄 In progress
**Branch:** `phase/0-cloudflare-scaffold`
**Exit criteria:** `pnpm dev` serves `/admin` against local D1 + R2 with no Docker; `pnpm build` clean.

---

## Phase 1: Data Model — Collections & Globals

- [ ] Commit 1.1: Products collection (pricing tiers, localization)
- [ ] Commit 1.2: Categories collection (nesting)
- [ ] Commit 1.3: Orders collection (snapshots, status machine)
- [ ] Commit 1.4: Pages collection & Settings global
- [ ] Commit 1.5: Media collection (R2, no sharp)
- [ ] Commit 1.6: Users collection & access control
- [ ] Commit 1.7: Register collections & generate D1 migrations

**Status:** ⏳ Port pending
**Branch:** `phase/1-data-model-d1`
**Exit criteria:** all collections CRUD-able in `/admin`; migrations apply to a clean D1.

---

## Phase 2: Internationalization (BG + EN)

- [ ] Commit 2.1: next-intl setup & locale routing
- [ ] Commit 2.2: Language switcher component

**Status:** ⏳ Port pending
**Branch:** `phase/2-i18n`
**Exit criteria:** every storefront route resolves in both locales; `/admin` stays outside `[locale]`.

---

## Phase 3: Storefront — Layout & Core Pages

- [ ] Commit 3.1: Design system (semantic tokens) & layout components
- [ ] Commit 3.2: Homepage
- [ ] Commit 3.3: Product listing page
- [ ] Commit 3.4: Product detail page
- [ ] Commit 3.5: Search

**Status:** ⬜ Not started
**Branch:** `phase/3-storefront`
**Exit criteria:** palette swappable from one file; 375px viewport verified.

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
