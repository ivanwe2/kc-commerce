import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Atomically claim the next value of a named counter.
 *
 * Why raw D1 rather than Payload's API: D1 cannot run interactive transactions,
 * so a read-then-write through the ORM is a genuine race. Two checkouts landing
 * together would both read N and both write N+1, producing duplicate order
 * numbers that then collide on the unique index and fail a customer's order at
 * the very last step.
 *
 * A single UPSERT ... RETURNING is atomic in SQLite by construction: the whole
 * statement succeeds or fails as one unit and concurrent callers are serialised
 * by the database. No lock, no retry loop, no possibility of a duplicate.
 *
 * Using the D1 binding directly (rather than reaching into `payload.db.drizzle`)
 * keeps this fully typed against cloudflare-env.d.ts and avoids depending on
 * Payload's internal ORM surface, which is not part of its public API.
 *
 * The bound parameter is not optional politeness — interpolating the key into
 * the SQL string would be an injection point reachable from application input.
 */
export async function nextCounterValue(key: string): Promise<number> {
  const { env } = await getCloudflareContext({ async: true })

  // The timestamp expression must match what Payload's migration uses for these
  // columns. CURRENT_TIMESTAMP yields "2026-08-07 00:27:10", while Payload
  // stores ISO-8601 with milliseconds and a Z suffix; mixing the two puts values
  // in the column that Payload's date parsing does not understand.
  const now = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

  const row = await env.D1.prepare(
    `INSERT INTO counters (key, value, updated_at, created_at)
     VALUES (?1, 1, ${now}, ${now})
     ON CONFLICT(key) DO UPDATE SET
       value = value + 1,
       updated_at = ${now}
     RETURNING value`,
  )
    .bind(key)
    .first<{ value: number }>()

  if (!row || typeof row.value !== 'number') {
    throw new Error(`Counter "${key}" did not return a value.`)
  }

  return row.value
}

/**
 * Format a claimed sequence number as a customer-facing order number.
 * Keyed per year so numbering restarts each January: BD-2026-00001
 *
 * The prefix is deliberately a constant rather than a Settings field. Order
 * numbers are how customers and couriers refer to an order for years after it
 * ships; making the prefix editable would let a later rebrand silently split
 * the sequence into two formats, and order lookup matches on the whole string.
 */
export function formatOrderNumber(year: number, sequence: number): string {
  return `BD-${year}-${String(sequence).padStart(5, '0')}`
}

/**
 * Matches a customer-facing order number.
 *
 * Lives here, beside the formatter it has to agree with. Three independent
 * copies of this pattern previously sat in the confirmation page, order lookup
 * and the withdrawal form — so changing the prefix in `formatOrderNumber` left
 * all three silently rejecting every real order number as malformed, with the
 * customer told only that the field was invalid.
 *
 * Deliberately no `g` flag: a global regex carries `lastIndex` between
 * `.test()` calls and would fail every second check.
 */
export const ORDER_NUMBER_PATTERN = /^BD-\d{4}-\d{5}$/

/** The counter key for a given year. */
export function orderCounterKey(year: number): string {
  return `orders:${year}`
}
