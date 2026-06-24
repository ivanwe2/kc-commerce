# KC Trading

Bulgarian e-commerce store selling miscellaneous items in both retail and bulk quantities, with tiered pricing that rewards larger orders.

Built with Next.js 16, Payload CMS 3.x, PostgreSQL, and Tailwind CSS.

## Quick Start

### 1. Start the database

**IMPORTANT: Docker must be running before starting the app.**

```bash
docker compose up -d
docker compose ps  # verify status is "healthy"
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin) to create your first admin user.

### 4. Run migrations (if schema changed)

```bash
npm run payload migrate:create <name>
npm run payload migrate
```

### When done developing

```bash
docker compose down          # stops containers, keeps data
docker compose down -v       # stops AND wipes database
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| CMS + Backend | Payload CMS 3.x |
| Database | PostgreSQL (Docker local, Neon cloud) |
| ORM | Drizzle (via Payload) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Language | TypeScript (strict) |
| i18n | next-intl + Payload localization |
| Email | Resend |
| File Storage | Local disk (dev) / Vercel Blob (prod) |
| Hosting | Vercel |

## Project Structure

```
src/
├── app/
│   ├── (frontend)/     ← storefront routes
│   └── (payload)/      ← Payload admin routes
├── collections/        ← Payload collection configs
├── globals/            ← Payload global configs
├── lib/                ← shared utilities (env, etc.)
├── payload.config.ts   ← main Payload config
└── middleware.ts       ← security headers + locale detection
```

## Design System

See [docs/kc-commerce-plan.md](docs/kc-commerce-plan.md) for the full design system, data model, and development phases.

## Development Tracker

See [docs/development-tracker.md](docs/development-tracker.md) for phase-by-phase progress.
