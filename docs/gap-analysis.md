# Gap analysis & roadmap

**Date:** 2026-08-07
**Method:** Playwright drove the real UI (36/37 checks passed, one full order placed end to end), plus a feature audit against Shopify, WooCommerce, Emag.bg and Metro.

---

## 1. Direct answers to your questions

### Filtering — ✅ in place
Category, price range (min/max), in-stock toggle, sort, and text search. All state
lives in the URL, so filtered views are shareable and the back button works.
`sort` is whitelisted rather than passed through — it reaches the database, and
arbitrary values would let a visitor sort by unindexed columns.

**Verified:** 6 products → 5 with in-stock filter → 2 with category filter → 3 with a price range.

### Sorting/ordering — ✅ in place
Newest, price ascending, price descending, name A–Z. Categories have a
`sortOrder` field the admin controls.

### Categories — ✅ in place
Nested (self-referencing `parent`, max 3 levels), with image, description,
sort order and active flag. Deletion is blocked while products still reference
them. Fully manageable in the admin.

### Brands — ❌ **NOT in place**
There is no Brands or Manufacturers collection. This is the single most obvious
missing catalogue dimension: no brand field, no brand filter, no brand pages. For
a general-merchandise store reselling other people's products, customers filter
by brand constantly. **Highest-priority gap. Detailed below.**

### Admin manageability — ✅ mostly, with gaps
Everything currently modelled is manageable at `/admin`: products (including
bulk pricing tiers as a repeatable array), categories, orders, pages, media,
users, and a tabbed Settings global. Orders show a clean list (number, status,
customer, total, date) and enforce a status state machine.

**Not manageable because it does not exist yet:** brands, discounts, coupons,
homepage banners beyond the single announcement bar, and product variants.

---

## 2. What a real e-commerce platform has that this does not

Ordered by how much each costs you in lost revenue or legal exposure, not by
implementation difficulty.

### 🔴 Blocking or near-blocking

| Gap | Why it matters |
|---|---|
| **Discounts / sale prices** | No way to run a promotion at all. Also legally loaded — see §3 |
| **Brands** | Missing catalogue dimension; customers expect to filter by it |
| **Product images** | The data model supports them; nothing has been uploaded, so every card is a grey box. Nothing is broken, but the shop currently looks unfinished |
| **Invoice generation** | Bulgarian businesses must issue invoices. Currently manual |
| **Econt/Speedy office lists** | Customers type an office name free-hand. Real integrations give a searchable office picker and generate labels |

### 🟠 High value

| Gap | Why it matters |
|---|---|
| **Coupon / promo codes** | Standard marketing lever; nothing exists |
| **Search quality** | `LIKE` matching only. No autocomplete, no typo tolerance, no relevance ranking |
| **Quick view / quick add** | Bulk buyers reordering known SKUs currently need a full page load per product |
| **Customer accounts** | Anonymous checkout only. No order history, no reorder, no saved addresses |
| **Order tracking page** | Customers get a tracking number by email but cannot check status on the site |
| **Product variants** | One SKU per product. No size/colour/pack-size variants |
| **Abandoned cart recovery** | Typically recovers 5-10% of lost carts |
| **Analytics** | Zero visibility into what sells or where people drop off |

### 🟡 Worthwhile later

Reviews and ratings · wishlist · recently viewed · back-in-stock alerts ·
product bundles · CSV import/export · multi-image zoom · related-product rules
beyond same-category · PWA · loyalty pricing per customer.

---

## 3. ⚠️ Discounts have a legal dimension — read before building

You asked for sales and discounts. In Bulgaria and the EU this is **not** just a
`salePrice` field.

Under the **Omnibus Directive**, as implemented in the Bulgarian Consumer
Protection Act, any announced price reduction must display the **lowest price
applied in the 30 days before the reduction** — not the regular price, the
lowest actual one. The February 2026 CPA amendment tightened this further, and
it takes full effect on **5 February 2027**.

Practically, this means a discount feature must:

1. **Record price history automatically.** A `priceHistory` collection written
   by a Payload hook whenever `basePrice` or a tier changes. Without history you
   cannot compute the required reference price, and retrofitting it later means
   you simply cannot run a compliant sale until 30 days of data exist.
2. **Compute the 30-day lowest price** and display it as the struck-through
   reference, rather than whatever the current base price happens to be.
3. **Handle the under-30-days case**: for products on sale less than 30 days,
   show the lowest price from at least 7 days before the reduction began.
4. **Store the reference price on the order line**, so a dispute months later can
   be answered from the record.

Getting this wrong is a CPA enforcement risk, and the fine is materially larger
than the cost of building it correctly. **This is why discounts are scheduled as
a full phase rather than a field.**

