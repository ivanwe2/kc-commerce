import { defineCloudflareConfig } from '@opennextjs/cloudflare/config'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

/**
 * OpenNext compiles the Next.js build into a single Cloudflare Worker.
 *
 * The incremental cache is the important line here. Every storefront page
 * declares `revalidate`, but on Cloudflare that only does anything if OpenNext
 * has somewhere to persist rendered output. WITHOUT this, `revalidate` silently
 * degrades to rendering every request from scratch — the pages stay correct, so
 * nothing looks broken, they are simply slow and metered as if they were fully
 * dynamic.
 *
 * Backed by the NEXT_INC_CACHE_R2_BUCKET binding in wrangler.jsonc.
 */
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})
