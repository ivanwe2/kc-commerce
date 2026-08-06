# KC Trading — Agentic Development Master Plan

## Project Overview

**KC Trading** is a Bulgarian e-commerce store selling miscellaneous items in both retail and bulk quantities, with tiered pricing that rewards larger orders. The store targets Bulgarian and English-speaking customers, operates under EU/Bulgarian legal requirements, and uses Cash on Delivery via Econt/Speedy as its sole payment method at launch.

**Development method:** Agentic — Claude Code (Opus 5). Every phase below is structured as atomic commits with explicit instructions the agent can execute sequentially.

> **Plan revision v2 — 2026-08-06.** The platform was changed from Vercel + Neon Postgres + Vercel Blob to **Cloudflare end-to-end** (Workers + D1 + R2). See `docs/adr/0001-cloudflare-platform.md` for the decision record and trade-offs. All infrastructure sections below reflect v2. The data model, design system, security rules, and legal requirements are unchanged from v1.

---

## Tech Stack Decision & Rationale

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 15 (App Router) | SSR/SSG for SEO, React Server Components, Server Actions, dominant ecosystem |
| **CMS + Backend** | Payload CMS 3.x | Installs inside `/app`, admin panel included, built-in localization, TypeScript-native, MIT license, most AI-agent-friendly CMS in 2026 |
| **Runtime/Hosting** | Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`) | Runs Next.js on Cloudflare's global network, ~300 PoPs, no cold starts, no region config |
| **Database** | Cloudflare D1 (SQLite) via `@payloadcms/db-d1-sqlite` | Official Payload adapter, zero-config binding, global read replicas, no connection pooling to manage |
| **ORM** | Drizzle (via Payload) | Bundled with Payload 3.x, type-safe, lightweight |
| **File Storage** | Cloudflare R2 via `@payloadcms/storage-r2` | Native bucket binding (no S3 credentials), **zero egress fees** — decisive for an image-heavy catalogue |
| **Image Optimization** | Cloudflare Image Transformations (`/cdn-cgi/image/`) | `sharp` cannot run on Workers; CF resizes at the edge instead. See "Media & Images" below |
| **Styling** | Tailwind CSS 4 (CSS-first `@theme`) + shadcn/ui | Utility-first, tree-shakeable, accessible primitives. Palette lives in **one token file** — see "Theming" |
| **Language** | TypeScript 5.x (strict mode) | End-to-end type safety from DB to UI |
| **i18n** | Payload built-in localization + next-intl | Payload localizes content fields natively; next-intl handles UI strings/routing |
| **Email** | Resend | Free tier: 100 emails/day, 3,000/month — enough for launch. Pure `fetch`, works on Workers |
| **DNS/CDN/WAF** | Cloudflare | Same account as the app — DNS, DDoS, WAF, bot management, caching all in one place |
| **Deploy tooling** | Wrangler 4 | `wrangler deploy`, D1 migrations, R2 management, local Miniflare emulation |

### Hosting Decision

> **Cloudflare end-to-end.** Payload ships an official `with-cloudflare-d1` template (Workers + D1 + R2), so this is a supported path, not a hack.
>
> - **Runtime:** Next.js is compiled to a Worker by `@opennextjs/cloudflare`. Static assets are served from Cloudflare's asset store, not the Worker.
> - **Workers Paid plan ($5/month) is REQUIRED.** The free tier caps a Worker at 3 MB compressed; Payload's admin panel exceeds that. Paid allows 10 MB. **Keeping the bundle under 10 MB is an ongoing constraint** — see "Bundle Budget" below.
> - **Database:** D1 in local dev is a Miniflare-emulated SQLite file under `.wrangler/state` — **no Docker, no local Postgres**. Production D1 is the same engine, replicated.
> - **Media:** R2 bucket binding in both dev (Miniflare local bucket) and prod. Identical code path — no conditional adapter loading like the old Vercel Blob setup needed.
> - **If you ever outgrow Cloudflare:** Payload abstracts the database behind its adapter interface. Moving to Postgres is a `payload.config.ts` adapter swap plus a fresh migration set. Application code does not change.

### Platform Constraints (read before every phase)

These are consequences of the Workers runtime. They are not optional to work around.

| Constraint | Consequence | Mitigation |
|---|---|---|
| **No `sharp`** | Payload cannot generate `imageSizes`, crop, or focal point | `upload: { crop: false, focalPoint: false }`, no `imageSizes`. Resize at the edge via Cloudflare Image Transformations with a custom `next/image` loader |
| **10 MB Worker bundle (paid)** | Every dependency counts | GraphQL disabled, no heavy client libs, `serverExternalPackages` tuned, bundle size checked each phase |
| **GraphQL unsupported on Workers** | Payload's `/api/graphql` breaks | `graphQL: { disable: true }` — we use the Local API anyway, and it cuts ~1 MB |
| **D1 has no interactive transactions** | `payload.db.beginTransaction()` is a no-op | Stock decrement and order numbering use **atomic single-statement conditional UPDATEs** with compensating rollback. See Phase 5 |
| **D1 write throughput is single-primary** | Writes don't scale horizontally | Fine at this volume; reads scale via replicas. Revisit only above ~100 orders/min |
| **Workers blocks private-IP fetch** | SSRF protection is built in | `skipSafeFetch: true` is safe here |

### Monthly Cost Estimate (Launch)

| Service | Cost |
|---------|------|
| Cloudflare Workers Paid (required for bundle size) | $5/month |
| Cloudflare D1 (5 GB storage, 25 bn reads/mo included) | $0 |
| Cloudflare R2 (10 GB free, **zero egress**) | $0 |
| Cloudflare Image Transformations (5,000 unique/mo free) | $0 |
| Cloudflare DNS/CDN/WAF | Free |
| Resend email (free tier) | Free |
| Domain (.bg or .com) | ~€10-15/year |
| **Total** | **~$5/month** |

Roughly a **4× cost reduction** versus the v1 Vercel Pro + Neon plan, with zero egress fees as catalogue traffic grows.

---

## Architecture Overview

```
                        ┌──────────────────────────┐
   Browser ────────────▶│  Cloudflare Edge (~300)  │
                        │  DNS · WAF · DDoS · CDN  │
                        └────────────┬─────────────┘
                                     │
   ┌─────────────────────────────────▼──────────────────────────────┐
   │  Worker: kc-commerce  (Next.js compiled by OpenNext)           │
   │                                                                │
   │  ┌────────────┐  ┌──────────────────────────┐                  │
   │  │ Storefront │  │   Payload CMS Admin      │   ┌────────────┐ │
   │  │  (public)  │  │   (/admin route)         │   │  ASSETS    │ │
   │  │            │  │                          │   │  binding   │ │
   │  │ - Home     │  │ - Products CRUD          │   │ (static,   │ │
   │  │ - Products │  │ - Orders management      │   │  free, not │ │
   │  │ - Cart     │  │ - Categories             │   │  billed as │ │
   │  │ - Checkout │  │ - Pages (CMS)            │   │  requests) │ │
   │  │ - Pages    │  │ - Media library          │   └────────────┘ │
   │  └─────┬──────┘  └────────────┬─────────────┘                  │
   │        │    Payload Local API │                                │
   │        └──────────┬───────────┘                                │
   │                   │                                            │
   │          ┌────────▼────────┐                                   │
   │          │  Drizzle ORM    │                                   │
   │          └────────┬────────┘                                   │
   └───────────────────┼────────────────────────────────────────────┘
              bindings │ (no network credentials, no connection strings)
     ┌─────────────────┼──────────────────┬──────────────────┐
     │                 │                  │                  │
┌────▼─────┐    ┌──────▼──────┐   ┌───────▼────────┐  ┌──────▼─────┐
│ D1       │    │ R2          │   │ /cdn-cgi/image │  │ Resend     │
│ SQLite   │    │ (media,     │   │ edge resize    │  │ (email,    │
│ + read   │    │  zero       │   │ webp/avif      │  │  via HTTPS │
│ replicas │    │  egress)    │   │ (replaces      │  │  fetch)    │
└──────────┘    └─────────────┘   │  sharp)        │  └────────────┘
                                  └────────────────┘
```

**Why bindings matter:** D1 and R2 are attached to the Worker as *bindings*, not as network services. There is no `DATABASE_URL`, no S3 access key, and no credential to leak or rotate. Access is granted by Cloudflare's runtime to that specific Worker. This removes an entire class of secret-management risk that the v1 Neon/Vercel Blob design carried.

---

## Local Development Environment (Wrangler / Miniflare)

> **No Docker. No local Postgres.** Wrangler emulates D1 and R2 on your machine using Miniflare, storing state in `.wrangler/state/`. The bindings your code sees locally are the same shape as production.

### How It Works

```
LOCAL DEVELOPMENT:
┌────────────────────────────────────────────────┐
│  pnpm dev   (next dev)                         │
│  ↕ getPlatformProxy() from wrangler            │
│  D1  → local SQLite in .wrangler/state         │
│  R2  → local bucket in .wrangler/state         │
└────────────────────────────────────────────────┘

DEPLOYED ON CLOUDFLARE:
┌────────────────────────────────────────────────┐
│  Worker (OpenNext build of the same Next app)  │
│  ↕ runtime bindings                            │
│  D1  → replicated SQLite                       │
│  R2  → object storage, zero egress             │
└────────────────────────────────────────────────┘
```

`payload.config.ts` picks the right source automatically: when running under the Payload CLI or in dev it pulls bindings from Wrangler's platform proxy; in the deployed Worker it reads them from `getCloudflareContext()`. One config, both environments.

### Environment Variable Strategy

Cloudflare's model splits cleanly in two, and this is a security improvement over v1:

**Bindings** (D1, R2, ASSETS) — declared in `wrangler.jsonc`, injected by the runtime. Not secrets, not in `.env`, nothing to leak.

**Secrets** — set with `wrangler secret put`, stored encrypted by Cloudflare, never in the repo.

```
# .dev.vars (git-ignored — local secrets only)
PAYLOAD_SECRET=<openssl rand -hex 32>
RESEND_API_KEY=re_xxxxxxxxxxxx

# Production (set once, per environment)
wrangler secret put PAYLOAD_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put CRON_SECRET

# Non-secret public config lives in wrangler.jsonc [vars]
NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_DEFAULT_LOCALE, NEXT_PUBLIC_SUPPORTED_LOCALES
```

There is **no `DATABASE_URL` and no storage token** anywhere in this project. That is by design.

### Media & Images (replaces the Vercel Blob rules)

| Environment | Storage | How |
|-------------|---------|-----|
| **Local dev** | Miniflare R2 bucket | `r2Storage({ bucket: env.R2 })` — same code as prod |
| **Production** | Cloudflare R2 | Same binding, real bucket, zero egress |

Because `sharp` cannot run on Workers, **Payload does not generate thumbnails**. Resizing happens at the edge instead:

1. The original upload is stored in R2 exactly once.
2. A custom `next/image` loader rewrites requests to `/cdn-cgi/image/width=…,quality=…,format=auto/<origin-url>`.
3. Cloudflare resizes, converts to WebP/AVIF by client support, and caches the result at the edge.

This is strictly better than pre-generating three fixed sizes: any width is available, format negotiation is automatic, and storage stays at one object per image. Transformations are free up to 5,000 unique/month, then $0.50 per 1,000.

The loader must degrade gracefully — if `NEXT_PUBLIC_CF_IMAGES` is not enabled (e.g. on `workers.dev` before the custom domain is attached), it returns the original URL untouched so images still render.

### Bundle Budget

The Worker must stay under **10 MB compressed**. Check after every phase:

```
pnpm build && pnpm dlx opennextjs-cloudflare build
ls -la .open-next/worker.js
```

Rules that keep us inside the budget:
- GraphQL disabled (`graphQL: { disable: true }`)
- No `framer-motion`, no icon library other than `lucide-react` (tree-shaken imports only)
- No moment/dayjs/lodash/axios — native APIs only
- Client components only where genuinely interactive; Server Components by default
- Dynamic-import heavy client UI (cart drawer, dialogs)

### Agent Workflow for Local Dev

```
1. Install dependencies:
   pnpm install

2. Create local secrets:
   cp .dev.vars.example .dev.vars    (then fill PAYLOAD_SECRET)

3. Apply migrations to the local D1 database:
   pnpm payload migrate

4. Start the app:
   pnpm dev

5. First run only: visit http://localhost:3000/admin to create the first admin user.

