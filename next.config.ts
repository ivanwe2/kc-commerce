import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

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

export default withPayload(nextConfig, { devBundleServerPackages: false })
