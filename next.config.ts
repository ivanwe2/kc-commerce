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

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