6. Reset local data (nuke Miniflare state):
   rm -rf .wrangler/state && pnpm payload migrate

7. Preview the real Worker build before deploying:
   pnpm preview
```

---

## Design System & Visual Guidelines

> **CRITICAL: The agent MUST follow these guidelines exactly.** No creative interpretation. No dark mode. No gradients. No rounded-everything. The goal is a clean, professional, trustworthy e-commerce store — not a portfolio piece.

### Design Philosophy

KC Trading is a general merchandise store — it sells things like cleaning supplies, tools, bulk stationery, and household goods. The design must communicate **trust**, **clarity**, and **efficiency**. Customers are here to find products, see prices, and place orders quickly. The design should never compete with the products for attention.

Reference stores for visual direction: Emag.bg (Bulgarian e-commerce leader), Metro Cash & Carry (wholesale), Amazon (functional clarity). Not: Apple, Dribbble showcases, or design-award sites.

### Color Palette (Exact Values)

```
LIGHT THEME ONLY — Do not implement dark mode.

Primary:       #1E40AF  (Blue 800 — trustworthy, professional)
Primary Hover: #1E3A8A  (Blue 900 — darker on hover)
Primary Light: #DBEAFE  (Blue 100 — for highlights, selected states)

Secondary:     #475569  (Slate 600 — body text alternative, icons)

Background:    #FFFFFF  (White — page background)
Surface:       #F8FAFC  (Slate 50 — cards, sidebar, subtle sections)
Surface Alt:   #F1F5F9  (Slate 100 — table rows, hover backgrounds)

Text Primary:  #0F172A  (Slate 900 — headings, important text)
Text Body:     #334155  (Slate 700 — paragraphs, descriptions)
Text Muted:    #94A3B8  (Slate 400 — labels, placeholders, captions)

Border:        #E2E8F0  (Slate 200 — dividers, card borders, inputs)
Border Focus:  #1E40AF  (Primary — input focus rings)

Success:       #16A34A  (Green 600 — "in stock", success toasts)
Success Light: #DCFCE7  (Green 100 — success backgrounds)
Warning:       #D97706  (Amber 600 — "low stock", caution)
Warning Light: #FEF3C7  (Amber 100 — warning backgrounds)
Error:         #DC2626  (Red 600 — "out of stock", errors, required)
Error Light:   #FEE2E2  (Red 100 — error backgrounds)

Price:         #0F172A  (Slate 900 — prices must be high contrast)
Price Old:     #94A3B8  (Slate 400 + line-through — for discount strikethrough)
Price Sale:    #DC2626  (Red 600 — sale/discount prices)
```

### Typography

```
Font Family:   Inter (via next/font/google, weight 400/500/600/700)
Fallback:      system-ui, -apple-system, sans-serif

Scale (use Tailwind classes):
  Page title (h1):     text-2xl font-bold  (24px, 700) — max 1 per page
  Section heading (h2): text-xl font-semibold (20px, 600)
  Card heading (h3):   text-lg font-semibold (18px, 600)
  Body text:           text-base font-normal (16px, 400)
  Small text:          text-sm font-normal (14px, 400)
  Caption/label:       text-xs font-medium (12px, 500) — uppercase for labels
  Price (large):       text-2xl font-bold (24px, 700) — on product detail page
  Price (card):        text-lg font-bold (18px, 700) — on product cards

Line height:  Use Tailwind defaults (leading-normal = 1.5 for body)

DO NOT:
  - Use more than 2 font weights on a single page section
  - Use font sizes outside this scale
  - Use italic for anything except legal fine print
  - Use ALL CAPS for anything except tiny labels (12px)
  - Use letter-spacing adjustments
```

### Spacing & Layout

```
Max content width:     1280px (max-w-7xl), centered with mx-auto
Page horizontal pad:   px-4 (mobile), px-6 (tablet), px-8 (desktop)
Section vertical gap:  py-12 (48px) between major sections
Card gap:              gap-4 (16px) in grids, gap-6 (24px) for larger cards
Card padding:          p-4 (16px) internal padding
Card border:           border border-slate-200 rounded-lg
Card shadow:           shadow-sm (subtle, not dramatic)
Card hover:            shadow-md transition-shadow duration-150

Button padding:        px-4 py-2 (standard), px-6 py-3 (large/CTA)
Button border radius:  rounded-md (6px) — NOT rounded-full, NOT rounded-none
Input border radius:   rounded-md (6px)

Breakpoints (Tailwind defaults):
  Mobile:   < 640px   (default, mobile-first)
  Tablet:   sm: 640px
  Desktop:  md: 768px
  Wide:     lg: 1024px
  Max:      xl: 1280px

Product grid columns:
  Mobile:   1 column (full width cards)
  Tablet:   2 columns
  Desktop:  3 columns
  Wide:     4 columns
```

### Component Design Rules

```
BUTTONS:
  Primary CTA:     bg-primary text-white rounded-md font-medium
                   hover:bg-primary-hover active:scale-[0.98]
                   Min height: 44px (touch target)
  Secondary:       bg-white text-primary border border-primary rounded-md
                   hover:bg-primary-light
  Ghost/text:      text-primary hover:underline (for inline links)
  Destructive:     bg-red-600 text-white (for delete/cancel)
  Disabled:        opacity-50 cursor-not-allowed

INPUTS:
  Default:         border border-slate-200 rounded-md px-3 py-2 text-base
                   focus:border-primary focus:ring-2 focus:ring-primary/20
  Error state:     border-red-500 focus:border-red-500 focus:ring-red-500/20
  Label:           text-sm font-medium text-slate-700, mb-1.5 above input
  Help text:       text-xs text-slate-400, mt-1 below input
  Error message:   text-xs text-red-600, mt-1 below input

CARDS (Product):
  Container:       bg-white border border-slate-200 rounded-lg overflow-hidden
                   hover:shadow-md transition-shadow
  Image area:      aspect-square bg-slate-50 (placeholder color)
  Content area:    p-4
  Title:           text-base font-semibold text-slate-900, line-clamp-2
  Price:           text-lg font-bold text-slate-900
  Badge:           text-xs font-medium px-2 py-0.5 rounded-full
                   (e.g., "Bulk" badge: bg-blue-100 text-blue-800)

NAVIGATION:
  Header height:   h-16 (64px)
  Header bg:       bg-white border-b border-slate-200
  Nav link:        text-sm font-medium text-slate-600 hover:text-primary
  Active link:     text-primary font-semibold
  Mobile menu:     Sheet sliding from left, full height

BADGES / TAGS:
  In stock:        bg-green-100 text-green-800
  Low stock:       bg-amber-100 text-amber-800
  Out of stock:    bg-red-100 text-red-800
  Category:        bg-slate-100 text-slate-700
  Featured:        bg-blue-100 text-blue-800

TOAST NOTIFICATIONS:
  Success:         bg-green-50 border-green-200 text-green-800
  Error:           bg-red-50 border-red-200 text-red-800
  Info:            bg-blue-50 border-blue-200 text-blue-800
  Position:        bottom-right on desktop, bottom-center on mobile
```

### Strict Visual Do's and Don'ts

```
DO:
  ✓ Use whitespace generously — let the content breathe
  ✓ Keep product images on a clean white/light gray background
  ✓ Use consistent border-radius (rounded-md everywhere)
  ✓ Use the exact color palette above — no improvisation
  ✓ Make prices the most visually prominent element on product cards
  ✓ Use skeleton loading states (animated pulse) while content loads
  ✓ Ensure all interactive elements have visible focus states
  ✓ Use semantic HTML (<nav>, <main>, <article>, <section>)
  ✓ Test at 375px width (iPhone SE) — this is the minimum supported viewport
  ✓ Use next/image for ALL images (never raw <img>)

DO NOT:
  ✗ Use gradients anywhere (no bg-gradient-*)
  ✗ Use glassmorphism, neumorphism, or frosted glass effects
  ✗ Use animations beyond subtle transitions (no framer-motion, no GSAP)
  ✗ Use parallax scrolling or scroll-based animations
  ✗ Use custom cursor styles
  ✗ Use background images or patterns (solid colors only)
  ✗ Use more than 3 levels of shadow depth across the entire site
  ✗ Use colored backgrounds for page sections (white/slate-50 only)
  ✗ Use icon libraries beyond Lucide React (no FontAwesome, no Heroicons)
  ✗ Use carousels or sliders for products (use grids)
  ✗ Use floating action buttons
  ✗ Add decorative illustrations or SVG artwork
  ✗ Use loading spinners — use skeleton screens instead
  ✗ Implement dark mode or theme switching
  ✗ Use custom scrollbar styling
  ✗ Add sound effects or haptic feedback
  ✗ Use popover tooltips for essential information (use visible text)
```

### Page Layout Templates

```
HOMEPAGE:
  [Announcement Bar — optional, dismissible]
  [Header — sticky]
  [Hero Section — max-h-[400px], bg-slate-50, centered text + CTA]
  [Featured Products — "Препоръчани продукти" heading + 4-col grid]
  [Categories — grid of category cards with images]
  [Trust Signals — row of 4 icon+text blocks (shipping, COD, returns, quality)]
  [Footer]

PRODUCT LISTING:
  [Header]
  [Breadcrumbs — text-sm text-slate-400]
  [Page title + product count — "Продукти (142)"]
  [Filter bar — sticky on desktop: category, sort, in-stock toggle]
  [Product Grid — 4 columns]
  [Pagination — centered, numbered]
  [Footer]

PRODUCT DETAIL:
  [Header]
  [Breadcrumbs]
  [Two-column layout on desktop]
    Left:  Image gallery (main + thumbnails)
    Right: Title, SKU, price, tier table, quantity, Add to Cart
  [Full description — below, full width]
  [Related products — 4-col grid]
  [Footer]

CHECKOUT:
  [Header — simplified, no navigation, just logo + "Back to cart"]
  [Two-column on desktop]
    Left:  Contact info → Shipping → Legal checkboxes → Place Order
    Right: Order summary (sticky sidebar)
  [Footer — minimal, just legal links]
```

---

## Data Model

### Collections (Payload CMS)

```
Products
├── title (localized: bg, en)
├── slug (auto-generated from title)
├── description (localized, rich text)
├── shortDescription (localized, plain text)
├── sku (unique)
├── images (array of media uploads)
├── category (relationship → Categories)
├── basePrice (number, EUR)
├── pricingTiers (array)
│   ├── minQuantity (number)
│   ├── maxQuantity (number, optional)
│   └── pricePerUnit (number, EUR)
├── unit (enum: piece, kg, box, pack, meter, liter)
├── stock (number)
├── minOrderQuantity (number, default: 1)
├── weight (number, grams — for shipping calc)
├── isActive (boolean)
├── isFeatured (boolean)
├── seo (group: metaTitle, metaDescription, localized)
└── timestamps (createdAt, updatedAt)

Categories
├── title (localized)
├── slug
├── description (localized)
├── image (media)
├── parent (self-relationship for nesting)
├── sortOrder (number)
└── isActive (boolean)

Orders
├── orderNumber (auto-generated, e.g. KC-2026-00001)
├── status (enum: pending → confirmed → shipped → delivered → cancelled → returned)
├── customer (group)
│   ├── firstName
│   ├── lastName
│   ├── email
│   ├── phone (required — COD needs this)
│   └── acceptedTerms (boolean)
├── shippingAddress (group)
│   ├── street
│   ├── city
│   ├── postalCode
│   ├── country (default: Bulgaria)
│   └── notes (optional delivery instructions)
├── shippingMethod (enum: econt_office, econt_address, speedy_office, speedy_address)
├── econtOfficeCode / speedyOfficeCode (string, optional)
├── items (array)
│   ├── product (relationship → Products)
│   ├── title (snapshot — denormalized)
│   ├── sku (snapshot)
│   ├── quantity
│   ├── unitPrice (at time of order)
│   └── totalPrice
├── subtotal
├── shippingCost (number, EUR)
├── total
├── trackingNumber (string, admin-entered)
├── courierService (enum: econt, speedy)
├── adminNotes (textarea, internal)
├── locale (the language the order was placed in)
└── timestamps

Pages (CMS-managed static pages)
├── title (localized)
├── slug
├── content (localized, rich text — Lexical editor)
├── seo (group)
└── isPublished (boolean)

Media (built-in Payload collection)
├── file (upload)
├── alt (localized)
├── sizes (auto-generated thumbnails)
└── timestamps

