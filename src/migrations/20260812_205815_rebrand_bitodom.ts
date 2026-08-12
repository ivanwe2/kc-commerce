import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_settings_locales\` (
  	\`site_name\` text DEFAULT 'Битодом',
  	\`hero_heading\` text,
  	\`hero_subheading\` text,
  	\`announcement_bar_text\` text,
  	\`address\` text,
  	\`registered_address\` text,
  	\`shipping_info\` text,
  	\`footer_text\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_settings_locales\`("site_name", "hero_heading", "hero_subheading", "announcement_bar_text", "address", "registered_address", "shipping_info", "footer_text", "id", "_locale", "_parent_id") SELECT "site_name", "hero_heading", "hero_subheading", "announcement_bar_text", "address", "registered_address", "shipping_info", "footer_text", "id", "_locale", "_parent_id" FROM \`settings_locales\`;`)
  await db.run(sql`DROP TABLE \`settings_locales\`;`)
  await db.run(sql`ALTER TABLE \`__new_settings_locales\` RENAME TO \`settings_locales\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`settings_locales_locale_parent_id_unique\` ON \`settings_locales\` (\`_locale\`,\`_parent_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_settings_locales\` (
  	\`site_name\` text DEFAULT 'KC Trading',
  	\`hero_heading\` text,
  	\`hero_subheading\` text,
  	\`announcement_bar_text\` text,
  	\`address\` text,
  	\`registered_address\` text,
  	\`shipping_info\` text,
  	\`footer_text\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_settings_locales\`("site_name", "hero_heading", "hero_subheading", "announcement_bar_text", "address", "registered_address", "shipping_info", "footer_text", "id", "_locale", "_parent_id") SELECT "site_name", "hero_heading", "hero_subheading", "announcement_bar_text", "address", "registered_address", "shipping_info", "footer_text", "id", "_locale", "_parent_id" FROM \`settings_locales\`;`)
  await db.run(sql`DROP TABLE \`settings_locales\`;`)
  await db.run(sql`ALTER TABLE \`__new_settings_locales\` RENAME TO \`settings_locales\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`settings_locales_locale_parent_id_unique\` ON \`settings_locales\` (\`_locale\`,\`_parent_id\`);`)
}
