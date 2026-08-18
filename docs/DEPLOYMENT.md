# Deployment runbook

**Domain: `bitodom.com`.** All Cloudflare resources are named `bitodom`.

Everything in the codebase is ready. This is the sequence of things only you can
do, because they need a Cloudflare account.

## Provisioned already

These exist on the account and need no further action:

| Resource | Value |
|---|---|
| Zone | `bitodom.com`, nameservers `rita` / `troy.ns.cloudflare.com` |
| Account ID | `ab4f47ab3fa5fe50d48912ee9e2b321b` |
| D1 database | `bitodom` — `1a7a0318-c711-4b55-b9ec-af50ab85b51e` (EEUR) |
| R2 buckets | `bitodom-media`, `bitodom-cache` (EEUR) |
| Schema | all migrations applied to remote D1 |
| Turnstile widget | sitekey `0x4AAAAAAEUm33HZvrApAqN0`, managed, `bitodom.com` + localhost |
| Image Transformations | enabled; `NEXT_PUBLIC_CF_IMAGES` is `"true"` |
| Worker secrets set | `PAYLOAD_SECRET`, `CRON_SECRET`, `RESEND_FROM_EMAIL`, `TURNSTILE_SECRET_KEY` |
| GitHub Actions | `PAYLOAD_SECRET`, `CLOUDFLARE_ACCOUNT_ID` secrets; `NEXT_PUBLIC_SITE_URL` variable |

**Still outstanding:** `RESEND_API_KEY` and `ORDER_NOTIFICATION_EMAIL` secrets, the
custom domain binding, and a `CLOUDFLARE_API_TOKEN` for the Actions deploy
workflow (OAuth credentials do not work in CI).

---

## The short version

Do these in order. Each step is verifiable before you move on.

| # | Step | Time | Blocking? |
|---|---|---|---|
| 0 | Cloudflare account + **Workers Paid ($5/mo)** | 5 min | **Yes — nothing deploys without it** |
| ~~1~~ | ~~Buy a domain~~ — done, `bitodom.com` is on Cloudflare NS | — | Done |
| 2 | `wrangler d1 create` + 2 × `r2 bucket create` | 5 min | **Yes** |
| 3 | `wrangler secret put` × 6 | 4 min | **Yes** |
| 4 | `pnpm deploy`, then create the admin user **immediately** | 5 min | **Yes** |
| 5 | Fill in Settings → Company (legal details) | 5 min | **Yes, before launch** |
| 6 | Attach `bitodom.com` to the Worker | 5 min | Before launch |
| 7 | Enable Image Transformations, flip `NEXT_PUBLIC_CF_IMAGES` | 2 min | No |
| 8 | Cache Rules | 5 min | No |
| 9 | WAF, Bot Fight Mode | 5 min | Before launch |
| 10 | Resend domain + DNS records | 10 min | Before launch |
| 11 | Turnstile widget keys (§7b) | 3 min | Before launch |
| 12 | Wire up deploys (§8) | 5 min | No |

Roughly **40 minutes of work**.

Two things only you can supply, and both block launch: your **real company
details** (UIC/Bulstat, registered address) and a **lawyer's review of the legal
copy**. Everything else on this list is mechanical.

---

## 0. Before you start

You need:

- A Cloudflare account
- **Workers Paid ($5/month) — this is mandatory, not optional.** The free tier
  caps a Worker at 3 MB compressed; Payload's admin panel alone exceeds it. Our
  bundle is ~6.8 MB against the paid 10 MB limit.
- A Resend account for order emails

The domain is already sorted — see the note at the top.

---

## 1. Create the Cloudflare resources (~5 min)

```bash
pnpm exec wrangler login

# Database
pnpm exec wrangler d1 create bitodom
# → copy the printed database_id

# Media bucket
pnpm exec wrangler r2 bucket create bitodom-media

# ISR cache bucket — REQUIRED. Without it, every page marked `revalidate`
# silently degrades to fully dynamic rendering: correct, but slow and metered
# as though nothing were cached.
pnpm exec wrangler r2 bucket create bitodom-cache
```

Paste the returned `database_id` into `wrangler.jsonc`, replacing
`REPLACE_WITH_ID_FROM_WRANGLER_D1_CREATE`. Commit that change — the id is not a
secret.

**Optional but recommended — a staging environment:**

```bash
pnpm exec wrangler d1 create bitodom-staging
pnpm exec wrangler r2 bucket create bitodom-media-staging
pnpm exec wrangler r2 bucket create bitodom-cache-staging
```

and paste that id into the `env.staging` block. Staging is configured to run at
`staging.bitodom.com` rather than a `*.workers.dev` URL, so it exercises the
same TLS, caching and image-transformation behaviour production will.

---

## 2. Set the secrets (~3 min)

Secrets never go in `wrangler.jsonc` — that file is committed.

