import { defineCloudflareConfig } from '@opennextjs/cloudflare/config'

/**
 * OpenNext compiles the Next.js build into a single Cloudflare Worker.
 *
 * Phase 8 will enable the R2 incremental cache here so that `revalidate` on
 * product and category pages actually caches. Until then every request renders
 * dynamically, which is correct but not fast — and on a metered platform,
 * "not fast" also means "not cheap".
 */
export default defineCloudflareConfig({})
