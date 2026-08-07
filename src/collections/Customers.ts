import type { CollectionConfig } from 'payload'

import { isAdminOrEditor } from '@/access'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Optional customer accounts.
 *
 * A SEPARATE auth collection from Users, deliberately. Users grants access to
 * the admin panel; if customers lived there, a bug in a role check would be the
 * difference between a shopper and an administrator. Two collections means a
 * customer literally cannot hold an admin role, whatever the code does.
 *
 * Registration is optional and always will be. Guest checkout stays the default
 * path — forcing registration is one of the most reliable ways to lose orders,
 * and this shop's customers are buying cleaning supplies, not joining a club.
 * An account exists to make the SECOND order easier, not to gate the first.
 */
export const Customers: CollectionConfig = {
  slug: 'customers',

  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // 30 days — this is a shop, not a bank
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
    cookies: {
      secure: isProduction,
      // Lax rather than Strict: a customer following a link from a confirmation
      // email should arrive still signed in.
      sameSite: 'Lax',
    },
    verify: false,
  },

  access: {
    // Staff can see customers for support. A customer can read and update only
    // their own record — the constraint is a query, so it filters in the
    // database rather than after the fact.
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.collection === 'users') return true
      return { id: { equals: user.id } }
    },
    create: () => true, // public registration
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.collection === 'users') return true
      return { id: { equals: user.id } }
    },
    delete: isAdminOrEditor,
    admin: ({ req: { user } }) => user?.collection === 'users',
  },

  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'createdAt'],
    group: 'Sales',
  },

  fields: [
    {
      type: 'row',
      fields: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'lastName', type: 'text', required: true },
      ],
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'defaultAddress',
      type: 'group',
      admin: { description: 'Pre-fills checkout. The customer can still change it per order.' },
      fields: [
        { name: 'street', type: 'text' },
        {
          type: 'row',
          fields: [
            { name: 'city', type: 'text' },
            { name: 'postalCode', type: 'text' },
          ],
        },
        {
          name: 'preferredShippingMethod',
          type: 'select',
          options: [
            { label: 'Econt — to office', value: 'econt_office' },
            { label: 'Econt — to address', value: 'econt_address' },
            { label: 'Speedy — to office', value: 'speedy_office' },
            { label: 'Speedy — to address', value: 'speedy_address' },
          ],
        },
        { name: 'officeCode', type: 'text' },
      ],
    },
    {
      name: 'marketingConsent',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Consent record — reflects what the customer chose.' },
    },
  ],
}