```bash
# 32+ characters. Generate, don't invent:
openssl rand -hex 32
pnpm exec wrangler secret put PAYLOAD_SECRET

pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put RESEND_FROM_EMAIL      # orders@bitodom.com
pnpm exec wrangler secret put ORDER_NOTIFICATION_EMAIL  # where withdrawals and
                                                        # contact messages go
pnpm exec wrangler secret put CRON_SECRET            # openssl rand -hex 32
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY   # see §9b
```

Repeat with `--env staging` for the staging Worker.

> Until `RESEND_API_KEY` exists, email is **skipped with a warning rather than
> failing**. Orders still complete. Nothing breaks; customers just don't get a
> confirmation email yet.

> `TURNSTILE_SECRET_KEY` behaves the same way — with no key set, bot protection
> **fails open** and the forms work unprotected. That is deliberate: the
> withdrawal form is legally required to function, so a missing key must never
> be able to take it offline.

---

## 3. First deploy (~5 min)

```bash
pnpm deploy
```

This runs migrations against the real D1 first, then builds and deploys the
Worker. Order matters — the schema must never be behind the code.

Then **immediately**:

1. Visit `https://bitodom.<your-subdomain>.workers.dev/admin`
2. Create the first admin user

Do this straight away. Until an admin exists, Payload's create-first-user route
is open by design — that is normal, but it should not stay open any longer than
it has to.

3. Fill in **Settings → Company (legal)**: company name, UIC/Bulstat, VAT number
   if registered, registered address, trade register entry.

   This is not cosmetic. The Bulgarian Electronic Commerce Act requires trader
   identity to be reachable from every page, and the footer and all four legal
   pages read from here. Entering it once updates all of them.

---

## 4. Custom domain (~5 min)

The nameservers already point at Cloudflare, so this is just wiring.

1. ~~Add the domain to Cloudflare~~ — already done, the zone is active.
2. Workers → `bitodom` → **Settings → Domains & Routes** → add
   `bitodom.com` and `www.bitodom.com`.
3. **SSL/TLS → Overview → Full (strict)**.
4. **SSL/TLS → Edge Certificates** → enable *Always Use HTTPS*.
   Leave HSTS **off at the zone level** — the app already sends it, and two
   sources with different `max-age` values is a genuinely confusing failure.
5. Attach a custom domain to the R2 media bucket (`media.bitodom.com`) so images
   are not served through the Worker.
6. `NEXT_PUBLIC_SITE_URL` in `wrangler.jsonc` is **already set** to
   `https://bitodom.com`. Sitemap, canonical URLs and hreflang derive from it,
   so it is correct from the first deploy — but until step 2 is done, that URL
   does not resolve. Deploy, attach the domain, then verify `/sitemap.xml`.

---

## 5. Turn on image transformations (~2 min)

Cloudflare dashboard → **Images → Transformations** → enable for the zone.

Then set `NEXT_PUBLIC_CF_IMAGES` to `"true"` in `wrangler.jsonc` and redeploy.

Until this is on, the image loader **returns originals untouched** — images work
fine, they are just not resized. Turning the flag on without enabling
transformations first is the one thing that will break them, because
`/cdn-cgi/image` 404s on a zone that has not got the feature.

Free for the first 5,000 unique transformations per month.

---

## 5b. Cache Rules (~5 min, meaningful win)

The Worker already caches rendered pages in R2. Cache Rules go one better and
hold storefront responses at the **edge**, so a cached page never invokes the
Worker at all — faster for the visitor, and it does not count as a request.

Cloudflare dashboard → **Caching → Cache Rules → Create rule**:

**Rule 1 — cache the storefront**
- If: `(http.request.method eq "GET" and not starts_with(http.request.uri.path, "/admin")
  and not starts_with(http.request.uri.path, "/api")
  and not starts_with(http.request.uri.path, "/cart")
  and not starts_with(http.request.uri.path, "/checkout"))`
- Then: *Eligible for cache*, Edge TTL **respect origin**, Browser TTL 5 minutes

**Rule 2 — never cache authenticated or personal responses** (put it FIRST)
- If: `(http.cookie contains "payload-token" or starts_with(http.request.uri.path, "/admin")
  or starts_with(http.request.uri.path, "/api")
  or starts_with(http.request.uri.path, "/cart")
  or starts_with(http.request.uri.path, "/checkout"))`
- Then: *Bypass cache*

Order matters — the bypass rule has to be evaluated first, or a signed-in
admin's page could be served to the public from cache. That is the one way to
get this badly wrong, so verify it before enabling rule 1.

---

## 6. Security settings (~5 min)

In the dashboard, for the zone:

- **WAF → Managed rules**: enable the Cloudflare Managed Ruleset
- **WAF → Rate limiting rules**: add one on `/admin/login` (e.g. 10 requests /
  minute / IP). The app locks an account after 5 failed logins; this stops the
  attempts reaching it at all.
- **Bot Fight Mode**: on
- **Scrape Shield**: on

