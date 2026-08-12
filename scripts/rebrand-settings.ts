import config from '@payload-config'
import { getPayload } from 'payload'

/**
 * One-off: point the Settings global at the new brand.
 *
 * The rebrand migration changes the column DEFAULT, which only affects rows
 * inserted afterwards — an existing Settings row keeps whatever was seeded
 * before it ran. Production has no database yet, so this exists purely to bring
 * an already-seeded development database in line.
 *
 * Run with: pnpm exec payload run scripts/rebrand-settings.ts
 *
 * This prints an "Invariant: static generation store missing in revalidateTag"
 * error and still succeeds. That is the Settings afterChange hook trying to
 * revalidate the Next cache from a CLI process that has no Next request
 * context. The database write has already happened by then; there is simply no
 * cache to invalidate outside a running server.
 */
async function run() {
  const payload = await getPayload({ config })

  await payload.updateGlobal({
    slug: 'settings',
    locale: 'bg',
    data: { siteName: 'Битодом', companyName: 'Битодом ЕООД' },
  })

  await payload.updateGlobal({
    slug: 'settings',
    locale: 'en',
    data: { siteName: 'Bitodom' },
  })

  // eslint-disable-next-line no-console -- CLI script; output is the point.
  console.log('Settings updated: Битодом / Bitodom')
}

/**
 * Top-level await, not `void run()` — see the same note at the end of
 * src/seed.ts. Wrangler's platform proxy resolves through handles that do not
 * keep Node's event loop alive, so a floating promise exits status 0 having
 * written nothing at all.
 */
try {
  await run()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
