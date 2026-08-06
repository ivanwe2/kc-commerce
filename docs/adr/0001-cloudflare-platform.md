# ADR 0001 — Move the platform to Cloudflare end-to-end

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Ivan (stakeholder), Claude Code (implementing agent)
- **Supersedes:** the Vercel + Neon + Vercel Blob decision in plan v1

## Context

Phases 0–2 of KC Trading were built against the v1 plan: Payload CMS on Vercel,
PostgreSQL on Neon, media on Vercel Blob, local development on Docker Postgres.
That stack worked and was committed to `main`.

The stakeholder then decided to consolidate all infrastructure on Cloudflare.
The drivers were cost, having one vendor for DNS/CDN/WAF/compute/storage, and
avoiding per-GB egress on an image-heavy product catalogue.

Two questions had to be answered: whether Payload can genuinely run on Workers,
and what to do about the database.

## Decision

**Run the entire stack on Cloudflare:**

| Concern | Choice |
|---|---|
| Compute | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite) via `@payloadcms/db-d1-sqlite` |
| Object storage | Cloudflare R2 via `@payloadcms/storage-r2` |
| Image resizing | Cloudflare Image Transformations (`/cdn-cgi/image`) |
| Edge services | Cloudflare DNS, CDN, WAF, Bot Fight Mode |
| Email | Resend (unchanged — plain HTTPS, works on Workers) |

This is a supported configuration, not an improvisation: Payload publishes an
official `with-cloudflare-d1` template and first-party D1 and R2 adapters,
versioned in lockstep with core.

**Rebuild the scaffold rather than migrate it.** The existing code came from
Payload's `website` template, which carries a Pages block builder, live preview,
admin bar, form builder and redirect plugin that this store never uses. On
Workers that unused surface is not free — it counts against a hard 10 MB bundle
limit. The collections (Products, Categories, Orders, Pages, Media, Users,
Settings) are ported; the template scaffolding is not.

## Alternatives considered

**Neon Postgres behind Cloudflare Hyperdrive.** Keeps real interactive
transactions and the existing Postgres migrations. Rejected: it re-introduces a
second vendor, a connection string to protect, and ~$5–19/mo, which defeats the
stated goal of consolidating on Cloudflare. Recorded here because it is the
correct fallback if D1's write model ever becomes the bottleneck.

**Stay on Vercel.** Lowest effort, no rebuild. Rejected by the stakeholder on
cost (~$25/mo vs ~$5/mo) and vendor consolidation.

**Cloudflare Workers + external Postgres over TCP.** Rejected: worse than
Hyperdrive on every axis.

## Consequences

### Positive

- ~$5/month all-in versus ~$25, and **zero egress fees** as image traffic grows.
- **No database credentials and no storage tokens anywhere.** D1 and R2 are
  Worker bindings granted by the runtime. An entire class of secret-management
  and leak risk disappears.
- Local dev needs no Docker and no Postgres — Miniflare emulates D1 and R2, and
  the bindings are shape-identical to production.
- WAF, bot protection, and rate limiting sit in the same control plane as the app.
- Global read replicas without any application code.

### Negative — accepted with mitigations

| Consequence | Mitigation |
|---|---|
| **D1 has no interactive transactions.** Payload's `beginTransaction()` is a no-op. Multi-step writes cannot be rolled back atomically. | Checkout uses guarded single-statement `UPDATE … WHERE stock >= ?` plus a compensating saga. Documented in Phase 5. This is the single largest correctness risk in the project and is treated as such. |
| **`sharp` cannot run on Workers.** No `imageSizes`, crop, or focal point. | Cloudflare Image Transformations resize at request time. Net improvement — arbitrary widths, automatic AVIF/WebP, one stored original — but it means the admin loses interactive cropping. |
| **10 MB Worker bundle cap; free tier's 3 MB is not enough.** | Workers Paid ($5/mo) is mandatory. GraphQL disabled, dependencies minimised, bundle size checked every phase. |
| **GraphQL API unsupported.** | Disabled. We use Payload's Local API, which is faster anyway. Any future external integration uses REST. |
| **D1 writes are single-primary.** | Ample for expected volume. Trigger to revisit: sustained write contention or >100 orders/min. |
| **Payload's Cloudflare support is newer than its Postgres support.** | Pin exact versions, keep all `@payloadcms/*` on one version, and treat an upgrade as a change requiring a full manual pass. |
| **Postgres migrations from Phases 0–2 are discarded.** | No production data exists yet, so the cost is zero today. It would not have been had this decision come later. |

### Reversibility

Payload abstracts the database behind an adapter. Moving to Postgres later is a
`payload.config.ts` swap plus a regenerated migration set; application code and
collection definitions are unaffected. The genuinely Cloudflare-specific code is
small and deliberately isolated:

- `src/lib/imageLoader.ts` — the `/cdn-cgi/image` loader
- the atomic stock/counter statements in the checkout action
- `wrangler.jsonc`, `open-next.config.ts`, and the binding resolution in `payload.config.ts`

## Notes

Automated tests were also dropped from scope by stakeholder decision, to
prioritise velocity. The compensating controls are strict TypeScript, a green
build gating every PR, and server-side-only computation of money and stock.
If tests return, they should start at the checkout server action.
