# KC Trading — Agentic Development Master Plan

## Project Overview

**KC Trading** is a Bulgarian e-commerce store selling miscellaneous items in both retail and bulk quantities, with tiered pricing that rewards larger orders. The store targets Bulgarian and English-speaking customers, operates under EU/Bulgarian legal requirements, and uses Cash on Delivery via Econt/Speedy as its sole payment method at launch.

**Development method:** Agentic — Hermes agent + locally hosted Qwen 3.6 27B. Every phase below is structured as atomic commits with explicit instructions the agent can execute sequentially.

---

## Tech Stack Decision & Rationale

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 15 (App Router) | SSR/SSG for SEO, React Server Components, Server Actions, dominant ecosystem |
| **CMS + Backend** | Payload CMS 3.x | Installs inside `/app`, admin panel included, built-in localization, TypeScript-native, MIT license, most AI-agent-friendly CMS in 2026 |
| **Database** | PostgreSQL via Neon | Free tier (0.5 GB, 100 CU-hrs/project), scale-to-zero, Payload 3.x uses Drizzle ORM on Postgres |
| **ORM** | Drizzle (via Payload) | Bundled with Payload 3.x, type-safe, lightweight |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Utility-first, tree-shakeable, accessible component primitives |
| **Language** | TypeScript 5.x (strict mode) | End-to-end type safety from DB to UI |
| **i18n** | Payload built-in localization + next-intl | Payload localizes content fields natively; next-intl handles UI strings/routing |
| **Email** | Resend | Free tier: 100 emails/day, 3,000/month — enough for launch |
| **File Storage** | Vercel Blob | Serverless-compatible media storage for product images, included in Vercel Pro |
| **Hosting** | Vercel (Hobby → Pro) | One-click Payload deploy, global edge network, preview deployments per PR |
| **DNS/CDN** | Cloudflare (free) | DNS, DDoS protection, extra caching layer (optional — Vercel has its own CDN) |

### Hosting Decision

> **Vercel** is the recommended host. Payload CMS 3.x was redesigned to run natively inside Next.js (no Express) and officially supports one-click Vercel deployment. Payload provides official Vercel templates with Neon + Vercel Blob integration.
>
> - **Development phase:** Use Vercel Hobby (free). This is fine for non-commercial dev/staging.
> - **Before going live:** Upgrade to Vercel Pro ($20/month). Hobby plan prohibits commercial use — an e-commerce store requires Pro.
> - **Media uploads:** Local disk (`./media/`) for development — no cloud storage needed locally. On Vercel, use the official `@payloadcms/storage-vercel-blob` adapter (1GB free on Hobby, usage-based on Pro). The adapter is conditionally loaded: it only activates when the `BLOB_READ_WRITE_TOKEN` env var is present, so the same codebase works in both environments with zero config changes.
> - **Database:** Neon Postgres (free tier for dev: 0.5GB, 100 CU-hrs. Launch tier $5/mo for production).
> - **If you ever outgrow Vercel:** The app is standard Next.js — you can move to Railway, Hetzner VPS, or any Node.js host without code changes.

### Monthly Cost Estimate (Launch)

| Service | Cost |
|---------|------|
| Vercel Pro | $20/month |
| Neon Postgres (free tier → Launch $5) | $0-5 |
| Vercel Blob (1GB included in Pro) | $0 |
| Cloudflare DNS/CDN | Free |
| Resend email (free tier) | Free |
| Domain (.bg or .com) | ~€10-15/year |
| **Total** | **~$20-25/month** |

---

## Architecture Overview

```
┌─── Vercel (Edge Network) ────────────────────┐
│                                               │
│              Next.js App                      │
│  ┌────────────┐  ┌──────────────────────────┐ │
│  │ Storefront │  │   Payload CMS Admin      │ │
│  │  (public)  │  │   (/admin route)         │ │
│  │            │  │                          │ │
│  │ - Home     │  │ - Products CRUD          │ │
│  │ - Products │  │ - Orders management      │ │
│  │ - Cart     │  │ - Categories             │ │
│  │ - Checkout │  │ - Pages (CMS)            │ │
│  │ - Pages    │  │ - Media library          │ │
│  └─────┬──────┘  └────────────┬─────────────┘ │
│        │    Payload Local API  │              │
│        └──────────┬───────────┘              │
│                   │                           │
│          ┌────────▼────────┐                 │
│          │  Drizzle ORM    │                 │
│          └────────┬────────┘                 │
└───────────────────┼──────────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐
│ Neon     │ │ Vercel     │ │ Resend    │
│ Postgres │ │ Blob       │ │ (email)   │
│ (DB)     │ │ (media)    │ │           │
└──────────┘ └────────────┘ └───────────┘
```

