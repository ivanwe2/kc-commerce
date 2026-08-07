import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access'

/**
 * Immutable record of every price a product has ever been sold at.
 *
 * This is a LEGAL REQUIREMENT, not analytics.
 *
 * The Omnibus Directive, as implemented in the Bulgarian Consumer Protection
 * Act, requires that any announced price reduction display the lowest price
 * applied during the 30 days preceding the reduction — not the regular price,
 * the lowest actual one. You cannot compute that without a history, and you
 * cannot reconstruct a history after the fact.
 *
 * That has a scheduling consequence worth stating plainly: this table must be
 * accumulating data BEFORE the first sale runs. A discount announced on a
 * product with no history has no defensible reference price.
 *
 * Rows are written by a hook and are never edited. The collection is read-only
 * in the admin so that a well-meaning edit cannot destroy the evidence that
 * justifies a displayed discount.
 */
export const PriceHistory: CollectionConfig = {
  slug: 'price-history',

  access: {
    read: isAdmin,
    // Written exclusively by the Products afterChange hook via the Local API.
    create: () => false,
    update: () => false,
    delete: () => false,
  },

  admin: {
    useAsTitle: 'recordedAt',
    defaultColumns: ['product', 'price', 'recordedAt'],
    group: 'System',
    description:
      'Automatic record of price changes, used to compute the 30-day reference price required for advertised discounts. Read-only by law and by design.',
    hidden: ({ user }) => !user || (user as { role?: string }).role !== 'admin',
  },

  timestamps: true,

  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      admin: {
        readOnly: true,
        description: 'The effective selling price at this moment — sale price if one was active.',
      },
    },
    {
      name: 'recordedAt',
      type: 'date',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
  ],
}
