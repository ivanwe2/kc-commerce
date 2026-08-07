import type { CollectionConfig } from 'payload'

import { isAdminOrEditor } from '@/access'
import { revalidateProductFromReview } from './hooks/revalidate'

/**
 * Product reviews, moderated before publication.
 *
 * Approval is required rather than optional. An unmoderated review box on a
 * public shop fills with spam within days, and under the Omnibus Directive a
 * trader who publishes reviews must also state how they ensure the reviews come
 * from actual purchasers — which is impossible to claim about content nobody
 * looked at.
 */
export const Reviews: CollectionConfig = {
  slug: 'reviews',

  access: {
    // Only approved reviews are public. The constraint is a query, so an
    // unapproved review cannot leak through a list endpoint.
    read: ({ req: { user } }) => {
      if (user?.collection === 'users') return true
      return { isApproved: { equals: true } }
    },
    // Created only by the server action, which verifies the reviewer bought the
    // product. A public create endpoint would be a spam funnel.
    create: () => false,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['product', 'rating', 'authorName', 'isApproved', 'createdAt'],
    group: 'Content',
    description: 'Reviews are hidden until approved.',
  },

  defaultSort: '-createdAt',

  hooks: {
    afterChange: [revalidateProductFromReview],
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
      type: 'row',
      fields: [
        {
          name: 'rating',
          type: 'number',
          required: true,
          min: 1,
          max: 5,
        },
        { name: 'authorName', type: 'text', required: true },
      ],
    },
    { name: 'title', type: 'text' },
    { name: 'body', type: 'textarea', maxLength: 2000 },
    {
      name: 'orderNumber',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'The verified purchase this review is attached to.',
      },
    },
    {
      name: 'isApproved',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar' },
    },
  ],
}