---

## 4. Caching and performance — current state

You asked specifically. Honest assessment:

### Fixed today
Cache invalidation was **dead code**. The Phase 7-9 hooks called
`revalidateTag('products')` but no query was ever tagged, so they ran and did
nothing — an editor changing a price still waited up to an hour. Settings,
categories and product-detail queries are now wrapped in tagged cache entries
whose tags match the hooks, with locale in the cache key.

### Still outstanding
**The ISR incremental cache is not wired.** `revalidate` is declared on every
page, but on Cloudflare that requires an R2 bucket bound as
`NEXT_INC_CACHE_R2_BUCKET`. Without it, **`revalidate` silently degrades to
rendering every request dynamically.** Pages are correct but slower and more
expensive than they look. This is a one-line binding plus an
`open-next.config.ts` change — it is in the roadmap below and needs the bucket
you create tomorrow.

### On your CDN question
**You already have one, and it is why a separate CDN would be redundant.** Every
request enters through Cloudflare's ~300 PoPs. Static assets are served from
Cloudflare's asset store and never touch the Worker. Media comes from R2 with
zero egress. Images resize at the edge. Adding another CDN in front would add a
hop and a bill for something you are already getting.

What *is* worth doing, and is in the roadmap: **Cache Rules** so storefront GETs
are held at the edge and never reach the Worker at all, with `/admin`, `/api`,
`/cart` and `/checkout` explicitly bypassed.

### Query efficiency
Good, with one known weakness. Queries use `select` and low `depth`, and the
indexes match the filters. The weakness is **search**: `LIKE '%term%'` cannot use
an index, so it scans. Fine at 6 products, not at 5,000 — D1 bills by rows read,
so an unindexed scan is metered as well as slow. SQLite **FTS5** is the fix and
is in the roadmap.

---

## 5. Proposed roadmap

Sequenced so each phase is independently shippable and the highest-value work
lands first.

### Phase 11 — Brands & catalogue depth
- `Brands` collection: name, slug, logo, description, `isActive`
- `brand` relationship on Products, indexed
- Brand filter in the sidebar; `/brands` and `/brands/[slug]` pages
- Brand shown on product cards and detail pages
- Backfill: existing products get no brand, which is valid

**Why first:** small, self-contained, and closes the most conspicuous gap.

### Phase 12 — Discounts, sales & the 30-day rule
- `priceHistory` collection, written by a Payload hook on every price change
- Product fields: `salePrice`, `saleStartsAt`, `saleEndsAt`
- `lowestPriceLast30Days()` helper, used everywhere a discount is shown
- Struck-through reference price on cards, detail pages and in the cart
- Sale badges; `?onSale=1` filter; a "Sale" section on the homepage
- **Server-side enforcement**: the checkout action recomputes sale eligibility
  by date. A sale that has expired must not be honoured just because a stale
  cart says so
- Reference price recorded on the order line

### Phase 13 — Merchandising & conversion
- Homepage banner slots (CMS-managed, scheduled, image + link)
- Quick view modal — add to cart without leaving the listing
- Quick reorder from a previous order number
- "Recently viewed" (localStorage, no cookie consent needed)
- Cross-sell: "frequently bought together", admin-curated

### Phase 14 — Performance & search
- **Wire the R2 incremental cache** (unblocks real ISR — do this first)
- Cloudflare Cache Rules for storefront GETs, with admin/api/cart/checkout bypassed
- **SQLite FTS5 search index**, kept in sync by an afterChange hook
- Search autocomplete dropdown in the header
- `d1 insights` review of the slowest queries after real traffic

### Phase 15 — Customer accounts & order tracking
- Optional registration (Payload auth on a `Customers` collection)
- Order history, saved addresses, one-click reorder
- Public order-status lookup by number + email
- Guest checkout stays the default — forced registration costs conversions

### Phase 16 — Operations
- PDF invoice generation in Bulgarian format
- Econt/Speedy API: office lists, label generation, live tracking
- Low-stock email alerts for admins
- CSV product import/export
- Admin dashboard: revenue, orders by status, top products

### Phase 17 — Growth
- Plausible analytics (cookie-free, so no consent burden)
- Abandoned cart emails
- Coupon codes
- Product reviews with moderation
- Back-in-stock notifications

---

## 6. Suggested order of work

If you want a single recommendation: **12 → 11 → 14 → 13**.

Discounts before brands, despite brands being simpler, for one reason: the
30-day price-history requirement means the history table must start collecting
data **before** you want to run your first sale. Every week it is not there is a
week you cannot legally discount. Brands can be added any time with no such
dependency.

Then Phase 14, because the ISR cache binding is a genuine performance defect
sitting in production the moment you deploy.
