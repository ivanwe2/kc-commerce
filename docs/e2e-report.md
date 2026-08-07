# End-to-end verification report

**Date:** 2026-08-07
**Method:** `e2e.mjs` drives the real application in Chromium against a database
built from scratch (`pnpm migrate && pnpm seed`).
**Result: 87 / 87 checks passed.**

Reproduce with:

```bash
rm -rf .wrangler/state && pnpm migrate && pnpm seed
pnpm dev          # in one shell
node e2e.mjs      # in another
```

Exits non-zero on any failure, so it can gate a deploy.

---

## Coverage

| Area | Checks | Notable assertions |
|---|---|---|
| Availability | 19 | All 18 routes return 200; health check confirms a live D1 round-trip |
| Internationalisation | 5 | Fresh visitor gets BG at `/`; `/en` serves English; `/bg` 307s to `/`; a returning visitor keeps their chosen language |
| Catalogue & search | 11 | Stock, category, brand, sale and price filters; FTS in both languages; autocomplete with keyboard selection; a no-match query returns 0 rather than everything |
| Pricing & discounts | 9 | Bulk tiers drop the unit price at 10 and 50; active tier highlighted; sale price with the **30-day reference struck through** on both detail and listing |
| Merchandising | 5 | Scheduled banner, sale section, brand pages |
| Cart | 5 | Quick add without navigation, badge, quantity edits, multiple lines |
| Checkout | 5 | Empty form rejected; invalid phone rejected **server-side**; conditional address fields; **a real order placed end to end**; cart cleared |
| Order tracking | 2 | Correct email returns the order; **wrong email is refused** |
| Legal | 7 | All four legal pages; electronic withdrawal form; cookie policy enumerates each cookie; trader info in the footer |
| Security | 9 | CSP, X-Frame-Options, nosniff, Referrer-Policy; admin exempt from storefront CSP; invoice and CSV export return 401; orders and coupons APIs return 403 |
| SEO | 5 | Sitemap with products and hreflang; robots disallows `/admin`; Product JSON-LD |
| Mobile & a11y | 5 | No horizontal overflow at 375px; drawer opens and closes on Escape; skip link; every image has alt text |
| Console | 1 | No page or console errors across the entire run |

---

## What the run found

Two checks failed on the first execution. Both were **defects in the test, not
the application** — and the investigation is worth recording, because the
distinction was not obvious:

The availability section requests `/en`, and Playwright's `page.request` shares
the browser context's cookie jar. next-intl therefore stored `NEXT_LOCALE=en`,
and every later visit to `/` correctly redirected to `/en`. The original
assertion ("`/` is always Bulgarian") was asserting against correct behaviour.

Verified directly before changing anything:

```
fresh visitor at /      -> lang bg | url /
NEXT_LOCALE cookie      -> en
returning visitor at /  -> lang en | url /en
```

A returning visitor keeping their language is a feature, so the suite now uses
an isolated context for the fresh-visitor case **and asserts the returning-visitor
behaviour explicitly** rather than quietly destroying the cookie to make a test
pass.

---

## Not covered here

Honest scope boundaries:

- **Courier APIs.** Econt and Speedy need commercial contracts; `getCourierClient()`
  returns null and the manual path is what runs. See `src/lib/couriers.ts`.
- **Email delivery.** Sending is skipped without `RESEND_API_KEY`. The code paths
  execute and are logged; actual delivery needs the account.
- **Production caching.** The R2 incremental cache and Cloudflare Cache Rules
  only take effect once deployed.
- **Load and concurrency.** Overselling and order-number uniqueness were verified
  separately against D1 (12 concurrent reservations against 8 units granted
  exactly 8; 20 concurrent counter claims produced 20 unique values), but this
  suite is functional, not a load test.