---

## Local Development Environment (Docker)

> **The agent MUST set up Docker for local development in Phase 0.** This ensures a consistent, reproducible environment and avoids depending on Neon for local work.

### Docker Compose Setup

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: kctrading
      POSTGRES_PASSWORD: kctrading_dev
      POSTGRES_DB: kctrading
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kctrading"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### How It Works

```
LOCAL DEVELOPMENT (Docker Compose):
┌──────────────────────────────────────────┐
│  npm run dev  (Next.js + Payload)        │
│  ↕ connects to ↕                         │
│  localhost:5432 (Postgres in Docker)     │
│  Media uploads → ./media/ (local disk)   │
└──────────────────────────────────────────┘

DEPLOYED ON VERCEL:
┌──────────────────────────────────────────┐
│  Vercel Serverless Functions             │
│  ↕ connects to ↕                         │
│  Neon Postgres (cloud)                   │
│  Media uploads → Vercel Blob (cloud)     │
└──────────────────────────────────────────┘
```

### Environment Variable Strategy

```
# .env.local (git-ignored, local dev)
DATABASE_URL=postgresql://kctrading:kctrading_dev@localhost:5432/kctrading
PAYLOAD_SECRET=dev-secret-at-least-32-characters-long-change-in-prod
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Vercel Dashboard (production env vars)
DATABASE_URL=postgresql://...@neon.tech/kctrading?sslmode=require
PAYLOAD_SECRET=<production-secret-from-openssl-rand>
BLOB_READ_WRITE_TOKEN=<vercel-generated>
RESEND_API_KEY=re_xxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=https://kctrading.bg
```

### Media Storage Rules

| Environment | Storage | How |
|-------------|---------|-----|
| **Local dev** | Local disk (`./media/`) | Payload default — no adapter needed |
| **Vercel Hobby** (staging) | Vercel Blob (1GB free) | `@payloadcms/storage-vercel-blob` adapter |
| **Vercel Pro** (production) | Vercel Blob (usage-based) | Same adapter, larger limits |

The Vercel Blob adapter is **conditionally loaded** — only activate it when the `BLOB_READ_WRITE_TOKEN` env var is present. This means the same codebase works locally (disk) and on Vercel (blob) without any config changes:

```typescript
// In payload.config.ts
const plugins = []
if (process.env.BLOB_READ_WRITE_TOKEN) {
  plugins.push(
    vercelBlobStorage({
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
  )
}
```

### Agent Workflow for Local Dev

```
1. Start the database:
   docker compose up -d

2. Verify Postgres is running:
   docker compose ps  (status should be "healthy")

3. Start the app:
   npm run dev

4. First run only: Payload auto-creates tables via Drizzle push.
   Visit http://localhost:3000/admin to create the first admin user.

5. When done developing:
   docker compose down          (stops containers, keeps data)
   docker compose down -v       (stops AND wipes database)
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
- Database credentials in environment variables only — NEVER in code
- Neon enforces SSL connections by default — verify this is not disabled

### Environment Variables
- `.env` file in `.gitignore` — NEVER committed
- Use `.env.example` with placeholder values for documentation
- Separate `.env.local` (dev) from production env vars (set in hosting dashboard)
- Required vars: `DATABASE_URL`, `PAYLOAD_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`

### Dependency Security
- Pin exact versions in `package.json` (no `^` or `~`)
- Run `npm audit` before every deployment
- Use only well-maintained packages (check last commit date, downloads)
- Minimize dependencies — prefer built-in Node.js APIs and Payload features

### File Upload Security
- Restrict upload MIME types to images only: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- Set max file size: 5MB per image
- Vercel Blob stores uploads externally with signed URLs by default — no path traversal risk
- Generate unique filenames (UUID) to prevent enumeration attacks
- In local dev, uploads go to `./media` — ensure this directory is in `.gitignore`

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
   - Run `npm run build` — fix any errors before proceeding
   - Run `npm run dev` and manually verify the feature works
   - Stage and commit with a conventional commit message:
     git add -A
     git commit -m "feat(phase-N): description of what was built"
   - Use the commit numbering from the plan, e.g.:
     "feat(phase-0): initialize Next.js + Payload CMS project"        ← Commit 0.1
     "feat(phase-0): configure environment variables with zod"         ← Commit 0.2
     "feat(phase-1): add Products collection with pricing tiers"       ← Commit 1.1
     "fix(phase-1): correct pricing tier overlap validation"           ← bugfix mid-phase

3. After ALL commits in the phase are done:
   - Run full build one more time: `npm run build`
   - Push the branch:
     git push origin phase/N-short-name
   - Merge into main (simulate PR merge):
     git checkout main
     git merge phase/N-short-name --no-ff -m "merge: Phase N - Short Description"
     git push origin main
   - DO NOT delete the phase branch (keep for reference)

4. Move to the next phase (back to step 1)
```

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

