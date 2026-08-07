import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`price_history\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`product_id\` integer NOT NULL,
  	\`price\` numeric NOT NULL,
  	\`recorded_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`price_history_product_idx\` ON \`price_history\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`price_history_recorded_at_idx\` ON \`price_history\` (\`recorded_at\`);`)
  await db.run(sql`CREATE INDEX \`price_history_updated_at_idx\` ON \`price_history\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`price_history_created_at_idx\` ON \`price_history\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`sale_price\` numeric;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`sale_starts_at\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`sale_ends_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders_items\` ADD \`reference_price\` numeric;`)
  await db.run(sql`ALTER TABLE \`orders_items\` ADD \`was_on_sale\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`price_history_id\` integer REFERENCES price_history(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_price_history_id_idx\` ON \`payload_locked_documents_rels\` (\`price_history_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`price_history\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`products_id\` integer,
  	\`categories_id\` integer,
  	\`orders_id\` integer,
  	\`pages_id\` integer,
  	\`media_id\` integer,
  	\`users_id\` integer,
  	\`counters_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`counters_id\`) REFERENCES \`counters\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "products_id", "categories_id", "orders_id", "pages_id", "media_id", "users_id", "counters_id") SELECT "id", "order", "parent_id", "path", "products_id", "categories_id", "orders_id", "pages_id", "media_id", "users_id", "counters_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_counters_id_idx\` ON \`payload_locked_documents_rels\` (\`counters_id\`);`)
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`sale_price\`;`)
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`sale_starts_at\`;`)
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`sale_ends_at\`;`)
  await db.run(sql`ALTER TABLE \`orders_items\` DROP COLUMN \`reference_price\`;`)
  await db.run(sql`ALTER TABLE \`orders_items\` DROP COLUMN \`was_on_sale\`;`)
}
