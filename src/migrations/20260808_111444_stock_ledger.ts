import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`stock_movements\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`product_id\` integer NOT NULL,
  	\`delta\` numeric NOT NULL,
  	\`reason\` text NOT NULL,
  	\`balance_after\` numeric,
  	\`reference\` text,
  	\`recorded_by\` text,
  	\`note\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`stock_movements_product_idx\` ON \`stock_movements\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_reason_idx\` ON \`stock_movements\` (\`reason\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_reference_idx\` ON \`stock_movements\` (\`reference\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_updated_at_idx\` ON \`stock_movements\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_created_at_idx\` ON \`stock_movements\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`cost_price\` numeric;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`stock_movements_id\` integer REFERENCES stock_movements(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_movements_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_movements_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`stock_movements\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`products_id\` integer,
  	\`categories_id\` integer,
  	\`brands_id\` integer,
  	\`orders_id\` integer,
  	\`pages_id\` integer,
  	\`media_id\` integer,
  	\`users_id\` integer,
  	\`banners_id\` integer,
  	\`reviews_id\` integer,
  	\`customers_id\` integer,
  	\`coupons_id\` integer,
  	\`stock_alerts_id\` integer,
  	\`counters_id\` integer,
  	\`price_history_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`brands_id\`) REFERENCES \`brands\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`banners_id\`) REFERENCES \`banners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`reviews_id\`) REFERENCES \`reviews\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`customers_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`coupons_id\`) REFERENCES \`coupons\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`stock_alerts_id\`) REFERENCES \`stock_alerts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`counters_id\`) REFERENCES \`counters\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`price_history_id\`) REFERENCES \`price_history\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "products_id", "categories_id", "brands_id", "orders_id", "pages_id", "media_id", "users_id", "banners_id", "reviews_id", "customers_id", "coupons_id", "stock_alerts_id", "counters_id", "price_history_id") SELECT "id", "order", "parent_id", "path", "products_id", "categories_id", "brands_id", "orders_id", "pages_id", "media_id", "users_id", "banners_id", "reviews_id", "customers_id", "coupons_id", "stock_alerts_id", "counters_id", "price_history_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_brands_id_idx\` ON \`payload_locked_documents_rels\` (\`brands_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_banners_id_idx\` ON \`payload_locked_documents_rels\` (\`banners_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reviews_id_idx\` ON \`payload_locked_documents_rels\` (\`reviews_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_customers_id_idx\` ON \`payload_locked_documents_rels\` (\`customers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_coupons_id_idx\` ON \`payload_locked_documents_rels\` (\`coupons_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_alerts_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_alerts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_counters_id_idx\` ON \`payload_locked_documents_rels\` (\`counters_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_price_history_id_idx\` ON \`payload_locked_documents_rels\` (\`price_history_id\`);`)
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`cost_price\`;`)
}