### PHASE 0: Project Scaffolding & Configuration

**Goal:** Initialize the project with all tooling, Payload CMS, Docker-based local Postgres, and development environment. After this phase, `docker compose up -d && npm run dev` starts the full stack with Payload admin accessible at `/admin`.

---

#### Commit 0.1: Initialize Next.js + Payload CMS

**Instructions for agent:**

```
1. Create a new Payload CMS project using the official CLI:
   npx create-payload-app@latest kc-trading

2. When prompted, select:
   - Template: "website" (this gives the best starting point)
   - Database: PostgreSQL (with Drizzle adapter)
   - Package manager: npm (or pnpm if preferred)

3. The CLI creates a Next.js 15 project with Payload installed inside /app
   Verify the structure:
   kc-trading/
   ├── src/
   │   ├── app/
   │   │   ├── (frontend)/     ← storefront routes
   │   │   └── (payload)/      ← Payload admin routes
   │   ├── collections/        ← Payload collection configs
   │   ├── globals/            ← Payload global configs
   │   └── payload.config.ts   ← main Payload config
   ├── .env                    ← database URL, secrets
   ├── tsconfig.json
   ├── tailwind.config.ts
   └── package.json

4. If the template structure differs, restructure to match the above.

5. Set TypeScript to strict mode in tsconfig.json:
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "forceConsistentCasingInFileNames": true
     }
   }
```

**Verification:** `npm run dev` starts without errors. Visit `http://localhost:3000/admin` — Payload setup screen appears.

---

#### Commit 0.2: Docker Compose for Local Development

**Instructions for agent:**

```
1. Create docker-compose.yml in the project root:

   services:
     db:
       image: postgres:16-alpine
       restart: unless-stopped
       ports:
         - "5432:5432"
       environment:
         POSTGRES_USER: kctrading
         POSTGRES_PASSWORD: kctrading_dev
         POSTGRES_DB: kctrading
       volumes:
         - pgdata:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U kctrading"]
         interval: 5s
         timeout: 3s
         retries: 5

   volumes:
     pgdata:

2. Add to .gitignore (if not already present):
   pgdata/

3. Start the database:
   docker compose up -d

4. Wait for healthy status:
   docker compose ps
   (status should show "healthy")

5. Update .env to use the local Postgres:
   DATABASE_URL=postgresql://kctrading:kctrading_dev@localhost:5432/kctrading

6. Test: npm run dev should start and connect to local Postgres.
   Payload will auto-create tables on first run.

NOTE: The agent should always start Docker before running npm run dev.
Add a reminder in the project README.
```

**Verification:** `docker compose ps` shows healthy db. `npm run dev` connects to local Postgres without errors.

---

#### Commit 0.3: Environment Configuration

**Instructions for agent:**

