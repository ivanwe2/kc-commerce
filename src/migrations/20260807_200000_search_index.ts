import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'

/**
 * Full-text search index (SQLite FTS5), kept in sync by database triggers.
 *
 * Hand-written rather than generated: Payload's schema diff does not know about
 * virtual tables, so `migrate:create` will never produce this.
 *
 * Triggers rather than a Payload hook, deliberately. A hook only fires for
 * writes that go through Payload — a migration, a seed script, or a manual
 * `wrangler d1 execute` would all leave the index quietly wrong. Triggers make
 * the database responsible for its own consistency, which is the only version of
 * this that cannot drift.
 *
 * Both locales are indexed into one row per product, so a Bulgarian search term
 * and an English one both find the same product without needing to know which
 * language the visitor is browsing in.
 */

const FTS_TABLE = `
  CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    title,
    short_description,
    sku,
    tokenize = 'unicode61 remove_diacritics 2'
  );
`

/** Rebuild one product's row from the base table and every locale it has. */
const REBUILD_ONE = (idExpr: string) => `
  DELETE FROM products_fts WHERE rowid = ${idExpr};
  INSERT INTO products_fts (rowid, title, short_description, sku)
  SELECT p.id,
         COALESCE((SELECT group_concat(l.title, ' ')
                     FROM products_locales l WHERE l._parent_id = p.id), ''),
         COALESCE((SELECT group_concat(l.short_description, ' ')
                     FROM products_locales l WHERE l._parent_id = p.id), ''),
         COALESCE(p.sku, '')
    FROM products p
   WHERE p.id = ${idExpr};
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(FTS_TABLE)

  // Initial population.
  await db.run(`
    INSERT INTO products_fts (rowid, title, short_description, sku)
    SELECT p.id,
           COALESCE((SELECT group_concat(l.title, ' ')
                       FROM products_locales l WHERE l._parent_id = p.id), ''),
           COALESCE((SELECT group_concat(l.short_description, ' ')
                       FROM products_locales l WHERE l._parent_id = p.id), ''),
           COALESCE(p.sku, '')
      FROM products p;
  `)

  // Base table: sku changes, and inserts/deletes of the product itself.
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS products_fts_ai AFTER INSERT ON products BEGIN
      ${REBUILD_ONE('new.id')}
    END;
  `)
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS products_fts_au AFTER UPDATE ON products BEGIN
      ${REBUILD_ONE('new.id')}
    END;
  `)
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS products_fts_ad AFTER DELETE ON products BEGIN
      DELETE FROM products_fts WHERE rowid = old.id;
    END;
  `)

  // Localized text lives in a separate table, so it needs its own triggers —
  // without these, editing a product title would never reach the index.
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS products_locales_fts_ai AFTER INSERT ON products_locales BEGIN
      ${REBUILD_ONE('new._parent_id')}
    END;
  `)
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS products_locales_fts_au AFTER UPDATE ON products_locales BEGIN
      ${REBUILD_ONE('new._parent_id')}
    END;
  `)
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS products_locales_fts_ad AFTER DELETE ON products_locales BEGIN
      ${REBUILD_ONE('old._parent_id')}
    END;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const trigger of [
    'products_fts_ai',
    'products_fts_au',
    'products_fts_ad',
    'products_locales_fts_ai',
    'products_locales_fts_au',
    'products_locales_fts_ad',
  ]) {
    await db.run(`DROP TRIGGER IF EXISTS ${trigger};`)
  }

  await db.run(`DROP TABLE IF EXISTS products_fts;`)
}
