# KC Trading

Bulgarian e-commerce store — retail and bulk, tiered pricing, Cash on Delivery
via Econt/Speedy. Bilingual (BG/EN).

Built on **Payload CMS 3** and **Next.js 16**, running entirely on **Cloudflare**:
Workers for compute, D1 for the database, R2 for media.

- **Deploying? Start here:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Plan: [`docs/kc-commerce-plan.md`](docs/kc-commerce-plan.md)
- Progress: [`docs/development-tracker.md`](docs/development-tracker.md)
- Platform decision: [`docs/adr/0001-cloudflare-platform.md`](docs/adr/0001-cloudflare-platform.md)

---

## Quick start

Requires **Node 24.15+** and **pnpm**. No Docker, no Postgres, no Cloudflare
account needed for local development — Wrangler emulates D1 and R2 on your machine.

```bash
pnpm install

cp .dev.vars.example .dev.vars
# then set PAYLOAD_SECRET:
openssl rand -hex 32

pnpm migrate        # applies migrations to the local D1 database
pnpm dev            # http://localhost:3000
```

Visit `http://localhost:3000/admin` and create the first admin user.

### Everyday commands

| Command | Does |
|---|---|
| `pnpm dev` | Dev server with local D1 + R2 bindings |
| `pnpm build` | Production build (webpack — see "Gotchas") |
| `pnpm lint` | ESLint, including the no-hardcoded-colour rule |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm migrate` | Apply migrations to local D1 |
| `pnpm migrate:create <name>` | Generate a migration from schema changes |
| `pnpm db:reset` | Wipe local D1 state and re-migrate |
| `pnpm generate:types` | Regenerate Cloudflare binding + Payload types |
| `pnpm preview` | Build the real Worker and serve it locally |
| `pnpm bundle:check` | Report Worker bundle size against the 10 MB cap |
| `pnpm seed` | Load development catalogue data (4 categories, 6 products) |
| `pnpm deploy` | Migrate production D1, then deploy the Worker |

---

## Architecture

```
Browser → Cloudflare edge (DNS, WAF, CDN)
            └── Worker: Next.js + Payload  ── binding ──▶ D1  (SQLite)
                                            ── binding ──▶ R2  (media)
                                            ── fetch   ──▶ Resend (email)
```

D1 and R2 are attached as **Worker bindings**, not network services. There is no
`DATABASE_URL` and no storage token anywhere in this project — nothing to leak
or rotate. Configuration splits into:

- **`wrangler.jsonc`** — bindings and non-secret public vars. Committed.
- **`.dev.vars`** — local secrets. Git-ignored.
- **`wrangler secret put NAME`** — deployed secrets, encrypted by Cloudflare.

---

## Gotchas

Things that will cost you an hour if you don't know them. Each is load-bearing.

**Workers Paid ($5/mo) is required to deploy.** The free tier caps a Worker at
3 MB compressed; Payload's admin panel alone exceeds that. Current bundle is
~5.6 MB gzipped against the paid 10 MB ceiling — run `pnpm bundle:check` after
adding dependencies.

**The build must use webpack, not Turbopack.** Payload deliberately obfuscates
its `drizzle-kit/api` import so bundlers won't follow it. Turbopack emits it as
an unresolvable external and OpenNext's esbuild pass then fails. `pnpm build`
passes `--webpack` for this reason. Do not remove that flag.

**`middleware.ts` must not be renamed to `proxy.ts`.** Next 16 deprecates the
name and prints a warning on every build, but its `proxy` convention is
Node-runtime-only and OpenNext cannot run Node middleware. Renaming to silence
the warning breaks `pnpm deploy`.

**No `sharp`, so no image resizing in Payload.** No `imageSizes`, no crop, no
focal point. Resizing happens at the edge via Cloudflare Image Transformations
(`src/lib/imageLoader.ts`), which needs a real zone — it is disabled on
`workers.dev` and falls back to serving originals.

**D1 has no interactive transactions.** `beginTransaction()` is a no-op. Any
multi-step write that must not half-apply — stock decrement above all — needs
guarded single-statement updates plus explicit compensation. See Phase 5 in the
plan before touching checkout.

**`database_id` in `wrangler.jsonc` is a placeholder.** Local development
ignores it (Miniflare keys off `database_name`). Replace it with the real id
from `wrangler d1 create` before deploying.

---

## Conventions

**Colours.** The palette is not signed off with stakeholders. All colour lives
in `src/styles/theme.css`; components use semantic tokens (`bg-primary`,
`text-muted`, `text-price`) and never a hex or numbered Tailwind colour. This is
enforced by ESLint. See [`src/styles/themes/README.md`](src/styles/themes/README.md)
to swap the whole palette in one line.

**No test suite.** A deliberate scope decision in favour of velocity. The
compensating controls are strict TypeScript, a build that gates every PR, and
computing all money and stock server-side. If tests return, start with the
checkout server action.

**Branching.** One branch and one PR per phase, per the plan. `main` stays
deployable.