```
1. Create .env.example with ALL required variables (placeholder values):
   # Local development (Docker Postgres)
   DATABASE_URL=postgresql://kctrading:kctrading_dev@localhost:5432/kctrading
   PAYLOAD_SECRET=your-secret-key-min-32-chars-change-in-production
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   RESEND_API_KEY=re_xxxxxxxxxxxx
   NEXT_PUBLIC_DEFAULT_LOCALE=bg
   NEXT_PUBLIC_SUPPORTED_LOCALES=bg,en
   # Only needed on Vercel (leave blank for local dev)
   BLOB_READ_WRITE_TOKEN=

2. Create .env.local with actual development values:
   - DATABASE_URL: postgresql://kctrading:kctrading_dev@localhost:5432/kctrading
     (points to Docker Postgres, NOT Neon — Neon is for deployed environments only)
   - PAYLOAD_SECRET: Generate with `openssl rand -hex 32`
   - NEXT_PUBLIC_SITE_URL: http://localhost:3000 for dev
   - BLOB_READ_WRITE_TOKEN: leave empty (media uses local disk in dev)

3. Verify .env and .env.local are in .gitignore

4. Create src/lib/env.ts — a typed environment variable accessor:
   Use zod to validate all env vars at startup. If any are missing, throw
   a clear error message stating which variable is missing.

   import { z } from 'zod'

   const envSchema = z.object({
     DATABASE_URL: z.string().min(1),
     PAYLOAD_SECRET: z.string().min(32),
     NEXT_PUBLIC_SITE_URL: z.string().url(),
     RESEND_API_KEY: z.string().optional(),
     BLOB_READ_WRITE_TOKEN: z.string().optional(),
     NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['bg', 'en']).default('bg'),
   })

   export const env = envSchema.parse(process.env)

5. NEVER import process.env directly anywhere else — always use this module.
```

**Verification:** App starts. Missing env vars produce clear error messages.

---

#### Commit 0.4: Security Headers Middleware

**Instructions for agent:**

```
1. Create src/middleware.ts (Next.js middleware):

   Set the following headers on ALL responses:
   - Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 0  (modern browsers: CSP replaces this)
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: camera=(), microphone=(), geolocation=()
   - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   - X-DNS-Prefetch-Control: off

   IMPORTANT: The middleware must NOT block Payload admin routes.
   Use matcher config to apply to public routes only, or conditionally
   relax CSP for /admin/* paths (Payload admin needs inline scripts).

2. Middleware should also handle locale detection (implemented in Phase 2).
   For now, just set headers.
```

**Verification:** Check response headers in browser DevTools on any page.

---

#### Commit 0.5: Install Core Dependencies

**Instructions for agent:**

```
Run:
   npm install zod @tanstack/react-query zustand next-intl resend
   npm install -D @types/node

Packages and their purposes:
   - zod: Schema validation for forms, env vars, API inputs
   - @tanstack/react-query: NOT for SSR data (Payload Local API handles that) —
     only for client-side mutations (add to cart, place order)
   - zustand: Lightweight client state for shopping cart (persisted to localStorage)
   - next-intl: UI string translations and locale routing
   - resend: Transactional email sending

Do NOT install:
   - axios (use native fetch)
   - lodash (use native JS methods)
   - moment/dayjs (use native Intl.DateTimeFormat)
   - any CSS framework besides Tailwind (already included)
   - any ORM (Payload bundles Drizzle)
   - any auth library (Payload has built-in auth)
```

**Verification:** `npm ls --depth=0` shows clean dependency tree, no peer dependency warnings.

---

#### Commit 0.6: Git Configuration

**Instructions for agent:**

```
1. Initialize git: git init

2. Create/update .gitignore:
   node_modules/
   .next/
   .env
   .env.local
   .env.production
   *.log
   dist/
   media/
   .DS_Store
   coverage/

3. Create .nvmrc:
   22

4. Create .prettierrc:
   {
     "semi": false,
     "singleQuote": true,
     "trailingComma": "all",
     "tabWidth": 2,
     "printWidth": 100
   }

5. Create .eslintrc.json extending Next.js and TypeScript recommended rules.
   Add rule: no-console: "warn" (prevent debug logs in production)

6. Create the initial commit on main:
   git add -A
   git commit -m "chore(phase-0): initialize project with Payload CMS, Next.js 15, and core tooling"

7. From this point forward, follow the branching strategy defined in the
   "Git Branching & Commit Strategy" section. Since we're still in Phase 0,
   continue committing to the current branch until Phase 0 is complete,
   then merge to main and start phase/1-data-model.

   NOTE: For Phase 0 specifically, it's acceptable to work directly on main
   since this IS the initial scaffolding. Starting from Phase 1 onward,
   always create a phase branch first.
```

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
  Use a database sequence or atomic counter for the sequence number.
  IMPORTANT: This must be concurrency-safe. Use a Payload global or a
  separate "counters" table with an atomic increment.

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
- Configure imageSizes for responsive thumbnails:
  - thumbnail: { width: 300, height: 300, crop: 'center' }
  - card: { width: 600, height: 600, crop: 'center' }
  - hero: { width: 1200, height: 800, crop: 'center' }