Settings (Payload global)
├── siteName (localized)
├── logo (media)
├── contactEmail
├── contactPhone
├── address (localized)
├── socialLinks (array: platform, url)
├── shippingInfo (localized, rich text)
├── defaultCurrency (EUR)
├── enabledLocales (array)
└── announcementBar (localized, optional)
```

---

## Security Rules (Apply to EVERY Phase)

> **CRITICAL: The agent MUST follow these rules in every commit. Violations are blocking.**

### Authentication & Authorization
- Payload admin panel protected by built-in auth (email + password, bcrypt hashed)
- Admin users stored in a `Users` collection with role field (admin, editor)
- All admin API routes require authentication — Payload handles this by default
- NEVER expose Payload's API routes publicly without access control
- Rate-limit login attempts (use `payload-rate-limit` or custom middleware)

### Input Validation & Sanitization
- ALL user input validated on the server (Server Actions / Payload hooks)
- Use `zod` schemas for checkout form validation (both client + server)
- Sanitize rich text output — Payload's Lexical editor escapes by default
- Never use `dangerouslySetInnerHTML` — use Payload's serializer components
- Validate email format, phone format (Bulgarian: +359 or 0xxx xxx xxx)
- Validate quantities are positive integers within product min/max bounds

### CSRF & XSS
- Next.js Server Actions have built-in CSRF protection via origin checking
- Set `Content-Security-Policy` headers (script-src, style-src, img-src)
- Set `X-Content-Type-Options: nosniff`
- Set `X-Frame-Options: DENY`
- Set `Referrer-Policy: strict-origin-when-cross-origin`
- Set `Permissions-Policy` to restrict camera, microphone, geolocation

### Database Security
- Use parameterized queries only (Drizzle ORM does this by default)
- Never construct raw SQL from user input
- **There are no database credentials.** D1 is reached through a Worker binding, not a
  connection string — nothing to store, leak, or rotate. If a `DATABASE_URL` ever appears
  in this project, something has gone wrong
- Raw D1 access (`payload.db.drizzle`) is permitted only for the atomic stock/counter
  statements in Phase 5, and only with bound parameters

### Environment Variables
- `.dev.vars` in `.gitignore` — NEVER committed
- Use `.dev.vars.example` with placeholder values for documentation
- Production secrets live in Cloudflare (`wrangler secret put`), encrypted at rest,
  never in the repo and never in `wrangler.jsonc`
- Required secrets: `PAYLOAD_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`
- `wrangler.jsonc` `vars` holds **non-secret public config only** — it is committed

### Dependency Security
- Pin exact versions in `package.json` (no `^` or `~`)
- Keep every `@payloadcms/*` package on one identical version
- Run `pnpm audit` before every deployment
- Use only well-maintained packages (check last commit date, downloads)
- Minimize dependencies — prefer built-in Node.js APIs and Payload features

### File Upload Security
- Restrict upload MIME types to images only: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- Set max file size: 5MB per image
- R2 is object storage addressed by key, not a filesystem — path traversal is not
  possible by construction
- Generate unique filenames (UUID) to prevent enumeration attacks
- Validate the actual file signature, not just the client-supplied MIME type
- The R2 bucket stays private; media is served through the Worker or a dedicated
  read-only custom domain — never via a public bucket listing

### Headers & Transport
- Force HTTPS everywhere (Cloudflare handles SSL termination)
- Set `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- Use `HttpOnly`, `Secure`, `SameSite=Strict` flags on all cookies
- Set `X-DNS-Prefetch-Control: off`

---

## Legal Compliance Requirements (Bulgaria/EU)

> **These are legally mandatory. The agent MUST implement ALL of these.**

### 1. GDPR Compliance
- **Privacy Policy page** (localized BG + EN) covering:
  - Identity of the data controller (KC Trading business details)
  - Types of personal data collected (name, email, phone, address, order history)
  - Legal basis for processing (contract performance for orders, consent for marketing)
  - Data retention periods (order data: 5 years for tax; marketing consent: until withdrawn)
  - Third-party data sharing (courier services, email provider)
  - Data subject rights (access, rectification, erasure, portability, objection)
  - Contact details of data controller
  - Right to lodge complaint with CPDP (Commission for Personal Data Protection)
- **Consent mechanism**: Checkbox at checkout (NOT pre-ticked) for terms acceptance
- **Marketing opt-in**: Separate, optional checkbox for marketing emails
- **Data minimization**: Collect only what's needed for order fulfillment
- **Right to erasure**: Admin panel should have ability to anonymize customer data on request

### 2. Cookie Consent (ePrivacy Directive)
- **Cookie banner** on first visit with:
  - Clear explanation of cookie categories (Necessary, Analytics, Marketing)
  - Accept All / Reject All / Customize buttons
  - Link to Cookie Policy
  - Must NOT set non-essential cookies before consent
  - Must remember choice (store consent in a `necessary` cookie)
- **Cookie Policy page** (localized) listing each cookie, purpose, expiration
- For MVP: only use necessary cookies (session, cart, locale preference, consent choice) — no analytics cookies needed at launch, which simplifies compliance

### 3. Consumer Protection (Bulgarian Consumer Protection Act + EU Directives)
- **Pre-purchase information** (must be visible before checkout):
  - Full trader identity (company name, registration number, address)
  - Product main characteristics
  - Total price including VAT and all fees
  - Delivery costs
  - Payment method (COD)
  - Right of withdrawal (14-day cooling-off period)
  - Legal guarantee of conformity (2 years)
  - Complaint handling procedure
- **Right of Withdrawal**:
  - 14 days from receiving goods, no reason needed
  - Must provide a **withdrawal form** (downloadable or fillable online)
  - As of June 19, 2026: Must provide an **electronic withdrawal button/link** (EU Directive 2023/2673)
  - If withdrawal info not provided → period extends to 12 months + 14 days
  - Refund within 14 days of receiving the withdrawal notice
  - Customer bears return shipping costs (unless stated otherwise)
  - Exceptions: perishable goods, sealed hygiene goods if unsealed, custom-made items
- **Product information** must be displayed in Bulgarian language
- **Price display**: Show previous lowest price (last 30 days) for any discounted items

### 4. Bulgarian Electronic Commerce Act
- **Mandatory information on the website**:
  - Trader name and legal form
  - Registered office address
  - UIC (Unified Identification Code) / Bulstat number
  - Contact details (email, phone)
  - Registration with trade register
  - VAT number (if applicable)
- **Order confirmation**: Send electronic confirmation of order receipt
- **Terms and Conditions page** (localized)

### 5. Price Reduction Rules (CPA Amendment, Feb 2026)
- When showing a discount/sale price, must display the previous lowest price from the last 30 days
- Products on sale for less than 30 days: show previous lowest price from at least 7 days before the reduction
- This clarification takes full effect February 5, 2027, but implement now to be safe

---

## Git Branching & Commit Strategy

> **CRITICAL: The agent MUST follow this branching model for every phase.**

### Branch Structure

```
main                         ← production-ready code only (protected)
├── phase/0-scaffolding      ← branch for Phase 0
├── phase/1-data-model       ← branch for Phase 1
├── phase/2-i18n             ← branch for Phase 2
├── phase/3-storefront       ← branch for Phase 3
├── phase/4-cart              ← branch for Phase 4
├── phase/5-checkout          ← branch for Phase 5
├── phase/6-legal             ← branch for Phase 6
├── phase/7-admin             ← branch for Phase 7
├── phase/8-seo               ← branch for Phase 8
├── phase/9-error-handling    ← branch for Phase 9
└── phase/10-deployment       ← branch for Phase 10
```

### Workflow Rules for the Agent

```
FOR EACH PHASE:

1. Create the phase branch from main:
   git checkout main
   git pull origin main
   git checkout -b phase/N-short-name

2. FOR EACH COMMIT within the phase:
   - Implement the commit's instructions
   - Run `pnpm build` — fix any errors before proceeding
   - Run `pnpm dev` and manually verify the feature works
   - Stage and commit with a conventional commit message:
     git add -A
     git commit -m "feat(phase-N): description of what was built"
   - Use the commit numbering from the plan, e.g.:
     "feat(phase-0): initialize Next.js + Payload CMS project"        ← Commit 0.1
     "feat(phase-0): configure environment variables with zod"         ← Commit 0.2
     "feat(phase-1): add Products collection with pricing tiers"       ← Commit 1.1
     "fix(phase-1): correct pricing tier overlap validation"           ← bugfix mid-phase

3. After ALL commits in the phase are done:
   - Run full build one more time: `pnpm build`
   - Push the branch:
     git push -u origin phase/N-short-name
   - Open a real pull request (the repo has a GitHub remote):
     gh pr create --base main --title "Phase N — Short Description" --body "..."
   - The PR body states: what was built, what was verified, what was
     deliberately left out, and any decision the human should review.
   - Merge with a merge commit once CI is green:
     gh pr merge --merge --delete-branch=false
   - DO NOT delete the phase branch (keep for reference)

4. Move to the next phase (back to step 1)
```

**Why PRs and not direct merges:** each phase becomes a reviewable unit with a
diff the stakeholder can read at their own pace, and CI (lint + typecheck +
build) gates the merge. With no test suite, that gate is the safety net.

### Commit Message Convention

```
Format: <type>(<scope>): <description>

Types:
  feat     → new feature or functionality
  fix      → bug fix
  chore    → tooling, dependencies, config (no feature change)
  docs     → documentation only
  style    → formatting, no code change
  refactor → code change that neither fixes a bug nor adds a feature
  test     → adding or updating tests

Scope: phase-N or the specific area (e.g., cart, checkout, i18n)

Examples:
  feat(phase-3): add product listing page with filters and pagination
  fix(phase-5): recalculate prices server-side in checkout action
  chore(phase-0): add eslint and prettier configuration
  refactor(phase-4): extract pricing tier calculator to shared utility
```

### Important Rules

- **NEVER commit directly to main.** Always work on a phase branch.
- **NEVER move to the next phase until the current one builds cleanly.**
- **Every commit must leave the project in a buildable state.** If a commit introduces a TypeScript error or a broken import, fix it in the same commit, not the next one.
- **If a phase requires a hotfix to a previous phase:** Create a `fix/description` branch from main, fix it, merge to main, then rebase the current phase branch onto the updated main.

---

## Development Phases

---

### PHASE 0: Cloudflare-Native Scaffolding & Configuration

**Goal:** Rebuild the project on the Cloudflare stack. After this phase, `pnpm dev` starts Next.js with live D1 and R2 bindings emulated by Wrangler, and the Payload admin is reachable at `/admin` with no Docker and no connection strings.

> **This phase replaces the v1 Phase 0 entirely.** The v1 scaffold was Payload's `website` template on Postgres. It carried Pages-builder blocks, live preview, the admin bar, form-builder, redirects and a CMS-managed Header/Footer that this store does not use — all of it counting against a 10 MB Worker budget. We rebuild from the official `with-cloudflare-d1` template instead and port only what we need.

---

#### Commit 0.1: Rebuild scaffold on the Cloudflare template

**Instructions for agent:**

```
1. Take the official Payload template as the baseline:
   https://github.com/payloadcms/payload/tree/main/templates/with-cloudflare-d1

   Adopt from it verbatim:
   - src/app/(payload)/**            ← admin + REST route handlers
   - open-next.config.ts
   - the payload.config.ts binding-resolution pattern (see Commit 0.3)

2. Delete every artifact of the Postgres/Vercel scaffold:
   - docker-compose.yml, Dockerfile
   - src/migrations/** (Postgres SQL — cannot be reused on SQLite)
   - the website-template surface: Header/Footer CMS globals, blocks,
     live preview, AdminBar, PayloadRedirects, seed/BeforeDashboard components
   - next-sitemap (superseded by Next's native sitemap.ts in Phase 8)
   - the test harness: vitest, playwright, @testing-library, jsdom
     (explicit project decision — velocity over coverage; see "Testing Posture")

3. Pin dependency versions exactly — no ^ or ~ (Security Rules).
   Payload packages must all sit on ONE version. Mixed Payload versions
   produce runtime failures that look like unrelated bugs.

4. TypeScript strict mode, plus:
     "strict": true,
     "noUncheckedIndexedAccess": true,
     "forceConsistentCasingInFileNames": true
```

**Verification:** `pnpm install` resolves with no peer warnings. `pnpm lint` passes.

---

#### Commit 0.2: Wrangler configuration & bindings

**Instructions for agent:**

```
1. Create wrangler.jsonc:

   {
     "$schema": "node_modules/wrangler/config-schema.json",
     "main": ".open-next/worker.js",
     "name": "kc-commerce",
     "compatibility_date": "<today>",
     "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
     "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
     "d1_databases": [{ "binding": "D1", "database_name": "kc-commerce",
                        "database_id": "<placeholder>", "remote": true }],
     "r2_buckets":   [{ "binding": "R2", "bucket_name": "kc-commerce-media" }],
     "observability": { "enabled": true },
     "vars": { NEXT_PUBLIC_* non-secret config }
   }

   Add a "staging" environment block with its own D1 database and R2 bucket
   so preview deploys never touch production data.

2. database_id is a placeholder until the human runs `wrangler d1 create`.
   Local dev does NOT need a real id — Miniflare keys off database_name.
   Document this clearly; it is the #1 confusion point for this stack.

3. Generate binding types:
   wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts
   Commit the generated file so CI type-checks without Cloudflare access.

4. .gitignore: .wrangler/, .open-next/, .dev.vars
```

**Verification:** `pnpm exec wrangler types` regenerates cleanly; `CloudflareEnv` exposes `D1`, `R2`, `ASSETS`.

---

#### Commit 0.3: Payload config — D1, R2, and dual binding resolution

**Instructions for agent:**

```
1. payload.config.ts resolves bindings from two different sources:

   const cloudflare =
     isCLI || !isProduction
       ? await getCloudflareContextFromWrangler()   // Miniflare, local dev + CLI
       : await getCloudflareContext({ async: true }) // inside the deployed Worker

   The CLI branch matters: `payload migrate` runs in Node, NOT in the Worker,
   so it must reach D1 through Wrangler's platform proxy.

2. db: sqliteD1Adapter({ binding: cloudflare.env.D1 })
   storage: [ r2Storage({ bucket: cloudflare.env.R2, collections: { media: true } }) ]

3. graphQL: { disable: true }
   Unsupported on Workers AND a large bundle win. We use the Local API.

4. Custom logger: Workers has no pino transport. Route all levels through
   console.* with JSON payloads so Cloudflare's log stream stays structured
   and greppable. Level from PAYLOAD_LOG_LEVEL.

5. Auth hardening (moved forward from v1 Phase 1 — it belongs in config):
   tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 600000,
   cookies: { secure: true, sameSite: 'strict' }

6. Do NOT import sharp. It cannot run on Workers.
```

**Verification:** `pnpm payload migrate:create` connects to local D1 and writes a SQLite migration.

---

#### Commit 0.4: Typed environment access

**Instructions for agent:**

```
1. src/lib/env.ts — zod-validated, parsed once.

   Cloudflare splits config in two, and env.ts must reflect that honestly:
   - Secrets + vars arrive as process.env in the Worker (OpenNext maps them)
   - Bindings (D1/R2) are NOT env vars — never model them in this schema

   const envSchema = z.object({
     PAYLOAD_SECRET: z.string().min(32),
     NEXT_PUBLIC_SITE_URL: z.url(),
     RESEND_API_KEY: z.string().optional(),
     CRON_SECRET: z.string().optional(),
     NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['bg','en']).default('bg'),
   })

2. Validation must be lazy (a getter or a memoised function), NOT a bare
   top-level parse. A top-level throw during Worker module evaluation takes
   down every route including /admin, with an opaque error. Fail at the
   point of use with a message naming the missing variable.

3. NEVER read process.env anywhere else.

4. Create .dev.vars.example documenting every secret. .dev.vars is git-ignored.
```

**Verification:** Removing PAYLOAD_SECRET produces a clear named error, not a blank 500.

---

#### Commit 0.5: Security headers

**Instructions for agent:**

```
Same header set as v1 (CSP, nosniff, DENY, Referrer-Policy, Permissions-Policy,
HSTS, X-DNS-Prefetch-Control) with Cloudflare-specific corrections:

1. HSTS is set by Cloudflare at the edge too — set it in ONE place (middleware)
   and keep max-age consistent to avoid a conflicting duplicate header.

2. CSP must NOT be applied to /admin. Payload's admin panel needs inline
   scripts and styles; a storefront-grade CSP breaks it. Scope by path.

3. img-src must include the R2 custom domain and, when enabled, the
   /cdn-cgi/image transformation origin.

4. Middleware runs on every request and therefore inside the Worker's CPU
   budget. Keep it allocation-light: no JSON parsing, no crypto, no awaits
   beyond the intl matcher.
```

**Verification:** Headers present on storefront routes; `/admin` loads and functions.

---

#### Commit 0.6: Theming foundation

**Instructions for agent:**

```
The colour scheme is NOT agreed with stakeholders yet. It must be swappable
without touching component code. This is a hard requirement, not a nicety.

1. src/styles/theme.css is the single source of truth. Raw palette values are
   declared ONCE as CSS custom properties, then mapped to SEMANTIC tokens:

   :root {
     --brand-600: #1E40AF;          /* raw ramp — the only place hex appears */
     ...
     --color-primary: var(--brand-600);        /* semantic — what components use */
     --color-primary-hover: var(--brand-700);
     --color-surface: var(--slate-50);
     --color-price: var(--slate-900);
   }

