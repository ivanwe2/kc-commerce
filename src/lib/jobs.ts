import config from '@payload-config'
import { getPayload } from 'payload'

import { sendBackInStockNotice, sendLowStockDigest } from './email-jobs'

/**
 * Scheduled work.
 *
 * Each job is a plain async function returning a short summary, so the cron
 * handler can log what actually happened rather than "ran". They are written to
 * be safe to run twice: Cloudflare delivers cron events at least once, and a
 * job that double-sends on a retry is worse than one that occasionally does
 * nothing.
 *
 * Every job is also bounded. A Worker has a CPU budget, so nothing here scans
 * an unbounded table — each takes a limit and leaves the remainder for the next
 * run, which is slower to drain but cannot time out halfway and lose its work.
 */

export type JobResult = { job: string; summary: string }

/**
 * Notify people waiting on a product that has come back into stock.
 *
 * Idempotent through `notifiedAt`: a row is stamped once the mail is sent, and
 * only unstamped rows are ever selected. Deleting them instead would lose the
 * record of who was told what, which is the first thing anyone asks about after
 * an unexpected email.
 */
export async function runBackInStockNotifications(limit = 50): Promise<JobResult> {
  const payload = await getPayload({ config })

  const waiting = await payload.find({
    collection: 'stock-alerts',
    where: { notifiedAt: { exists: false } },
    limit,
    depth: 1,
    overrideAccess: true,
  })

  let sent = 0

  for (const alert of waiting.docs) {
    const product = typeof alert.product === 'object' ? alert.product : null
    if (!product || (product.stock ?? 0) <= 0) continue

    try {
      await sendBackInStockNotice({
        email: alert.email,
        locale: alert.locale ?? 'bg',
        productTitle: String(product.title),
        productSlug: product.slug ?? '',
      })

      // Stamped immediately after sending: if the loop dies on the next row,
      // this person is not emailed again on the retry.
      await payload.update({
        collection: 'stock-alerts',
        id: alert.id,
        overrideAccess: true,
        data: { notifiedAt: new Date().toISOString() },
      })

      sent++
    } catch (error) {
      payload.logger.error({ err: error, alertId: alert.id }, 'Back-in-stock notice failed')
    }
  }

  return { job: 'back-in-stock', summary: `${sent} sent of ${waiting.docs.length} waiting` }
}

/**
 * One daily digest of everything running low.
 *
 * The per-product alert from Phase 16 fires on the threshold crossing and is
 * good for catching a sudden drop. This is the complement: a single message
 * listing everything below threshold, so a product that quietly sat at 3 units
 * for a week is still visible. One email a day rather than one per product is
 * the difference between a digest that gets read and a filter rule.
 */
export async function runLowStockDigest(): Promise<JobResult> {
  const payload = await getPayload({ config })

  const low = await payload.find({
    collection: 'products',
    where: { and: [{ isActive: { equals: true } }, { stock: { less_than_equal: 10 } }] },
    limit: 100,
    depth: 0,
    sort: 'stock',
    overrideAccess: true,
  })

  if (low.docs.length === 0) return { job: 'low-stock-digest', summary: 'nothing low' }

  await sendLowStockDigest(
    low.docs.map((product) => ({
      title: String(product.title),
      sku: product.sku,
      stock: product.stock ?? 0,
    })),
  )

  return { job: 'low-stock-digest', summary: `${low.docs.length} products below threshold` }
}

/**
 * Delete expired rate-limit counters.
 *
 * The limiter encodes its window in the counter key, so expiry is implicit and
 * old rows simply become inert. Inert is not free on a metered database, and
 * this table grows with every checkout, so it needs sweeping. D1 has no TTL,
 * which is why this is a job rather than a column.
 */
export async function runCounterCleanup(): Promise<JobResult> {
  const payload = await getPayload({ config })

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const stale = await payload.find({
    collection: 'counters',
    where: {
      and: [{ key: { like: 'ratelimit:' } }, { updatedAt: { less_than: cutoff } }],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  let deleted = 0
  for (const row of stale.docs) {
    try {
      await payload.delete({ collection: 'counters', id: row.id, overrideAccess: true })
      deleted++
    } catch {
      // A row that will not delete is not worth failing the sweep over; the
      // next run will try again.
    }
  }

  return { job: 'counter-cleanup', summary: `${deleted} stale rate-limit counters removed` }
}

/**
 * Prune price history beyond what the law requires us to keep.
 *
 * The 30-day reference price is the reason this table exists, but keeping only
 * 30 days would leave nothing to answer a dispute with. Two years is well past
 * any consumer-protection window while still bounding the table, and the most
 * recent row per product is always kept so a product that has not changed price
 * in years still has a reference.
 */
export async function runPriceHistoryPrune(): Promise<JobResult> {
  const payload = await getPayload({ config })

  const cutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()

  const old = await payload.find({
    collection: 'price-history',
    where: { recordedAt: { less_than: cutoff } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  let deleted = 0
  for (const row of old.docs) {
    const productId = typeof row.product === 'object' ? row.product?.id : row.product

    // Never remove a product's only remaining record.
    const remaining = await payload.count({
      collection: 'price-history',
      where: { product: { equals: productId } },
      overrideAccess: true,
    })
    if (remaining.totalDocs <= 1) continue

    try {
      await payload.delete({ collection: 'price-history', id: row.id, overrideAccess: true })
      deleted++
    } catch {
      // Same reasoning as above.
    }
  }

  return { job: 'price-history-prune', summary: `${deleted} rows older than 2 years removed` }
}

async function runWeeklyMaintenance(): Promise<JobResult> {
  const counters = await runCounterCleanup()
  const prices = await runPriceHistoryPrune()
  return { job: 'weekly-maintenance', summary: `${counters.summary}; ${prices.summary}` }
}

/** Jobs by schedule, so the cron handler stays declarative. */
export const SCHEDULED_JOBS: Record<string, () => Promise<JobResult>> = {
  // Every 15 minutes — restock notices should feel prompt.
  '*/15 * * * *': runBackInStockNotifications,
  // 07:00 UTC daily, before the shop opens.
  '0 7 * * *': runLowStockDigest,
  // 03:00 Sunday — housekeeping, when nobody is shopping.
  //
  // Registered under both spellings of Sunday. The Worker looks jobs up by the
  // exact schedule string Cloudflare echoes back in `event.cron`, and the
  // day-of-week field accepts either 1-7 or MON-SUN — so a wrangler.jsonc
  // written one way and a registry written the other means the job silently
  // never runs. (Plain "0" for Sunday is rejected outright by the API.)
  '0 3 * * SUN': runWeeklyMaintenance,
  '0 3 * * 7': runWeeklyMaintenance,
}
