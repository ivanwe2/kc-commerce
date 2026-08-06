import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminField } from '@/access'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Admin-panel users. There are no customer accounts — checkout is anonymous.
 */
export const Users: CollectionConfig = {
  slug: 'users',

  access: {
    // Only admins manage staff accounts. Editors must not be able to grant
    // themselves the admin role, which `update: authenticated` would allow.
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    // Everyone signed in can read and update their own record (name, password).
    admin: ({ req: { user } }) => Boolean(user),
  },

  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'updatedAt'],
    group: 'Configuration',
  },

  auth: {
    tokenExpiration: 7200, // 2 hours
    maxLoginAttempts: 5,
    lockTime: 600 * 1000, // 10 minute lockout after 5 failures
    cookies: {
      // Must follow the environment: a Secure cookie is silently dropped over
      // plain http, so hardcoding `true` makes local login fail with no visible
      // error. Cloudflare terminates TLS, so production is always https.
      secure: isProduction,
      sameSite: 'Strict',
    },
  },

  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      index: true,
      options: [
        { label: 'Admin — full access', value: 'admin' },
        { label: 'Editor — catalogue and orders', value: 'editor' },
      ],
      // Field-level lock. Without it a user editing their own profile could
      // escalate themselves to admin, since they are permitted to update that
      // document.
      access: {
        create: isAdminField,
        update: isAdminField,
      },
      admin: {
        description: 'Editors can manage products, categories, pages and orders — but not users or settings.',
      },
    },
  ],
}