2. Tailwind 4 CSS-first config maps semantic tokens to utilities via @theme
   inline, so `bg-primary` / `text-price` resolve to the variables above.

3. RULE: no hex value and no Tailwind numbered colour (bg-blue-800, text-slate-400)
   may appear in any component. Components reference semantic tokens only.
   Rebranding is then a single-file edit.

4. Ship the v1 blue palette from the Design System section as the DEFAULT,
   and add a second ready-made theme file to prove the swap works end to end.

5. Light theme only for now — but express it as a token layer, so adding a
   dark variant later is a media-query block, not a refactor.
```

**Verification:** Changing `--brand-600` in one file restyles every primary surface in the app.

---

#### Commit 0.7: Repo hygiene

**Instructions for agent:**

```
1. .gitignore: node_modules, .next, .open-next, .wrangler, .dev.vars, *.log, .DS_Store
2. .nvmrc: 24   (the Cloudflare template requires Node >= 24.15)
3. .prettierrc, eslint flat config, no-console: warn
4. README: the Wrangler workflow, NOT the old Docker workflow
```

### Testing Posture

Automated tests are **deliberately excluded** from this build. This is an explicit
stakeholder decision to prioritise velocity while the product surface is still moving.

The mitigations that replace them, which the agent MUST uphold:
- `pnpm build` must pass before every commit — the type system is the safety net,
  so strict mode and honest types are non-negotiable
- Money, stock, and order state are computed **server-side only**, never trusted
  from the client, so the highest-risk paths have no client-side surface to regress
- Every phase is manually exercised in both locales before merge

If tests are reintroduced later, start with the checkout server action — it is the
only code in this project where a silent regression costs real money.

---

### PHASE 1: Data Model — Collections & Globals

**Goal:** Define all Payload CMS collections matching the data model above. After this phase, the admin panel at `/admin` allows CRUD operations on all collections.

---

#### Commit 1.1: Products Collection

**Instructions for agent:**

```
Create src/collections/Products.ts

Key implementation details:
- Enable localization on: title, description, shortDescription, seo fields
- slug field: auto-generated from title using Payload's beforeValidate hook
  Use a slugify function that handles both Latin and Cyrillic characters.
  IMPORTANT: Slug should be generated from the English title if available,
  falling back to Bulgarian. Cyrillic slugs are valid but Latin is preferred for URLs.
- pricingTiers: Array field with validation hook ensuring:
  - minQuantity of first tier equals product's minOrderQuantity
  - Tiers don't overlap (each tier's minQuantity > previous tier's maxQuantity)
  - At least one tier exists
- basePrice: This is the default single-unit price. Tiers override for bulk.
- images: Array of upload fields pointing to Media collection, max 10
- stock: Number field with min: 0 validation
- Access control:
  - read: () => true (public)
  - create/update/delete: authenticated admin users only
- Add beforeChange hook: If stock reaches 0, set isActive to false
  (or add a virtual field like 'inStock' computed from stock > 0)
- Add a custom admin component or virtual field showing the price breakdown
  table for quick reference in the admin panel

Use Payload field types:
  text, textarea, richText (Lexical), number, select, relationship,
  upload, checkbox, group, array, row (for side-by-side layout in admin)
```

---

#### Commit 1.2: Categories Collection

**Instructions for agent:**

```
Create src/collections/Categories.ts

- title: localized text
- slug: auto-generated from English title, unique
- description: localized textarea
- image: single upload relationship to Media
- parent: self-referencing relationship for nested categories
  Set maxDepth: 2 (max 3 levels: grandparent > parent > child)
- sortOrder: number field for custom ordering
- isActive: checkbox, default true
- Add a beforeDelete hook: prevent deletion if products reference this category
  (or cascade-set those products to uncategorized)
- Access: read public, write admin-only
- Admin config: useAsTitle: 'title', defaultSort: 'sortOrder'
```

---

#### Commit 1.3: Orders Collection

**Instructions for agent:**

```
Create src/collections/Orders.ts

This is the most complex collection. Key details:

- orderNumber: text field, unique, NOT editable after creation
  Generate in a beforeValidate hook: "KC-" + year + "-" + zero-padded sequence

  CONCURRENCY: SQLite has no sequences, and read-then-write in JS races.
  Use a dedicated `counters` table and one atomic statement:

    INSERT INTO counters (key, value) VALUES (?1, 1)
    ON CONFLICT(key) DO UPDATE SET value = value + 1
    RETURNING value

  Key it per year ("orders:2026") so numbering restarts each January.
  Do NOT use a Payload global for this — globals are read-modify-write through
  the ORM and will hand two simultaneous orders the same number.

  Consume a number only AFTER stock has been successfully reserved, so failed
  checkouts do not burn sequence numbers and leave visible gaps in the order book.

- status: select field with options:
  pending, confirmed, processing, shipped, delivered, cancelled, returned
  Default: "pending"
  Add afterChange hook: When status changes to "shipped", send email to customer
  with tracking number. When status changes to "confirmed", send confirmation email.

- customer: group field with:
  - firstName (required)
  - lastName (required)
  - email (required, validated with zod email regex)
  - phone (required, validated: Bulgarian format)
  - acceptedTerms (checkbox, required: true)
  - marketingConsent (checkbox, default: false)

- shippingAddress: group field with:
  - street (required)
  - city (required)
  - postalCode (required, validated: Bulgarian format 4 digits)
  - country (default: "Bulgaria", hidden for now)
  - notes (optional textarea)

- shippingMethod: select field:
  econt_office, econt_address, speedy_office, speedy_address
  Required.

- econtOfficeCode / speedyOfficeCode: text field, conditional visibility
  (show only when corresponding shipping method is selected)

- items: array field (NOT editable after creation):
  Each item: product (relationship), title (text snapshot), sku (text snapshot),
  quantity (number), unitPrice (number), totalPrice (number)
  All item fields are admin-readOnly after creation. These are snapshots of the
  product at order time — prices may change later but the order record must not.

- subtotal, shippingCost, total: number fields (calculated, admin-readOnly)
  Set in a beforeValidate hook by summing items.

- trackingNumber: text field (admin enters this manually)
  When this field is updated and status is "shipped", trigger the shipping email.

- courierService: select (econt, speedy)

- adminNotes: textarea, admin-only visibility

- locale: text field storing the locale the order was placed in

