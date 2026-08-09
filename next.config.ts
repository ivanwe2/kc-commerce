import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { withPayload } from '@payloadcms/next/withPayload'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

/**
 * Makes `getCloudflareContext()` work under `next dev`.
 *
 * Without this, D1 and R2 bindings are simply absent outside the deployed
 * Worker — which means checkout, stock reservation, order numbering and the
 * health check all fail locally while looking like application bugs.
 *
 * `remoteBindings` is gated on the API token for the same reason as in
 * payload.config.ts: wrangler.jsonc marks D1 `remote: true` so production
 * migrations hit the real database, but a developer with no Cloudflare
 * credentials must still get the local Miniflare bindings rather than an
 * authentication error.
 */
initOpenNextCloudflareForDev({
  remoteBindings: Boolean(process.env.CLOUDFLARE_API_TOKEN),
})

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * Origins Next's dev server accepts cross-origin requests from.
 *
 * Only consulted by `next dev`. Needed when browsing by LAN or VPN address
 * rather than localhost: without it Next blocks its own dev chunks and rejects
 * Server Actions, so pages render but checkout silently fails.
 *
 * Read from .dev.vars directly rather than process.env, and that detail is the
 * whole reason this works. `.dev.vars` is loaded by Wrangler's platform proxy
 * from inside payload.config.ts, which runs during a request — long after the
 * Next CLI has already evaluated this file. Anything set there is invisible
 * here, so the list came out empty and the block persisted while looking
 * configured.
 */
function readDevVars(): Record<string, string> {
  if (process.env.NODE_ENV === 'production') return {}

  try {
    const contents = readFileSync(resolve(process.cwd(), '.dev.vars'), 'utf8')
    return Object.fromEntries(
      contents
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const separator = line.indexOf('=')
          return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
        })
        .filter(([key]) => key),
    )
  } catch {
    // No .dev.vars is entirely normal — in CI, and in production.
    return {}
  }
}

/**
 * Reads `vars` out of wrangler.jsonc.
 *
 * JSONC, so comments and trailing commas have to go before JSON.parse. Worth
 * the small parser: these are the values production actually deploys with, and
 * they are otherwise invisible to the build.
 */
function readWranglerVars(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8')
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'])\/\/.*$/gm, '$1')
      .replace(/,(\s*[}\]])/g, '$1')

    const parsed = JSON.parse(stripped) as { vars?: Record<string, string> }
    return parsed.vars ?? {}
  } catch {
    return {}
  }
}

/**
 * NEXT_PUBLIC_* values must exist in process.env when Next COMPILES, because
 * that is when they are inlined into the client bundle. Neither source here
 * satisfies that on its own:
 *
 *   - wrangler.jsonc `vars` are injected by the Worker runtime, long after the
 *     build;
 *   - .dev.vars is read by Wrangler's platform proxy from inside
 *     payload.config.ts, which runs per request.
 *
 * The result is a client bundle carrying the literal string
 * "process.env.NEXT_PUBLIC_CF_IMAGES" that evaluates to undefined forever —
 * so enabling Cloudflare Images in wrangler.jsonc would silently fail to turn
 * the image loader on. Reading both here and declaring them through `env`
 * makes the inlining actually happen.
 *
 * .dev.vars wins locally, which is what a developer overriding a value expects.
 */
const devVars = readDevVars()
const wranglerVars = readWranglerVars()

const publicEnv = Object.fromEntries(
  Object.entries({ ...wranglerVars, ...devVars })
    .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
    // A real environment variable still outranks both, so CI and deploy
    // pipelines can override without editing files.
    .map(([key, value]) => [key, process.env[key] ?? value]),
)

// Next wants bare hostnames here, not full origins.
const additionalOrigins = (process.env.ADDITIONAL_ORIGINS ?? devVars.ADDITIONAL_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/^https?:\/\//, '').replace(/:\d+$/, ''))
  .filter(Boolean)

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Inlined into the client bundle at build time. See publicEnv above.
  env: publicEnv,

  allowedDevOrigins: additionalOrigins,

  /**
   * Collect page data in a single worker.
   *
   * Next defaults to one build worker per CPU. Each one spins up its own
   * Wrangler platform proxy, so six workerd processes end up contending for the
   * same local Miniflare SQLite file — which crashes with an opaque
   * "D1_ERROR: Failed to parse body as JSON, got: Error: internal error"
   * during generateStaticParams.
   *
   * Serialising avoids the contention. The cost is small because the expensive
   * part of this build is bundling, not page collection, and production
   * deploys hit remote D1 where this contention does not arise.
   */
  experimental: {
    cpus: 1,
  },

  images: {
    // Next's built-in optimizer depends on sharp, which cannot run on Workers.
    // Resizing is delegated to Cloudflare Image Transformations instead —
    // see src/lib/imageLoader.ts.
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.ts',
    localPatterns: [{ pathname: '/api/media/file/**' }],
    remotePatterns: [
      // R2 custom domain for media, once attached.
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },

  // Packages containing workerd-specific code paths.
  // https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: ['jose', 'pg-cloudflare'],

  /**
   * Keep build-time-only dependencies out of the Worker bundle.
   *
   * Payload's admin UI ships SCSS, so Next traces the `sass` compiler into the
   * server output — 4.8 MB of Dart-compiled JavaScript that exists purely to
   * turn .scss into .css during the build and is never invoked at runtime.
   * Against a hard 10 MB Worker ceiling that is not an acceptable passenger.
   *
   * The dev-tools and OG-image bundles are similarly unreachable in production.
   * Revisit the @vercel/og exclusion if dynamic Open Graph images are ever added.
   */
  outputFileTracingExcludes: {
    '**/*': [
      'node_modules/.pnpm/sass@*/**',
      'node_modules/sass/**',
      'node_modules/**/next-devtools/**',
      'node_modules/**/@vercel/og/**',
    ],
  },

  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
