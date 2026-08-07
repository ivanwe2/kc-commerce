import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Full-text product search backed by SQLite FTS5.
 *
 * Replaces `LIKE '%term%'`, which cannot use an index and therefore scans the
 * whole products table. On D1 that is not just slow — reads are metered, so an
 * unindexed scan is billed as well. At 6 products nobody notices; at 5,000 it is
 * the most expensive query in the shop.
 *
 * FTS5 also gives things LIKE never could: prefix matching (so results appear
 * while typing), relevance ranking via bm25, and multi-word queries that match
 * across the title and description together.
 */

export type SearchHit = {
  id: number
  slug: string
  title: string
  sku: string
  basePrice: number
  salePrice: number | null
  rank: number
}

/**
 * Turn raw user input into a safe FTS5 query.
 *
 * FTS5 has its own operator syntax — `AND`, `OR`, `NOT`, `NEAR`, `*`, quotes,
 * column filters. Passing user text straight through means a stray quote throws
 * a syntax error, and deliberate operators let a visitor probe the index. Each
 * token is therefore quoted as a literal, with `*` appended outside the quotes
 * for prefix matching.
 */
export function toFtsQuery(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .replace(/["*(){}[\]^:~-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 8)

  if (tokens.length === 0) return null

  // All tokens must match, each as a prefix: "почист преп" finds
  // "почистващ препарат".
  return tokens.map((token) => `"${token}"*`).join(' AND ')
}

/**
 * Search product ids by relevance.
 *
 * Returns ids only; the caller re-reads full documents through Payload so that
 * access control, localization and relationship resolution all still apply. The
 * index is a lookup, never a source of truth for what a visitor may see.
 */
export async function searchProductIds(
  query: string,
  limit = 20,
): Promise<{ ids: number[]; usedFts: boolean }> {
  const ftsQuery = toFtsQuery(query)
  if (!ftsQuery) return { ids: [], usedFts: false }

  try {
    const { env } = await getCloudflareContext({ async: true })

    const result = await env.D1.prepare(
      `SELECT p.id AS id
         FROM products_fts f
         JOIN products p ON p.id = f.rowid
        WHERE products_fts MATCH ?1
          AND p.is_active = 1
        ORDER BY bm25(products_fts, 10.0, 3.0, 1.0)
        LIMIT ?2`,
    )
      .bind(ftsQuery, limit)
      .all<{ id: number }>()

    return { ids: (result.results ?? []).map((row) => row.id), usedFts: true }
  } catch {
    /**
     * The index may not exist yet — it is created by a migration, and a
     * deployment that has not run it must still be able to serve search rather
     * than 500. The caller falls back to LIKE.
     */
    return { ids: [], usedFts: false }
  }
}

/**
 * Rebuild the entire FTS index from the products table.
 *
 * Used by the migration and available for repair. Cheap enough to run whole
 * rather than maintaining incremental correctness by hand.
 */
export async function rebuildSearchIndex(): Promise<number> {
  const { env } = await getCloudflareContext({ async: true })

  await env.D1.prepare(`DELETE FROM products_fts`).run()

  const inserted = await env.D1.prepare(
    `INSERT INTO products_fts (rowid, title, short_description, sku)
     SELECT p.id,
            COALESCE((SELECT group_concat(l.title, ' ')
                        FROM products_locales l WHERE l._parent_id = p.id), ''),
            COALESCE((SELECT group_concat(l.short_description, ' ')
                        FROM products_locales l WHERE l._parent_id = p.id), ''),
            COALESCE(p.sku, '')
       FROM products p`,
  ).run()

  return inserted.meta?.changes ?? 0
}
