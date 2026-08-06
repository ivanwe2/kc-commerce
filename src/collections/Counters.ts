import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access'

/**
 * Atomic sequence counters. Currently: order numbers.
 *
 * SQLite has no sequences, and D1 has no interactive transactions, so the usual
 * "read the last order number and add one" approach is a lost-update race that
 * hands two simultaneous checkouts the same order number — which then collides
 * on the unique index and fails a customer's order at the final step.
 *
 * This collection exists to be incremented by a single atomic SQL statement
 * (see src/lib/counters.ts). It is not meant to be edited by hand; it is
 * exposed in the admin panel read-only so that a support case can be diagnosed.
 */
export const Counters: CollectionConfig = {
  slug: 'counters',

  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },

  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'value', 'updatedAt'],
    group: 'System',
    description:
      'Internal sequence counters, incremented atomically at checkout. Read-only by design.',
    hidden: ({ user }) => !user || (user as { role?: string }).role !== 'admin',
  },

  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'e.g. "orders:2026"' },
    },
    {
      name: 'value',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { readOnly: true },
    },
  ],
}
