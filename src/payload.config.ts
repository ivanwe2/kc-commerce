import path from 'path'
import { fileURLToPath } from 'url'

import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import { buildConfig } from 'payload'
import { getCloudflareContext, type CloudflareContext } from '@opennextjs/cloudflare'
import type { GetPlatformProxyOptions } from 'wrangler'

import { Media } from './collections/Media'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Whether to bind against the REAL D1 and R2 rather than Miniflare's local ones.
 *
 * `wrangler.jsonc` marks D1 as `"remote": true` so that `pnpm deploy:database`
 * migrates the live database. But `next build` also runs with NODE_ENV=production,
 * and remote bindings require a Cloudflare API token — so a plain local
 * `pnpm build` would fail with an API-token error despite needing no network at
 * all. Requiring the token to actually be present keeps local builds working
 * offline while CI and deploys, which do set it, still reach production.
 */
const useRemoteBindings = isProduction && Boolean(process.env.CLOUDFLARE_API_TOKEN)

/**
 * Workers has no pino transport, and Payload's default logger produces output
 * Cloudflare's log stream cannot parse. Emitting JSON through console.* keeps
 * logs structured and filterable in the dashboard and in `wrangler tail`.
 */
const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === 'string') {
      fn(JSON.stringify({ level, msg: objOrMsg }))
    } else {
      fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
    }
  }

/* eslint-disable no-console -- console.* IS the transport on Workers; see above. */
const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
  // Payload does not export its logger interface yet.
} as unknown as NonNullable<Parameters<typeof buildConfig>[0]['logger']>
/* eslint-enable no-console */

/**
 * Adapted from @opennextjs/cloudflare's own context helper. The string dance
 * around `__wrangler` keeps bundlers from following the import into the Worker
 * build — wrangler is a dev dependency and must never be bundled.
 */
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: useRemoteBindings,
      } satisfies GetPlatformProxyOptions),
  )
}

/**
 * Are we executing inside workerd itself?
 *
 * This is the only question that actually matters, and it is worth stating
 * plainly because the obvious proxies for it are all wrong:
 *
 *   - `NODE_ENV === 'production'` is also true during `next build`, which runs
 *     in Node and has no Worker context.
 *   - checking argv for the Payload CLI covers `payload migrate` but not
 *     `next build` or `next dev`.
 *
 * Only inside the deployed Worker can `getCloudflareContext()` resolve. Every
 * other context — CLI, dev server, production build — must go through
 * Wrangler's platform proxy.
 */
const isWorkerRuntime =
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

const cloudflare = isWorkerRuntime
  ? await getCloudflareContext({ async: true })
  : await getCloudflareContextFromWrangler()

/**
 * Bridge Wrangler's proxied env onto process.env.
 *
 * In the deployed Worker, OpenNext maps vars and secrets onto process.env, so
 * `process.env.PAYLOAD_SECRET` works. Under the Wrangler platform proxy it does
 * NOT: `.dev.vars` is loaded onto the proxy's `env` object instead, leaving
 * process.env empty. Payload then fails with "missing secret key" even though
 * the secret is plainly there — which is a genuinely confusing half-hour.
 *
 * Copying scalars across makes process.env the single source of truth for
 * configuration in every context (Worker, `next dev`, and the Payload CLI), so
 * src/lib/env.ts has exactly one place to read from. Bindings are objects, not
 * strings, so the typeof check leaves D1/R2/ASSETS untouched.
 */
if (!isWorkerRuntime) {
  for (const [key, value] of Object.entries(cloudflare.env)) {
    if (typeof value === 'string' && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const siteURL: string | undefined = process.env.NEXT_PUBLIC_SITE_URL
const allowedOrigins: string[] = siteURL ? [siteURL] : []

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: '— KC Trading',
    },
  },

  collections: [Users, Media],

  // D1 is a binding, not a connection string. There is no credential here by design.
  db: sqliteD1Adapter({ binding: cloudflare.env.D1 }),

  editor: lexicalEditor(),

  // Payload's GraphQL layer does not run on Workers, and disabling it removes a
  // large dependency from a bundle that has a hard 10MB ceiling. The Local API
  // covers every use case this project has.
  graphQL: { disable: true },

  logger: isProduction ? cloudflareLogger : undefined,

  secret: process.env.PAYLOAD_SECRET || '',

  // Same binding in local dev (Miniflare) and production. No conditional adapter,
  // no storage token, no S3 credentials.
  //
  // NOTE: this is a `plugins` entry, not the top-level `storage` key used by the
  // upstream with-cloudflare-d1 template. That key does not exist in Payload
  // 3.87.1; the template is pinned to 3.82.1.
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2,
      collections: { media: true },
    }),
  ],

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  // The annotation widens Wrangler's generated literal type back to `string`.
  cors: allowedOrigins,
  csrf: allowedOrigins,
})
