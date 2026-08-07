# Deployment runbook

Everything in the codebase is ready. This is the sequence of things only you can
do, because they need a Cloudflare account and a domain.

Times are rough. The whole thing is about 45 minutes, most of it waiting for DNS.

---

## The short version

Do these in order. Each step is verifiable before you move on.

| # | Step | Time | Blocking? |
|---|---|---|---|
| 0 | Cloudflare account + **Workers Paid ($5/mo)** | 5 min | **Yes — nothing deploys without it** |
| 1 | Buy a domain (Cloudflare Registrar is simplest) | 10 min | No, but needed for §4-5 |
| 2 | `wrangler d1 create` + 2 × `r2 bucket create` | 5 min | **Yes** |
| 3 | `wrangler secret put` × 4 | 3 min | **Yes** |
| 4 | `pnpm deploy`, then create the admin user **immediately** | 5 min | **Yes** |
| 5 | Fill in Settings → Company (legal details) | 5 min | **Yes, before launch** |
| 6 | Attach the custom domain | 15 min | Before launch |
| 7 | Enable Image Transformations, flip `NEXT_PUBLIC_CF_IMAGES` | 2 min | No |
| 8 | Cache Rules | 5 min | No |
| 9 | WAF, Bot Fight Mode | 5 min | Before launch |
| 10 | Resend domain + DNS records | 10 min | Before launch |
| 11 | Wire up deploys (§8) | 5 min | No |

Roughly **45 minutes of work**, plus DNS propagation.

Two things only you can supply, and both block launch: your **real company
details** (UIC/Bulstat, registered address) and a **lawyer's review of the legal
copy**. Everything else on this list is mechanical.

---

## 0. Before you start

You need:

- A Cloudflare account
- **Workers Paid ($5/month) — this is mandatory, not optional.** The free tier
  caps a Worker at 3 MB compressed; Payload's admin panel alone exceeds it. Our
  bundle is ~5.7 MB against the paid 10 MB limit.
- A domain (can be bought through Cloudflare or transferred in)
- A Resend account for order emails

---

## 0b. Buy a domain (~10 min)

Any registrar works, but **Cloudflare Registrar** is the least friction: the
domain lands in the same account, nameservers are already correct, DNS is
instant, and it sells at cost with no markup or renewal surprise.

`.bg` domains cannot be registered through Cloudflare — they need a Bulgarian
registrar (register.bg and others). If you take that route, buy the domain
there, then add the site to Cloudflare and change the nameservers at the
registrar to the two Cloudflare gives you. Everything downstream is identical.

You can complete steps 1-3 and deploy to `*.workers.dev` before the domain
exists. The domain is only needed for the custom domain, image transformations
and email.

---

## 1. Create the Cloudflare resources (~5 min)

```bash
pnpm exec wrangler login

# Database
pnpm exec wrangler d1 create kc-commerce
# → copy the printed database_id

# Media bucket
pnpm exec wrangler r2 bucket create kc-commerce-media

# ISR cache bucket — REQUIRED. Without it, every page marked `revalidate`
# silently degrades to fully dynamic rendering: correct, but slow and metered
# as though nothing were cached.
pnpm exec wrangler r2 bucket create kc-commerce-cache
```

Paste the returned `database_id` into `wrangler.jsonc`, replacing
`REPLACE_WITH_ID_FROM_WRANGLER_D1_CREATE`. Commit that change — the id is not a
secret.

**Optional but recommended — a staging environment:**

```bash
pnpm exec wrangler d1 create kc-commerce-staging
pnpm exec wrangler r2 bucket create kc-commerce-media-staging
pnpm exec wrangler r2 bucket create kc-commerce-cache-staging
```

and paste that id into the `env.staging` block.

---

## 2. Set the secrets (~3 min)

Secrets never go in `wrangler.jsonc` — that file is committed.

```bash
# 32+ characters. Generate, don't invent:
openssl rand -hex 32
pnpm exec wrangler secret put PAYLOAD_SECRET

pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put RESEND_FROM_EMAIL      # e.g. orders@kctrading.bg
pnpm exec wrangler secret put ORDER_NOTIFICATION_EMAIL  # where withdrawals and
                                                        # contact messages go
```

Repeat with `--env staging` for the staging Worker.

> Until `RESEND_API_KEY` exists, email is **skipped with a warning rather than
> failing**. Orders still complete. Nothing breaks; customers just don't get a
> confirmation email yet.

---

## 3. First deploy (~5 min)

```bash
pnpm deploy
```

This runs migrations against the real D1 first, then builds and deploys the
Worker. Order matters — the schema must never be behind the code.

Then **immediately**:

1. Visit `https://kc-commerce.<your-subdomain>.workers.dev/admin`
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

## 4. Custom domain (~15 min, mostly DNS propagation)

1. Add the domain to Cloudflare (change nameservers at your registrar).
2. Workers → `kc-commerce` → **Settings → Domains & Routes** → add
   `kctrading.bg` and `www.kctrading.bg`.
3. **SSL/TLS → Overview → Full (strict)**.
4. **SSL/TLS → Edge Certificates** → enable *Always Use HTTPS*.
   Leave HSTS **off at the zone level** — the app already sends it, and two
   sources with different `max-age` values is a genuinely confusing failure.
5. Attach a custom domain to the R2 bucket for media (e.g. `media.kctrading.bg`)
   so images are not served through the Worker.
6. Update `NEXT_PUBLIC_SITE_URL` in `wrangler.jsonc` to the real domain and
   redeploy. Sitemap, canonical URLs and hreflang all derive from it.

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

In Resend: add `kctrading.bg` as a sending domain and add the SPF, DKIM and
DMARC records it gives you to the Cloudflare DNS for the same zone.

Skipping this does not stop mail sending — it makes it land in spam, which for
order confirmations is effectively the same as not sending it.

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