- Access control:
  - read: admin only (customers don't have accounts)
  - create: public (the checkout form creates orders via Server Action)
    BUT: use a beforeChange hook to validate all fields server-side,
    recalculate prices from the actual product data (NEVER trust client prices),
    and verify stock availability.
  - update/delete: admin only

- CRITICAL SECURITY: The create access being public means the Server Action
  that creates orders MUST:
  1. Re-fetch product prices from the database (never use prices sent by client)
  2. Re-validate stock (decrement stock atomically)
  3. Validate all fields with zod
  4. Rate-limit order creation (max 5 orders per IP per hour)
```

---

#### Commit 1.4: Pages Collection & Settings Global

**Instructions for agent:**

```
1. Create src/collections/Pages.ts:
   - title: localized
   - slug: unique, auto-generated
   - content: localized richText (Lexical editor)
   - seo: group with metaTitle, metaDescription (localized)
   - isPublished: checkbox
   - Access: read public (filter by isPublished), write admin

2. Create src/globals/Settings.ts (Payload global — single document):
   - siteName: localized text
   - logo: upload
   - contactEmail: email field
   - contactPhone: text
   - address: localized textarea
   - socialLinks: array of { platform (select: facebook, instagram, viber, telegram), url }
   - shippingInfo: localized richText (explain shipping methods, costs, COD info)
   - announcementBar: group { text (localized), isActive (checkbox), link (text, optional) }
   - footerText: localized richText
   - companyInfo: group (for legal compliance):
     - companyName
     - registrationNumber (UIC/Bulstat)
     - vatNumber (optional)
     - registeredAddress
     - tradeRegisterInfo

   This global is editable from admin and queried in layout components.
```

---

#### Commit 1.5: Media Collection Configuration

**Instructions for agent:**

```
Configure the built-in Media collection in src/collections/Media.ts:

- alt: localized text field (required for accessibility)
- Restrict MIME types: image/jpeg, image/png, image/webp, image/avif
- Max file size: 5MB
- **Do NOT configure imageSizes, crop, or focalPoint.** `sharp` cannot run on
  Workers, so Payload has no image processor. Set:
    upload: { crop: false, focalPoint: false }
  Responsive variants come from Cloudflare Image Transformations at request time
  instead — one stored original, any width on demand. See Phase 8.
- Set unique filename generation using a beforeChange hook:
  Generate a UUID-based filename to prevent enumeration.
  Preserve the original file extension.
- Storage is the R2 binding in BOTH dev and prod (Miniflare emulates it locally),
  so there is no dev/prod divergence to test around.
```

---

#### Commit 1.6: Users Collection & Access Control

**Instructions for agent:**

```
Configure src/collections/Users.ts (Payload creates this by default):

- Extend with a 'role' field: select with options 'admin' and 'editor'
- Admin: full CRUD on everything
- Editor: can manage products, categories, orders — but NOT users or settings
- Configure access control functions:

  const isAdmin = ({ req: { user } }) => user?.role === 'admin'
  const isAdminOrEditor = ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor'

- Apply these across all collections:
  - Users: admin only
  - Settings: admin only
  - Products, Categories, Orders, Pages, Media: admin or editor

- Set auth config in payload.config.ts:
  - tokenExpiration: 7200 (2 hours)
  - maxLoginAttempts: 5
  - lockTime: 600000 (10 minutes lockout after 5 failed attempts)
  - cookies: { secure: true, sameSite: 'strict' }

- Create a seed script (src/seed.ts) that creates an initial admin user
  if no users exist. Credentials come from env vars:
  INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD
  This runs on first startup via Payload's onInit hook.
```

---

#### Commit 1.7: Register Collections & Run Migrations

**Instructions for agent:**

```
1. Update src/payload.config.ts to register all collections and globals:
   import { Products } from './collections/Products'
   import { Categories } from './collections/Categories'
   import { Orders } from './collections/Orders'
   import { Pages } from './collections/Pages'
   import { Media } from './collections/Media'
   import { Users } from './collections/Users'
   import { Settings } from './globals/Settings'

   export default buildConfig({
     collections: [Products, Categories, Orders, Pages, Media, Users],
     globals: [Settings],
     localization: {
       locales: [
         { label: 'Bulgarian', code: 'bg' },
         { label: 'English', code: 'en' },
       ],
       defaultLocale: 'bg',
       fallback: true,  // fallback to default locale if translation missing
     },
     db: sqliteD1Adapter({ binding: cloudflare.env.D1 }),
     graphQL: { disable: true },
     // ... rest of config
   })

2. Run migrations:
   pnpm payload migrate:create
   pnpm payload migrate

3. Verify in Payload admin: all collections appear with correct fields.
   Create a test product, category, and order to verify relationships work.

4. Commit: "feat: define all CMS collections and globals with access control"
```

---

### PHASE 2: Internationalization (BG + EN)

**Goal:** Full bilingual support. All UI strings in both languages, locale-based routing, language switcher, RTL not needed (both BG and EN are LTR).

---

#### Commit 2.1: next-intl Setup & Routing

**Instructions for agent:**

```
1. Set up next-intl with App Router middleware:

   Create src/i18n/routing.ts:
   - Define locales: ['bg', 'en']
   - Default locale: 'bg'
   - Locale prefix: 'as-needed' (no /bg prefix for default locale, /en for English)

   Create src/i18n/request.ts:
   - Configure getRequestConfig for server components

2. Update src/middleware.ts:
   - Add next-intl middleware for locale detection
   - Detect from: 1) URL prefix, 2) cookie, 3) Accept-Language header
   - Combine with the security headers from Phase 0

3. Create message files:
   src/i18n/messages/bg.json
   src/i18n/messages/en.json

   Start with structural keys (fill translations in later commits):
   {
     "common": {
       "home": "Начало" / "Home",
       "products": "Продукти" / "Products",
       "categories": "Категории" / "Categories",
       "cart": "Количка" / "Cart",
       "checkout": "Поръчка" / "Checkout",
       "search": "Търсене" / "Search",
       "language": "Език" / "Language",
       "currency": "EUR",
       "addToCart": "Добави в количката" / "Add to Cart",
       "buyNow": "Купи сега" / "Buy Now",
       "outOfStock": "Изчерпано" / "Out of Stock",
       "inStock": "В наличност" / "In Stock",
       "quantity": "Количество" / "Quantity",
       "price": "Цена" / "Price",
       "total": "Общо" / "Total",
       "subtotal": "Междинна сума" / "Subtotal",
       "shipping": "Доставка" / "Shipping",
       "contact": "Контакти" / "Contact",
       "about": "За нас" / "About",
       "terms": "Общи условия" / "Terms & Conditions",
       "privacy": "Поверителност" / "Privacy Policy",
       "cookies": "Бисквитки" / "Cookie Policy",
       "withdrawal": "Право на отказ" / "Right of Withdrawal"
     },
     "product": { ... },
     "cart": { ... },
     "checkout": { ... },
     "legal": { ... },
     "errors": { ... }
   }

4. Wrap the app layout with NextIntlClientProvider.

5. Update all route groups to use [locale] dynamic segment:
   src/app/[locale]/(frontend)/page.tsx  ← homepage
   src/app/[locale]/(frontend)/products/page.tsx
   etc.

   Payload admin routes (/admin) should NOT be under [locale].
```

---

#### Commit 2.2: Language Switcher Component

**Instructions for agent:**

```
Create src/components/LanguageSwitcher.tsx:

- A simple button/dropdown that switches between BG and EN
- When clicked, navigates to the same page in the other locale
- Use next-intl's useRouter and usePathname hooks
- Save preference in a cookie (locale_preference)
- Display: "BG | EN" toggle style, or flag icons, or a dropdown
  Keep it minimal — just text labels "BG" and "EN"
- Must work on mobile (touch-friendly, min 44x44px tap target)
- Place in the header, top-right area
```

---

### PHASE 3: Storefront — Layout & Core Pages

**Goal:** Build the customer-facing storefront with all main pages. Clean, modern light theme. Mobile-first responsive design.

---

#### Commit 3.1: Design System & Layout Components

**Instructions for agent:**

```
1. The theme layer already exists from Commit 0.6 — do NOT redefine colours here.
   Tailwind 4 is CSS-first: there is no tailwind.config.ts colour block. The
   palette lives in src/styles/theme.css and is exposed through @theme inline.

   This phase only CONSUMES semantic tokens:
     bg-surface, text-body, border-default, bg-primary, text-price, …

   HARD RULE, enforced by lint: no hex literals and no numbered Tailwind colours
   (bg-blue-800, text-slate-400) in any component under src/components or
   src/app. The stakeholders have not signed off on the palette, and a rebrand
   must stay a one-file change.

   - Light theme only for now; tokens are structured so a dark variant is
     additive later.
   - Font: Inter via next/font (self-hosted, subset, display: swap).
   - Spacing and radius are tokens too (--radius-md), not per-component values.

