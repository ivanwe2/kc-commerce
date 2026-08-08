import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` ADD \`return_requested_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`return_reason\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`return_refund_amount\` numeric;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`return_refunded_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`return_restock\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`return_notes\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`return_requested_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`return_reason\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`return_refund_amount\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`return_refunded_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`return_restock\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`return_notes\`;`)
}