The application already rate-limits order creation, withdrawals and contact
messages through D1. The WAF is the outer layer that rejects abuse before it
costs you Worker invocations.

---

## 7. Email deliverability (~10 min + DNS)

In Resend: add `bitodom.com` as a sending domain and add the SPF, DKIM and
DMARC records it gives you to the Cloudflare DNS for the same zone. Because the
zone is already on Cloudflare, you can paste those records straight in and they
resolve immediately.

Skipping this does not stop mail sending — it makes it land in spam, which for
order confirmations is effectively the same as not sending it.

---

## 7b. Turnstile keys (~3 min)

Cloudflare dashboard → **Turnstile → Add widget**:

- Domains: `bitodom.com` (add `localhost` too if you want the real widget in dev)
- Mode: **Managed**

It gives you a site key and a secret key:

| Where | Value |
|---|---|
| `wrangler.jsonc` → `vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key — public, safe to commit |
| `wrangler secret put TURNSTILE_SECRET_KEY` | secret key — never commit |

Both halves are needed. With only one set, protection stays **off** rather than
half-on. Cloudflare's always-passing test keys are documented in
`.dev.vars.example` for local work.

---

## 8. Automating deploys (~5 min)

CI — lint, typecheck, migrate, build, bundle-size check — already runs on every
pull request and needs **no credentials at all**. That part is done.

For *deploying*, there are two options, and they are not equivalent.

### Option A — the GitHub Actions workflow in this repo (recommended)

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | scopes: *Workers Scripts: Edit*, *D1: Edit*, *R2: Edit*, *Account Settings: Read* |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |
| `PAYLOAD_SECRET` | the same value you set with `wrangler secret put` |

and one repository **variable**: `NEXT_PUBLIC_SITE_URL`.

Then run the **Deploy** workflow from the Actions tab and pick staging or
production.

**Why this one:** it runs `payload migrate` *before* deploying the Worker, so the
schema is never behind the code. It is also deliberately manual — this shop takes
real money, and a deploy should be a decision rather than a side effect of
merging a typo fix. Change the trigger to `push: branches: [main]` once you are
comfortable with that.

### Option B — Cloudflare Workers Builds (git integration)

Workers → your Worker → **Settings → Builds → Connect repository**. Cloudflare
then builds and deploys on every push. Genuinely a two-minute setup.

**The catch, and it is a real one:** Workers Builds runs a build command and
deploys. It has no notion of "run database migrations first, and only deploy if
they succeed". You would have to fold migrations into the build command, and a
failed migration mid-build leaves you with a half-applied schema and a Worker
that may already be live against it.

For a static site or an API with no schema, Workers Builds is the easy right
answer. For this project — a shop with a database, real orders and money — the
explicit migrate-then-deploy ordering is worth the extra five minutes of setup.

**Recommendation:** use Option A. Revisit Workers Builds if you later want
preview deploys per pull request, which it does very well; the two can coexist,
with Workers Builds handling previews and Actions handling production.

---

## Rollback

```bash
pnpm exec wrangler rollback
```

Reverts the Worker to the previous version in seconds. **It does not roll back
D1 migrations** — which is exactly why migrations must be additive and
backwards-compatible with the currently deployed Worker.

---

## Pre-launch checklist

**Blocking — the shop is not legal to operate without these**

- [ ] Company details filled in (Settings → Company): name, UIC/Bulstat,
      registered address, trade register entry
- [ ] All four legal pages reviewed by a lawyer and the placeholder text
      replaced. **Every page currently shows a visible "provisional text"
      banner, which disappears once CMS content exists.**
- [ ] Real shipping rates confirmed in Settings → Shipping
- [ ] Contact email and phone set

**Functional**

- [ ] Place a real test order end to end and confirm stock decrements
- [ ] Move that order to *shipped* with a tracking number, confirm the email
      arrives
- [ ] Submit a withdrawal request, confirm both emails arrive
- [ ] Check the storefront at 375px width
- [ ] Switch language on several pages and confirm the path is preserved

**Technical**

- [ ] `/api/health` returns `{"status":"ok","database":"ok"}`
- [ ] Search returns results (confirms the FTS5 index migration ran)
- [ ] A cached storefront page shows `cf-cache-status: HIT` on the second request
- [ ] `/sitemap.xml` and `/robots.txt` show the real domain, not `localhost`
- [ ] Security headers present on the storefront (`curl -I`)
- [ ] `/admin` requires login
- [ ] Lighthouse ≥ 90 on Performance, Accessibility, Best Practices, SEO

---

## Running costs

| Service | Cost |
|---|---|
| Workers Paid | $5/month |
| D1 (5 GB, 25 bn reads/mo included) | $0 |
| R2 (10 GB free, **zero egress**) | $0 |
| Image transformations (5,000/mo free) | $0 |
| DNS, CDN, WAF | Free |
| Resend (3,000 emails/mo free) | $0 |
| Domain | ~€10-15/year |
| **Total** | **~$5/month** |