2. Install shadcn/ui components (cherry-pick what's needed):
   npx shadcn@latest init
   npx shadcn@latest add button card input label select textarea badge
   npx shadcn@latest add dialog sheet dropdown-menu separator skeleton
   npx shadcn@latest add toast form table tabs accordion

3. Create layout components:
   src/components/layout/Header.tsx
   - Logo (left)
   - Navigation links: Home, Products, Categories (dropdown), About
   - Search bar (center or expandable)
   - Cart icon with item count badge (right)
   - Language switcher (right)
   - Mobile: hamburger menu with slide-out sheet
   - Sticky header on scroll (compact version)

   src/components/layout/Footer.tsx
   - Company information (from Settings global — legal requirement)
   - Navigation links
   - Contact info
   - Social links
   - Legal links: Terms, Privacy, Cookies, Withdrawal
   - "© 2026 KC Trading" with company registration info
   - Payment info: "Наложен платеж / Cash on Delivery"

   src/components/layout/AnnouncementBar.tsx
   - Dismissible banner at top of page
   - Content from Settings global
   - e.g., "Безплатна доставка за поръчки над 100 лв!" / "Free shipping on orders over €50!"

4. Create the root layout:
   src/app/[locale]/(frontend)/layout.tsx
   - Import and render Header, Footer, AnnouncementBar
   - Set metadata (title, description) with localized defaults
   - Include the cookie consent banner (built in Phase 6)

5. DESIGN PRINCIPLES for the agent:
   - Mobile-first: design for 375px width, then scale up
   - Max content width: 1280px, centered
   - Generous whitespace (padding, margins)
   - Consistent spacing scale (Tailwind's default is fine)
   - All interactive elements: min 44x44px touch target
   - Skeleton loading states for async content
   - Smooth transitions (150-200ms) for hover/focus states
   - Focus-visible outlines for keyboard navigation (accessibility)
   - All images have alt text
   - Semantic HTML: <nav>, <main>, <article>, <section>, <footer>
```

---

#### Commit 3.2: Homepage

**Instructions for agent:**

```
Create src/app/[locale]/(frontend)/page.tsx

Server Component — fetch data using Payload Local API:
   import { getPayload } from 'payload'
   import config from '@payload-config'

   const payload = await getPayload({ config })
   const featuredProducts = await payload.find({
     collection: 'products',
     where: { isFeatured: { equals: true }, isActive: { equals: true } },
     limit: 8,
     locale: currentLocale,
   })

Homepage sections:
1. Hero section:
   - Large banner with headline (localized) and CTA button
   - Could be a static design or CMS-managed (use a "hero" field in Settings global)
   - Clean typography, compelling value proposition
   - e.g., "Качествени стоки на едро и дребно" / "Quality goods, retail and wholesale"

2. Featured products grid:
   - 4-column grid (desktop), 2-column (tablet), 1-column (mobile)
   - Product cards with: image, title, base price, "from €X" for bulk pricing
   - Link to product detail page

3. Categories showcase:
   - Grid or row of category cards with images
   - Link to category listing pages

4. Why choose us / Trust signals:
   - Icons + text: Fast shipping, COD payment, Quality guarantee, 14-day returns
   - Localized

5. CTA section:
   - "Browse all products" button

All data fetched server-side. No client-side fetching on the homepage.
```

---

#### Commit 3.3: Product Listing Page

**Instructions for agent:**

```
Create src/app/[locale]/(frontend)/products/page.tsx (all products)
Create src/app/[locale]/(frontend)/products/[slug]/page.tsx (product detail — Commit 3.4)
Create src/app/[locale]/(frontend)/categories/[slug]/page.tsx (products by category)

Product listing page:
- Server Component with searchParams for filtering/pagination
- URL-based state: ?category=xxx&sort=price_asc&page=2&q=searchterm
- Filters sidebar (desktop) / filter sheet (mobile):
  - Category filter (multi-select with checkboxes)
  - Price range (min/max inputs)
  - Availability: "In stock only" toggle
  - Sort: Newest, Price low→high, Price high→low, Name A→Z
- Product grid: same card component as homepage
- Pagination: numbered pages with prev/next
  Use Payload's paginate option: { limit: 12, page: pageNumber }
- Empty state: "No products found" with reset filters button
- Loading state: skeleton cards

Product card component (src/components/product/ProductCard.tsx):
- Image (use next/image with sizes prop for responsive loading)
- Title (localized)
- Price display:
  - If no tiers: show basePrice
  - If tiers: show "от €X" / "from €X" (lowest tier price)
  - If on sale (future feature): show old price struck through
- Category badge
- "Out of stock" overlay if stock === 0
- Hover effect: subtle scale or shadow
- Click → navigate to product detail page

SEO: Generate metadata with product count, category name, etc.
```

---

#### Commit 3.4: Product Detail Page

**Instructions for agent:**

```
Create src/app/[locale]/(frontend)/products/[slug]/page.tsx

This is a critical page — must be well-designed and informative.

1. Generate static params for SSG:
   export async function generateStaticParams() {
     const payload = await getPayload({ config })
     const products = await payload.find({
       collection: 'products',
       limit: 1000,
       select: { slug: true },
     })
     return products.docs.map(p => ({ slug: p.slug }))
   }

2. Fetch product data server-side with locale.

3. Page layout:
   LEFT (desktop) / TOP (mobile): Image gallery
   - Main image (large)
   - Thumbnail strip below for additional images
   - Click thumbnail to switch main image
   - Consider a lightbox for zoom (optional — simple modal is fine)
   - Use next/image with priority on the main image

   RIGHT (desktop) / BELOW (mobile): Product info
   - Title (large, bold)
   - SKU display
   - Short description
   - Price section:
     * Base price prominently displayed
     * Pricing tier table if tiers exist:
       "1-9 бр: €5.00 | 10-49 бр: €4.50 | 50+ бр: €3.80"
       Highlight the current tier based on selected quantity
     * Unit label (per piece, per kg, etc.)
   - Stock status: "В наличност (X бр.)" / "In Stock (X pcs)"
     or "Изчерпано" / "Out of Stock"
   - Quantity selector:
     * Number input with +/- buttons
     * Min: product's minOrderQuantity
     * Max: product's stock
     * When quantity changes, update displayed unit price based on tier
   - Add to Cart button (large, primary color)
     * Disabled if out of stock
     * Shows loading spinner while adding
     * Success toast: "Added to cart"
   - Shipping info summary (from Settings global)

   BELOW: Full description (rich text, localized)

   BELOW: Related products (same category, 4 items)

4. SEO: Dynamic metadata with product title, description, image (Open Graph)
   Generate JSON-LD structured data (Product schema):
   {
     "@context": "https://schema.org",
     "@type": "Product",
     "name": "...",
     "description": "...",
     "image": "...",
     "sku": "...",
     "offers": {
       "@type": "Offer",
       "price": "...",
       "priceCurrency": "EUR",
       "availability": "https://schema.org/InStock",
       "seller": { "@type": "Organization", "name": "KC Trading" }
     }
   }
```

---

#### Commit 3.5: Search Functionality

**Instructions for agent:**

```
Implement search using Payload's built-in full-text search.

1. Add search index to Products collection:
   In the collection config, set defaultSort and add a search field
   or use Payload's search plugin if available.

   Simple approach: Use Payload's 'like' operator for text search:
   payload.find({
     collection: 'products',
     where: {
       or: [
         { title: { like: searchTerm } },
         { description: { like: searchTerm } },
         { sku: { equals: searchTerm } },
       ],
       isActive: { equals: true },
     },
   })

2. Create a search bar component:
   - Debounced input (300ms)
   - Shows in header (expandable on mobile)
   - As user types, show search results dropdown (client-side)
   - Use a Server Action or API route for search
   - Results show: product image, title, price
   - Click result → navigate to product page
   - "View all results" link → /products?q=searchterm
   - Empty state: "No results for 'X'"

3. For MVP, basic `like` search is fine. When it stops being enough, the D1
   upgrade path is SQLite **FTS5** — a virtual table kept in sync by a Payload
   afterChange hook. That is a Phase-8+ optimisation, not MVP work.
   Do NOT add Algolia or Elasticsearch at this stage — overkill, and every
   client SDK eats into the Worker bundle budget.
```

---

### PHASE 4: Shopping Cart

**Goal:** Client-side shopping cart using Zustand with localStorage persistence. No user accounts needed — cart is anonymous.

---

#### Commit 4.1: Cart Store

**Instructions for agent:**

```
Create src/stores/cart.ts using Zustand with persist middleware:

interface CartItem {
  productId: string
  slug: string
  title: string        // snapshot (localized at time of adding)
  image: string        // URL of first product image
  basePrice: number
  unitPrice: number    // calculated based on quantity and pricing tiers
  quantity: number
  maxStock: number     // to prevent over-ordering
  unit: string         // piece, kg, box, etc.
  pricingTiers: PricingTier[]  // stored so we can recalculate on qty change
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getSubtotal: () => number
  getItemCount: () => number
}

Key behaviors:
- addItem: If product already in cart, increment quantity (respecting max stock)
- updateQuantity: Recalculate unitPrice based on pricing tiers for new quantity
- Persist to localStorage (zustand/middleware persist)
- On hydration: handle SSR mismatch by initializing empty and loading from
  localStorage in useEffect (prevent hydration errors)

IMPORTANT: The cart stores product snapshots for display purposes,
but at checkout, ALL prices are re-validated server-side from the database.
Never trust client-side prices for order creation.

Create a utility function:
function calculateTierPrice(quantity: number, tiers: PricingTier[], basePrice: number): number
  - If no tiers, return basePrice
  - Find the tier where quantity >= minQuantity and quantity <= maxQuantity
  - Return that tier's pricePerUnit
  - If no tier matches (quantity below first tier), return basePrice
```

---

#### Commit 4.2: Cart UI Components

**Instructions for agent:**

```
1. Cart icon in header (src/components/cart/CartIcon.tsx):
   - Shopping bag/cart icon
   - Badge showing item count (use zustand store's getItemCount)
   - Click opens cart sheet (slide-out drawer from right side)
   - Handle hydration: show 0 count on server, update on client mount

2. Cart sheet / drawer (src/components/cart/CartDrawer.tsx):
   - Uses shadcn Sheet component
   - Lists all cart items:
     - Product image (small)
     - Title
     - Unit price (with tier info if applicable)
     - Quantity controls (+/- buttons, direct input)
     - Item total
     - Remove button (trash icon)
   - Shows subtotal at bottom
   - "View Cart" button → /cart page
   - "Checkout" button → /checkout page
   - Empty state: "Your cart is empty" with "Browse products" link

3. Full cart page (src/app/[locale]/(frontend)/cart/page.tsx):
   - Detailed cart table/list
   - Quantity editing with live price recalculation
   - Pricing tier hints: "Add X more for a lower price per unit!"
   - Subtotal, estimated shipping, total
   - "Continue Shopping" and "Proceed to Checkout" buttons
   - This is a Client Component (needs zustand state)

4. Add-to-cart button component (src/components/product/AddToCartButton.tsx):
   - Accepts product data as props
   - Handles quantity selection
   - Calls cart store's addItem
   - Shows toast notification on success
   - Disabled state when out of stock
```

---

### PHASE 5: Checkout & Order Flow

**Goal:** Complete checkout form with COD, order creation via Server Action, confirmation page, and email notifications.

---

#### Commit 5.1: Checkout Page & Form

**Instructions for agent:**

```
Create src/app/[locale]/(frontend)/checkout/page.tsx

This is a Client Component (form state) wrapping a Server Action for submission.

Checkout form sections:

1. ORDER SUMMARY (top/sidebar):
   - Read from cart store
   - List items with quantities and prices
   - Subtotal
   - Shipping cost (flat rate or calculated — for MVP use flat rate per method)
   - Total
   - Non-editable here (link back to cart to modify)

2. CONTACT INFORMATION:
   - First name* (text input)
   - Last name* (text input)
   - Email* (email input)
   - Phone* (tel input, with +359 prefix helper)
   All fields required. Validate with zod on blur and on submit.

3. SHIPPING METHOD:
   - Radio group:
     * Econt — до офис (to office) → show office selector
     * Econt — до адрес (to address) → show address fields
     * Speedy — до офис (to office) → show office selector
     * Speedy — до адрес (to address) → show address fields
   - Office selector: For MVP, a text input where user types their preferred
     office name/code. Full Econt/Speedy office API integration is a later phase.
   - Address fields (when "to address" selected):
     * Street address*
     * City*
     * Postal code* (4 digits for Bulgaria)
     * Delivery notes (optional textarea)

4. SHIPPING COST:
   - Display based on selected method
   - For MVP: Define flat rates in Settings global or constants:
     econt_office: €3.50, econt_address: €5.00
     speedy_office: €3.50, speedy_address: €5.00
   - Adjust these in admin later

5. LEGAL AGREEMENTS (required checkboxes, NOT pre-ticked):
   - ☐ "I agree to the Terms and Conditions" (link opens in new tab)
   - ☐ "I have read the Privacy Policy" (link opens in new tab)
   - ☐ "I understand my right to withdraw within 14 days" (link opens in new tab)
   - ☐ "I consent to receiving marketing emails" (OPTIONAL, separate from above)

6. PLACE ORDER button:
   - Text: "Поръчай с наложен платеж" / "Place Order (Cash on Delivery)"
   - Must clearly indicate that this creates a payment obligation (EU requirement)
   - Disabled until all required fields valid and agreements checked
   - Shows loading spinner during submission

7. FORM VALIDATION (zod schema):
   - Client-side: Validate on field blur and form submit
   - Server-side: SAME zod schema validated in the Server Action
   - Display inline error messages below each field
   - Scroll to first error on submit failure
```

---

#### Commit 5.2: Order Creation Server Action

**Instructions for agent:**

```
Create src/app/[locale]/(frontend)/checkout/actions.ts

'use server'

This is the most security-critical code in the application.

export async function createOrder(formData: CheckoutFormData) {
  // 1. VALIDATE all form data with zod (server-side, never trust client)
  const validated = checkoutSchema.safeParse(formData)
  if (!validated.success) return { error: validated.error.flatten() }

  // 2. FETCH current product data from database
  //    For EACH item in the cart:
  //    - Verify product exists and isActive
  //    - Get current price and pricing tiers
  //    - Recalculate unitPrice based on quantity and current tiers
  //    - Verify stock >= requested quantity
  //    If any validation fails, return specific error
  //    (e.g., "Product X is no longer available" or "Only 5 units of X in stock")

  // 3. CALCULATE totals server-side
  //    - Sum item totals
  //    - Add shipping cost based on method
  //    - Calculate final total

  // 4. DECREMENT stock atomically
  //    *** D1 HAS NO INTERACTIVE TRANSACTIONS. Read this before writing code. ***
  //    You cannot BEGIN, do work, then COMMIT/ROLLBACK across awaits. Payload's
  //    beginTransaction() is a no-op on the D1 adapter. Overselling must be
  //    prevented WITHOUT a surrounding transaction.
  //
  //    Use the fact that a SINGLE UPDATE statement is atomic in SQLite:
  //
  //      UPDATE products SET stock = stock - ?1
  //      WHERE id = ?2 AND stock >= ?1
  //      RETURNING stock
  //
  //    - The WHERE clause is the guard. Two concurrent orders for the last unit:
  //      one UPDATE matches and returns a row, the other matches 0 rows. No lock
  //      needed, no lost update possible.
  //    - Run one statement per item, sequentially, tracking which succeeded.
  //    - If ANY item returns 0 rows: COMPENSATE — replay the successful
  //      decrements in reverse (stock = stock + qty) and fail the order with
  //      "Only N units of X remain". This is a saga, not a rollback: it is
  //      eventually consistent, and that is acceptable because the compensating
  //      write only ever RETURNS stock, never oversells.
  //    - Decrement BEFORE creating the order. If order creation then fails, run
  //      the same compensation. Reserving stock for an order that does not exist
  //      is recoverable; selling stock that does not exist is not.

  // 5. CREATE order via Payload Local API
  const payload = await getPayload({ config })
  const order = await payload.create({
    collection: 'orders',
    data: {
      status: 'pending',
      customer: { ... },
      shippingAddress: { ... },
      shippingMethod: validated.data.shippingMethod,
      items: validatedItems.map(item => ({
        product: item.productId,
        title: item.currentTitle,      // snapshot current title
        sku: item.currentSku,          // snapshot current SKU
        quantity: item.quantity,
        unitPrice: item.calculatedPrice, // server-calculated price
        totalPrice: item.quantity * item.calculatedPrice,
      })),
      subtotal: calculatedSubtotal,
      shippingCost: calculatedShipping,
      total: calculatedTotal,
      locale: currentLocale,
    },
  })

  // 6. SEND confirmation email (non-blocking — don't fail order if email fails)
  try {
    await sendOrderConfirmationEmail(order)
  } catch (emailError) {
    console.error('Failed to send confirmation email:', emailError)
    // Log but don't fail the order
  }

  // 7. RETURN order number for confirmation page
  return { success: true, orderNumber: order.orderNumber }
}

SECURITY NOTES:
- Rate limit this action: Use IP-based rate limiting (e.g., upstash/ratelimit
  or a simple in-memory store). Max 5 orders per IP per hour.
- NEVER return internal errors to the client — only user-friendly messages.
- Log all order creation attempts (successful and failed) for auditing.
- The stock decrement MUST be atomic (single guarded UPDATE, per above) to prevent
  overselling. Do NOT read stock, decide in JS, then write — that is a lost-update
  race and it WILL oversell under concurrency.
- Rate limiting on Workers: an in-memory counter is per-isolate and therefore
  useless as a limit. Use the Cloudflare WAF rate-limiting rule as the outer
  defence, and a D1-backed counter keyed by IP hash as the inner one. Never claim
  a limit is enforced when it is only enforced per isolate.
```

---

#### Commit 5.3: Order Confirmation Page

**Instructions for agent:**

```
Create src/app/[locale]/(frontend)/checkout/confirmation/page.tsx

- Receives orderNumber via searchParams: /checkout/confirmation?order=KC-2026-00001
- Displays:
  - Success icon/animation (checkmark)
  - "Thank you for your order!" (localized)
  - Order number prominently displayed
  - "You will receive a confirmation email at [email]"
  - Order summary (items, totals)
  - Shipping method and address
  - "What happens next?" section:
    1. "We will confirm your order within 24 hours"
    2. "You will receive a tracking number when shipped"
    3. "Pay on delivery to the courier"
  - Link to withdrawal form (legal requirement)
  - "Continue Shopping" button
- Clear the cart store on this page load
- This page should NOT be indexable (noindex meta tag)
- Do NOT display this page if no valid orderNumber — redirect to home
```

---

#### Commit 5.4: Email Templates

**Instructions for agent:**

```
Create email templates using React Email (works with Resend):

pnpm add @react-email/components

Create src/emails/OrderConfirmation.tsx:
- Clean, branded HTML email
- Subject: "KC Trading — Потвърждение на поръчка #KC-2026-00001"
  (use the order's locale for subject/content language)
- Content:
  - KC Trading logo
  - "Благодарим за вашата поръчка!" / "Thank you for your order!"
  - Order number
  - Items table (product, qty, price)
  - Subtotal, shipping, total
  - Shipping address
  - Payment method: Cash on Delivery
  - Right of withdrawal notice (legally required)
  - Contact information
  - Unsubscribe link (if marketing consent given)

Create src/emails/OrderShipped.tsx:
- Subject: "KC Trading — Вашата поръчка е изпратена"
- Content:
  - Order number
  - Tracking number
  - Courier service (Econt/Speedy)
  - Link to track (if available — Econt/Speedy tracking URLs)
  - Expected delivery info
  - COD amount to pay on delivery

Create src/lib/email.ts:
- Wrapper around Resend client
- sendOrderConfirmation(order)
- sendOrderShipped(order)
- Handle errors gracefully — email failure should NEVER break the order flow
```

---

### PHASE 6: Legal Compliance Pages

**Goal:** All legally required pages and components for EU/Bulgarian compliance.

---

#### Commit 6.1: Cookie Consent Banner

**Instructions for agent:**

```
Create src/components/legal/CookieConsent.tsx

Client Component that:
1. Checks for a 'cookie_consent' cookie on mount
2. If no consent cookie exists, shows a banner at the bottom of the page:
   - Text: "Този сайт използва бисквитки..." / "This site uses cookies..."
   - Brief explanation of what cookies are used for
   - Three buttons: "Accept All" / "Reject All" / "Customize"
   - Link to Cookie Policy page
3. If "Customize" clicked, show a modal/expandable with categories:
   - Necessary (always on, cannot be disabled):
     * Session management
     * Cart persistence
     * Language preference
     * Cookie consent choice
   - Analytics (off by default for MVP — no analytics at launch)
   - Marketing (off by default — no marketing cookies at launch)
4. On choice, set a 'cookie_consent' cookie with value:
   JSON: { necessary: true, analytics: false, marketing: false, timestamp: ISO date }
   Expiry: 365 days
5. The banner must NOT set any non-necessary cookies before consent
6. Design: Semi-transparent backdrop, clean card design, not intrusive
   but clearly visible. Fixed position at bottom.

IMPORTANT: For the MVP, since we only use necessary cookies
(cart in localStorage doesn't count as cookies, locale preference, consent itself),
the banner can be simpler. But implement the full structure now so it's ready
for when analytics (e.g., Plausible) is added later.
```

---

#### Commit 6.2: Legal Pages (CMS-Managed + Static)

**Instructions for agent:**

```
Some legal pages can be CMS-managed (via Pages collection), but the core ones
should have their templates hardcoded with slots for CMS content, to ensure
the required sections are always present.

1. Privacy Policy (/privacy):
   Create src/app/[locale]/(frontend)/privacy/page.tsx
   - Server Component that fetches from Pages collection (slug: 'privacy-policy')
   - If no CMS content exists, show a template with section headers:
     * Data Controller identity
     * What data we collect
     * Why we collect it (legal bases)
     * How long we keep it
     * Who we share it with
     * Your rights (access, rectification, erasure, portability, objection)
     * How to exercise your rights
     * Contact for data protection inquiries
     * Right to complain to CPDP
   - Localized content

2. Terms and Conditions (/terms):
   Create src/app/[locale]/(frontend)/terms/page.tsx
   - Must include:
     * Trader identity (company name, UIC, address, contact)
     * Product descriptions and pricing
     * Order process
     * Payment method (COD)
     * Shipping and delivery
     * Right of withdrawal (14 days)
     * Returns and refunds
     * Legal guarantee (2 years)
     * Limitation of liability
     * Governing law (Bulgarian)
     * Dispute resolution

3. Cookie Policy (/cookies):
   - List of all cookies used, their purpose, and expiration
   - Table format: Name | Purpose | Duration | Type

4. Right of Withdrawal (/withdrawal):
   Create src/app/[locale]/(frontend)/withdrawal/page.tsx
   - Explain the 14-day right
   - List exceptions (perishable, sealed hygiene, custom items)
   - Provide a downloadable withdrawal form (PDF)
   - Provide an online withdrawal form (name, order number, items, reason)
   - The online form should send an email to the admin and the customer
   - IMPORTANT: As of June 19, 2026, an electronic withdrawal function
     (button or clear link) is MANDATORY under EU Directive 2023/2673.
     This can be the online form — make it prominent and easy to find.

5. Contact page (/contact):
   - Company info from Settings global
   - Contact form (name, email, subject, message)
   - Send via Server Action + Resend to admin email
   - Show map (optional — can be a static image or embed)

6. About page (/about):
   - CMS-managed via Pages collection
```

---

#### Commit 6.3: Footer Legal Information

**Instructions for agent:**

```
Update the Footer component to include all legally required trader information:

- Company name and legal form
- UIC (Unified Identification Code) / Bulstat number
- Registered address
- VAT number (if applicable)
- Contact email and phone
- Trade register information

This data comes from the Settings global (companyInfo group).
Display it in a clearly visible section of the footer.

Also ensure all legal page links are present:
- Terms & Conditions
- Privacy Policy
- Cookie Policy
- Right of Withdrawal
- Contact

This is NOT optional — the Bulgarian Electronic Commerce Act requires
this information to be accessible from every page.
```

---

### PHASE 7: Admin Enhancements

**Goal:** Make the Payload admin panel practical for day-to-day order management.

---

#### Commit 7.1: Order Management Workflow

**Instructions for agent:**

```
Enhance the Orders collection admin experience:

1. Custom admin list view for orders:
   - Default columns: orderNumber, status (with color-coded badge), customer name,
     total, shippingMethod, createdAt
   - Default sort: newest first
   - Filters: status, shippingMethod, date range

2. Status transition validation (beforeChange hook):
   - pending → confirmed (admin reviews and accepts)
   - confirmed → processing (being prepared)
   - processing → shipped (must have trackingNumber filled)
   - shipped → delivered (admin confirms delivery)
   - Any status → cancelled (admin can cancel at any stage)
   - delivered → returned (if customer returns within 14 days)
   - PREVENT invalid transitions (e.g., delivered → processing)
   - Log status changes with timestamp and admin user ID

3. When status changes to "shipped":
   - Validate that trackingNumber is not empty
   - Validate that courierService is set
   - Trigger shipping notification email

4. Dashboard widget (optional but nice):
   - Show order counts by status
   - Today's orders
   - Revenue summary
   Payload supports custom admin components for this.
```

---

#### Commit 7.2: Bulk Pricing Admin UI

**Instructions for agent:**

```
Improve the pricing tiers UI in the Products collection admin:

1. Create a custom Payload field component for pricing tiers:
   - Visual table showing quantity ranges and prices
   - Auto-calculate savings percentage vs base price
   - Validation: tiers must not overlap, must be in ascending order
   - Preview of how the pricing will display on the storefront

2. Add a "Quick price update" feature:
   - Batch update prices for selected products (admin list view action)
   - e.g., "Increase all prices by 10%" or "Set new base price"
   - This is a Payload custom admin action

3. Stock management:
   - Show low-stock warning in admin list (e.g., stock < 10 = yellow badge)
   - Add ability to filter products by stock level
   - Consider adding a "restock" bulk action
```

---

### PHASE 8: SEO & Performance

**Goal:** Optimize for search engines and Core Web Vitals.

---

#### Commit 8.1: SEO Fundamentals

**Instructions for agent:**

```
1. Dynamic metadata for all pages:
   Use Next.js generateMetadata in each page:
   - Title: "Page Name | KC Trading" (localized)
   - Description: Localized, relevant to content
   - Open Graph: title, description, image, url, locale
   - Twitter Card: summary_large_image
   - Canonical URLs with locale prefix
   - hreflang tags for BG/EN alternate versions

2. Sitemap generation:
   Create src/app/sitemap.ts (Next.js built-in):
   - Include all active products
   - Include all active categories
   - Include all published pages
   - Include legal pages
   - Set changeFrequency and priority appropriately
   - Generate alternate URLs for each locale

3. robots.txt:
   Create src/app/robots.ts:
   - Allow all crawlers
   - Disallow /admin, /api (Payload API routes)
   - Reference sitemap URL

4. JSON-LD structured data:
   - Homepage: Organization schema + WebSite schema with SearchAction
   - Product pages: Product schema (already in Commit 3.4)
   - Category pages: CollectionPage schema
   - Breadcrumbs on all product/category pages (BreadcrumbList schema)
```

---

#### Commit 8.2: Performance Optimization

**Instructions for agent:**

```
1. Image optimization — Cloudflare, not Next's optimizer:
   - Next's built-in image optimizer needs sharp and CANNOT run on Workers.
     Do not set images.formats and expect it to work.
   - Instead register a custom loader in next.config.ts:
       images: { loader: 'custom', loaderFile: './src/lib/imageLoader.ts' }
   - The loader emits:
       /cdn-cgi/image/width=<w>,quality=<q>,format=auto,fit=scale-down/<src>
     format=auto gives AVIF/WebP by Accept header, cached at the edge.
   - The loader MUST pass the src through untouched when
     NEXT_PUBLIC_CF_IMAGES !== 'true' (workers.dev has no zone, so
     /cdn-cgi/image 404s there). Without this fallback, every image on the
     pre-domain deployment breaks.
   - Keep sizes props accurate — they drive the width the loader requests.
   - Priority on the hero and the first product image only.

2. Font optimization:
   - Use next/font for Inter (automatic subsetting and self-hosting)
   - Display: 'swap' for no FOIT

3. Bundle optimization (doubles as staying under the 10 MB Worker cap):
   - Dynamic import for heavy client components (cart drawer, dialogs)
   - React Server Components by default — client components only when needed
   - Import icons individually from lucide-react; never `import * as`
   - Re-check `.open-next/worker.js` size after this phase

4. Caching strategy:
   - ISR on Workers requires an incremental cache binding. Add an R2 bucket
     bound as NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc and enable it in
     open-next.config.ts — WITHOUT it, `revalidate` silently degrades to
     dynamic rendering on every request and the store gets slow and expensive.
   - Product pages: revalidate 3600. Category pages: 3600. Homepage: 1800.
   - Legal/static pages: fully static.
   - On-demand revalidation from Payload afterChange hooks via revalidateTag().
     Tag by collection and by slug so an edit to one product does not flush
     the whole catalogue.
   - Put Cloudflare Cache Rules in front of storefront GETs; bypass cache for
     /admin, /api, /checkout and anything carrying a Payload auth cookie.

5. Database query optimization (D1 specifics):
   - Select only needed fields (`select` option); depth: 0 for list views
   - Index: products.slug, products.isActive, products.category,
     orders.status, orders.orderNumber, categories.slug
   - D1 bills by rows read. An unindexed scan on the product list is not just
     slow, it is metered — check `wrangler d1 insights` after launch.
   - Enable read replicas (`readReplicas: 'first-primary'`) so storefront reads
     are served near the visitor while writes stay on the primary.
```

---

### PHASE 9: Testing & Error Handling

**Goal:** Robust error handling, 404/500 pages, and basic testing setup.

---

#### Commit 9.1: Error Pages

**Instructions for agent:**

```
1. Create src/app/[locale]/(frontend)/not-found.tsx:
   - Clean 404 page with localized message
   - "The page you're looking for doesn't exist"
   - Search bar
   - "Go to homepage" button
   - Show popular products or categories

2. Create src/app/[locale]/(frontend)/error.tsx:
   - Generic error boundary
   - "Something went wrong" message
   - "Try again" button (calls reset())
   - Link to homepage
   - Do NOT show technical details to users

3. Create src/app/[locale]/(frontend)/checkout/error.tsx:
   - Specific checkout error handling
   - If order creation failed: show user-friendly message
   - If stock issue: "Some items in your cart are no longer available"
   - Suggest returning to cart to update

4. Global error logging:
   - Create src/lib/logger.ts
   - For MVP: console.error with structured format
   - Later: integrate with Sentry or similar
   - Log: error message, stack, user action that caused it, timestamp
```

---

#### Commit 9.2: Form Validation & Error States

**Instructions for agent:**

```
1. Create src/lib/validations/checkout.ts:
   - Zod schema for checkout form
   - Used on both client and server
   - Validates:
     * firstName: min 2 chars, max 50, no numbers
     * lastName: same
     * email: valid email format
     * phone: Bulgarian format (+359 XX XXX XXXX or 0XX XXX XXXX)
     * shippingMethod: enum of valid options
     * address fields: required when method is *_address
     * office fields: required when method is *_office
     * postalCode: exactly 4 digits
     * acceptedTerms: must be true
   - Custom error messages in BG and EN

2. Create reusable form field components:
   src/components/forms/FormField.tsx
   - Label, input, error message, help text
   - Error state styling (red border, error message below)
   - Accessible: aria-invalid, aria-describedby

3. Toast notifications:
   - Use shadcn Toast component
   - Success toasts: green, auto-dismiss 3s
   - Error toasts: red, persist until dismissed
   - Info toasts: blue, auto-dismiss 5s
```

---

### PHASE 10: Deployment & Launch Prep

**Goal:** Deploy to production, configure DNS, SSL, and monitoring.

---

#### Commit 10.1: Cloudflare Deployment Configuration

**Instructions for agent:**

```
Storage and database adapters are already wired from Phase 0 — on this stack
deployment is not a separate integration step, it is the same bindings pointed
at real resources. This commit is about making that repeatable.

1. Build pipeline (package.json):
   "build"            : "payload build"
   "preview"          : "opennextjs-cloudflare build && opennextjs-cloudflare preview"
   "deploy:database"  : "cross-env NODE_ENV=production PAYLOAD_SECRET=ignore payload migrate"
   "deploy:app"       : "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
   "deploy"           : "pnpm deploy:database && pnpm deploy:app"

   ORDER MATTERS: migrations run BEFORE the new Worker goes live, so the
   schema is never behind the code. Migrations must therefore be
   backwards-compatible with the currently-deployed Worker — additive columns,
   no destructive renames in a single step.

2. Health check: src/app/api/health/route.ts
   Returns { status, timestamp } and a cheap D1 round-trip (SELECT 1).
   Used by uptime monitoring and to confirm the binding after deploy.

3. next.config.ts for the Worker runtime:
   - serverExternalPackages: ['jose', 'pg-cloudflare']
   - images.remotePatterns: the R2 custom domain
   - custom image loader for /cdn-cgi/image (see Phase 8)

4. Verify the bundle before every deploy:
   ls -la .open-next/worker.js   → must be under 10 MB compressed
```

---

#### Commit 10.2: Provisioning runbook (human-executed)

**Instructions for agent:** document these; do NOT attempt them without credentials.

```
a. wrangler login

b. Create resources:
   wrangler d1 create kc-commerce
   wrangler r2 bucket create kc-commerce-media
   → paste the returned database_id into wrangler.jsonc

c. Set secrets (never in the repo):
   wrangler secret put PAYLOAD_SECRET      # openssl rand -hex 32
   wrangler secret put RESEND_API_KEY
   wrangler secret put CRON_SECRET

d. Enable the Workers Paid plan ($5/mo) — REQUIRED, the bundle exceeds
   the 3 MB free-tier limit.

e. First deploy:
   pnpm deploy

f. Visit https://<worker>.workers.dev/admin and create the first admin user.
   Do this IMMEDIATELY after the first deploy — until an admin exists, the
   Payload create-first-user route is open by design.

g. Custom domain:
   - Add the domain to Cloudflare (nameservers or partial CNAME setup)
   - Workers → your worker → Settings → Domains & Routes → add kctrading.bg
   - SSL/TLS mode: Full (strict)
   - Enable "Always Use HTTPS" and HSTS at the zone level
   - Attach a custom domain to the R2 bucket for media (media.kctrading.bg)
   - Turn on Image Transformations for the zone, then set
     NEXT_PUBLIC_CF_IMAGES=true so the next/image loader activates

h. Security posture in the dashboard:
   - WAF: enable the Cloudflare Managed Ruleset
   - Add a rate-limiting rule on /admin/login and the checkout action
     (defence in depth — the app rate-limits too)
   - Bot Fight Mode on
   - Scrape Shield on
```

---

#### Commit 10.3: Staging environment & CI

**Instructions for agent:**

```
1. wrangler.jsonc already declares a "staging" env with its own D1 + R2.
   Deploy it with:  CLOUDFLARE_ENV=staging pnpm deploy
   Staging never shares a database with production.

2. GitHub Actions (.github/workflows/):
   - On pull request: install, lint, typecheck, build. No deploy.
     This is the guardrail that replaces the missing test suite — a PR that
     does not type-check cannot merge.
   - On push to main: build + deploy to production, using repository secret
     CLOUDFLARE_API_TOKEN (scopes: Workers Scripts:Edit, D1:Edit, R2:Edit).
   - The token is a repository secret. It is NOT in the repo and NOT in
     wrangler.jsonc.

3. Rollback: `wrangler rollback` reverts the Worker to the previous version
   in seconds. Note that it does NOT roll back D1 migrations — this is exactly
   why migrations must be additive and backwards-compatible.
```

---

#### Commit 10.4: Pre-Launch Checklist

**Instructions for agent:**

```
Before going live, verify ALL of the following:

FUNCTIONALITY:
☐ Products display correctly in BG and EN
☐ Cart add/remove/update works
☐ Checkout form validates all fields
☐ Order creation works (creates in admin, decrements stock)
☐ Confirmation page shows correctly
☐ Order confirmation email sends
☐ Admin can change order status
☐ Admin can add tracking number
☐ Shipping notification email sends
☐ Search returns relevant results
☐ Category filtering works
☐ Pagination works
☐ Language switching works on all pages

LEGAL COMPLIANCE:
☐ Privacy Policy page exists and is accessible (BG + EN)
☐ Terms & Conditions page exists (BG + EN)
☐ Cookie Policy page exists (BG + EN)
☐ Cookie consent banner shows on first visit
☐ Cookie consent banner does NOT pre-select non-necessary cookies
☐ Right of Withdrawal page exists with electronic withdrawal function
☐ Withdrawal form is accessible and sends email
☐ Checkout shows right of withdrawal info before order placement
☐ Checkout has separate checkbox for terms acceptance (not pre-ticked)
☐ Marketing consent is separate and optional
☐ Company info (UIC, address, contact) visible in footer on all pages
☐ Prices shown in EUR
☐ Product info displayed in Bulgarian language
☐ Previous price shown for any discounted items (30-day rule)
☐ Order button text clearly indicates payment obligation

SECURITY:
☐ All security headers are set
☐ Admin panel requires authentication
☐ Login rate limiting works (5 attempts, 10min lockout)
☐ Order creation rate limiting works
☐ No sensitive data in client-side JavaScript
☐ Environment variables not exposed
☐ HTTPS forced everywhere
☐ File upload restrictions work (type, size)
☐ SQL injection not possible (verify parameterized queries)
☐ XSS not possible (verify output escaping)

PERFORMANCE:
☐ Lighthouse score > 90 on all categories (Performance, A11y, Best Practices, SEO)
☐ Core Web Vitals pass (LCP < 2.5s, FID < 100ms, CLS < 0.1)
☐ Images optimized (WebP/AVIF served)
☐ No layout shifts on page load

SEO:
☐ Sitemap.xml accessible and contains all pages
☐ robots.txt correct
☐ All pages have unique title and meta description
☐ Open Graph tags on all pages
☐ JSON-LD structured data on product pages
☐ hreflang tags for BG/EN
☐ Canonical URLs set
```

---

## Future Enhancements (Post-Launch Roadmap)

These are NOT part of the MVP but should be architected to be easy to add:

1. **Stripe/card payment integration** — Add as an alternative to COD when volume justifies the Stripe fees
2. **Econt/Speedy API integration** — Auto-generate shipping labels, pull office lists, real-time tracking
3. **Customer accounts** — Optional registration for order history, faster checkout
4. **Analytics** — Plausible Analytics (EU-friendly, cookie-free, self-hostable)
5. **Wishlist** — Save products for later (localStorage-based like cart)
6. **Product reviews** — Customer reviews with admin moderation
7. **Discount codes / coupons** — Promo code system at checkout
8. **Inventory alerts** — Email admin when stock falls below threshold
9. **Multi-image zoom** — Full-screen image gallery with zoom on product pages
10. **PWA** — Installable progressive web app for mobile
11. **Invoice generation** — Auto-generate PDF invoices for orders (Bulgarian invoice format)
12. **Admin dashboard** — Charts for revenue, orders, popular products
13. **Email marketing** — Integration with a newsletter service
14. **Product import/export** — CSV/Excel bulk product management

---

## Agentic Development Notes

### For the coding agent:

1. **Follow the branching strategy.** Create a `phase/N-name` branch for each phase. Make all commits within that branch. Merge to `main` only after the full phase builds cleanly. See the "Git Branching & Commit Strategy" section above for exact commands.

2. **Work commit by commit.** Each commit described above is an atomic unit of work. Do not skip ahead or combine commits unless explicitly told to.

3. **Verify before committing.** After implementing each commit's instructions, run `pnpm build` and `pnpm dev` to verify nothing is broken. If the build fails, fix it before committing. Every commit must leave the project in a buildable state. With no test suite, a green build is the only automated signal there is — treat a build failure as a blocking defect, never as noise to work around.

4. **Verify before merging.** After all commits in a phase are done, run `pnpm build` one final time. Only then merge the phase branch into `main`.

5. **Follow the security rules.** Re-read the Security Rules section before implementing any commit that handles user input (especially Phase 5 — checkout).

6. **TypeScript strict mode is non-negotiable.** No `any` types. No `@ts-ignore`. No `as unknown as X` casts. Fix the types properly.

7. **Prefer Payload Local API over REST API.** Since the CMS and frontend are in the same app, use `getPayload({ config })` and call `payload.find()`, `payload.create()`, etc. directly. This is faster (no HTTP round-trip) and type-safe.

8. **Server Components by default.** Only use `'use client'` when the component needs browser APIs (useState, useEffect, event handlers, zustand). Data fetching happens in Server Components.

9. **Server Actions for mutations.** All form submissions (checkout, contact, withdrawal) use Next.js Server Actions, not API routes.

10. **Test as you go.** After implementing each feature, manually test it in the browser. Check both BG and EN locales. Check mobile viewport (375px width).

10a. **Respect the platform constraints.** Before writing anything that touches images, transactions, GraphQL, background work, or large dependencies, re-read the "Platform Constraints" table near the top. Most Payload/Next examples on the internet assume a Node server; several of them simply do not work on Workers.

10b. **Never hardcode a colour.** The palette is not signed off. Semantic tokens only — see Commit 0.6.

11. **Commit messages follow Conventional Commits** (see branching section above for format and examples).

12. **When in doubt, keep it simple.** The goal is a working, secure, legally compliant store — not a technically impressive one. Ship quality over complexity.
