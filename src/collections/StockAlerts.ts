import type { CollectionConfig } from 'payload'

import { isAdminOrEditor } from '@/access'

/**
 * "Notify me when back in stock" subscriptions.
 *
 * Read is staff-only: the rows are email addresses paired with an expressed
 * interest, which is personal data and has no reason to be publicly listable.
 *
 * Notified rows are kept rather than deleted so the same person is not emailed
 * twice for one restock, and so a request can be answered if someone asks why
 * they received it.
 */
export const StockAlerts: CollectionConfig = {
  slug: 'stock-alerts',

  access: {
    read: isAdminOrEditor,
    // Created by the server action, which validates the email and rate limits.
    create: () => false,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'product', 'notifiedAt', 'createdAt'],
    group: 'Sales',
  },

  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      index: true,
    },
    {
      name: 'locale',
      type: 'text',
      defaultValue: 'bg',
      admin: { description: 'Language to send the notification in.' },
    },
    {
      name: 'notifiedAt',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
        description: 'Set once the restock email has been sent. Empty means still waiting.',
      },
    },
  ],
}