- Set unique filename generation using a beforeChange hook:
  Generate a UUID-based filename to prevent path traversal attacks.
  Preserve the original file extension.
- Set upload directory: './media' for local dev. In production, the Vercel Blob
  storage adapter (configured in Phase 10) handles uploads automatically —
  no code changes needed between dev and prod.
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
     db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } }),
     // ... rest of config
   })

2. Run migrations:
   npx payload migrate:create
   npx payload migrate

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
1. Configure Tailwind CSS theme in tailwind.config.ts:
   - Light theme ONLY (no dark mode toggle)
   - Color palette — clean and professional:
     primary: A blue or teal — something trustworthy for commerce
     (e.g., primary-50 through primary-900 scale)
     secondary: Neutral warm gray
     accent: For CTAs and highlights
     background: white (#FFFFFF)
     surface: Light gray (#F8F9FA or similar)
     text: Near-black (#1A1A2E or similar)
     border: Light gray (#E5E7EB)
     success: Green (for "in stock", confirmations)
     warning: Amber (for "low stock")
     error: Red (for errors, "out of stock")
   - Font: Use a system font stack for zero-cost and fast loading:
     font-sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
     Install @fontsource/inter or use next/font/google for Inter
   - Spacing and border-radius: consistent across components

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

3. For MVP, basic text search is fine. PostgreSQL's built-in
   full-text search (via Drizzle) can be added later for better results.
   Do NOT add Algolia or Elasticsearch at this stage — overkill.
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
  //    Use a transaction to prevent race conditions:
  //    - For each item, UPDATE products SET stock = stock - quantity WHERE stock >= quantity
  //    - If any UPDATE affects 0 rows, the stock was insufficient → rollback

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
- The stock decrement MUST be atomic (SQL transaction level) to prevent overselling.
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

npm install @react-email/components

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
1. Image optimization:
   - Use next/image everywhere with appropriate sizes prop
   - Set formats: ['webp', 'avif'] in next.config.ts images config
   - Lazy load images below the fold (default next/image behavior)
   - Priority load above-the-fold hero and first product images

2. Font optimization:
   - Use next/font for Inter (automatic subsetting and self-hosting)
   - Display: 'swap' for no FOIT

3. Bundle optimization:
   - Verify tree-shaking works (check bundle analyzer)
   - Dynamic import for heavy components (e.g., cart drawer, modals)
   - Use React Server Components by default — client components only when needed

4. Caching strategy:
   - Product pages: ISR with revalidation (revalidate: 3600 — 1 hour)
   - Category pages: ISR (revalidate: 3600)
   - Homepage: ISR (revalidate: 1800 — 30 minutes)
   - Static pages: SSG (no revalidation unless CMS webhook triggers it)
   - On-demand revalidation: Set up Payload afterChange hooks to call
     revalidatePath() or revalidateTag() when content changes in admin

5. Database query optimization:
   - Select only needed fields in Payload queries (use 'select' option)
   - Use depth: 0 for list views, depth: 1-2 only when relationships are needed
   - Add database indexes on frequently queried fields:
     products.slug, products.isActive, products.category
     orders.status, orders.orderNumber
     categories.slug
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

#### Commit 10.1: Vercel Deployment Configuration

**Instructions for agent:**

```
1. Install Vercel Blob storage adapter for Payload:
   npm install @payloadcms/storage-vercel-blob

2. Configure Payload to use Vercel Blob for media uploads:
   In payload.config.ts, add the storage adapter:

   import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'

   plugins: [
     vercelBlobStorage({
       collections: { media: true },
       token: process.env.BLOB_READ_WRITE_TOKEN,
     }),
   ]

   Add BLOB_READ_WRITE_TOKEN to .env.example

3. Create vercel.json (minimal — Next.js auto-detection handles most):
   {
     "framework": "nextjs",
     "buildCommand": "npx payload migrate && npm run build",
     "env": {
       "PAYLOAD_CONFIG_PATH": "src/payload.config.ts"
     }
   }

   The buildCommand runs Payload migrations before building Next.js.

4. Configure next.config.ts for production:
   - Set images.remotePatterns to allow Vercel Blob URLs
   - Set serverExternalPackages if any native modules need it
   - Enable experimental.reactCompiler if available and stable

5. Create a health check API route:
   src/app/api/health/route.ts
   - Returns 200 OK with { status: 'ok', timestamp: new Date() }
   - Optionally checks DB connectivity

6. Update .env.example with all production-required variables:
   DATABASE_URL=              # Neon Postgres connection string
   PAYLOAD_SECRET=            # min 32 chars, unique per environment
   BLOB_READ_WRITE_TOKEN=     # Vercel Blob storage token
   RESEND_API_KEY=            # Resend email API key
   NEXT_PUBLIC_SITE_URL=      # https://kctrading.bg or similar
   INITIAL_ADMIN_EMAIL=       # First admin user email
   INITIAL_ADMIN_PASSWORD=    # First admin user password (change after first login)

7. Deployment steps (manual — agent documents these for the human):
   a. Push repo to GitHub
   b. Go to vercel.com → New Project → Import from GitHub
   c. Vercel auto-detects Next.js framework
   d. Add all environment variables from .env.example
   e. For DATABASE_URL: Create a Neon project, copy the connection string
   f. For BLOB_READ_WRITE_TOKEN: Vercel creates this when you add Blob storage
      (Vercel Dashboard → Storage → Create → Blob)
   g. Deploy — first deploy runs migrations and creates DB tables
   h. Visit /admin → create the first admin user

8. Configure Vercel project settings:
   - Root directory: ./ (default)
   - Build command: auto-detected
   - Output directory: auto-detected
   - Node.js version: 22.x
   - Environment variables: set per environment (Production, Preview, Development)
```

---

#### Commit 10.2: Preview Deployments & Branch Protection

**Instructions for agent:**

```
1. Vercel automatically creates preview deployments for every push to
   non-main branches. This means every phase branch gets its own preview URL.
   No configuration needed — this is built into Vercel.

2. Configure preview environment variables:
   - Use a SEPARATE Neon database branch for preview deployments
     (Neon supports database branching — create a 'preview' branch)
   - Set DATABASE_URL for Preview environment to the preview branch URL
   - This prevents preview deploys from corrupting production data

3. Set up domain:
   - Add custom domain in Vercel Dashboard → Domains
   - Point DNS to Vercel (either Vercel DNS or external like Cloudflare)
   - Vercel auto-provisions SSL certificate
   - Configure www redirect (www.kctrading.bg → kctrading.bg or vice versa)

4. Security settings in Vercel Dashboard:
   - Enable DDoS protection (included in all plans)
   - Enable Web Application Firewall (basic included in Pro)
   - Set Function Max Duration: 30s (sufficient for all operations)
   - Enable Speed Insights (included in Pro)
```

---

#### Commit 10.3: Pre-Launch Checklist

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

### For the Hermes Agent + Qwen 3.6 27B:

1. **Follow the branching strategy.** Create a `phase/N-name` branch for each phase. Make all commits within that branch. Merge to `main` only after the full phase builds cleanly. See the "Git Branching & Commit Strategy" section above for exact commands.

2. **Work commit by commit.** Each commit described above is an atomic unit of work. Do not skip ahead or combine commits unless explicitly told to.

3. **Verify before committing.** After implementing each commit's instructions, run `npm run build` and `npm run dev` to verify nothing is broken. If the build fails, fix it before committing. Every commit must leave the project in a buildable state.

4. **Verify before merging.** After all commits in a phase are done, run `npm run build` one final time. Only then merge the phase branch into `main`.

5. **Follow the security rules.** Re-read the Security Rules section before implementing any commit that handles user input (especially Phase 5 — checkout).

6. **TypeScript strict mode is non-negotiable.** No `any` types. No `@ts-ignore`. No `as unknown as X` casts. Fix the types properly.

7. **Prefer Payload Local API over REST API.** Since the CMS and frontend are in the same app, use `getPayload({ config })` and call `payload.find()`, `payload.create()`, etc. directly. This is faster (no HTTP round-trip) and type-safe.

8. **Server Components by default.** Only use `'use client'` when the component needs browser APIs (useState, useEffect, event handlers, zustand). Data fetching happens in Server Components.

9. **Server Actions for mutations.** All form submissions (checkout, contact, withdrawal) use Next.js Server Actions, not API routes.

10. **Test as you go.** After implementing each feature, manually test it in the browser. Check both BG and EN locales. Check mobile viewport (375px width).

11. **Commit messages follow Conventional Commits** (see branching section above for format and examples).

12. **When in doubt, keep it simple.** The goal is a working, secure, legally compliant store — not a technically impressive one. Ship quality over complexity.
