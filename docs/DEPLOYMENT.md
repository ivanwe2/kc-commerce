# Deployment runbook

Everything in the codebase is ready. This is the sequence of things only you can
do, because they need a Cloudflare account and a domain.

Times are rough. The whole thing is about 45 minutes, most of it waiting for DNS.

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

## 8. GitHub Actions (optional, ~5 min)

CI (lint, typecheck, build, bundle-size check) runs on every PR already and
needs no credentials.

For deploys from GitHub, add repository secrets:

- `CLOUDFLARE_API_TOKEN` — scopes: *Workers Scripts: Edit*, *D1: Edit*,
  *R2: Edit*, *Account Settings: Read*
- `CLOUDFLARE_ACCOUNT_ID`
- `PAYLOAD_SECRET`

and a repository variable `NEXT_PUBLIC_SITE_URL`.

Then run the **Deploy** workflow manually and pick an environment. It is
deliberately manual rather than automatic on merge: this shop takes real money,
so a deploy should be a decision rather than a side effect.

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
