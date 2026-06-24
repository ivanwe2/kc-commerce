import type { CollectionConfig, User } from 'payload'

const USER_ROLES = [
  { label: 'Admin', value: 'admin' },
  { label: 'Customer', value: 'customer' },
]

type UserWithRole = User & { role?: string }

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => {
      return (user as UserWithRole)?.role === 'admin'
    },
    create: () => true, // public registration
    delete: ({ req: { user } }) => (user as UserWithRole)?.role === 'admin',
    read: ({ req: { user } }) => {
      // Authenticated users can read their own profile
      return !!user
    },
    update: ({ req: { user } }) => {
      // Admins can update anyone; users can update their own profile
      return !!user
    },
  },
  admin: {
    defaultColumns: ['name', 'email', 'role', 'createdAt'],
    useAsTitle: 'name',
  },
  auth: {
    verify: {
      generateEmailHTML: ({ token }) => {
        return `
          <h1>Verify your email</h1>
          <p>Click the link below to verify your email address:</p>
          <a href="${token}">Verify Email</a>
        `
      },
    },
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'customer',
      options: USER_ROLES,
      access: {
        update: ({ req: { user } }) => (user as UserWithRole)?.role === 'admin',
      },
      admin: {
        position: 'sidebar',
        description: 'Admin can manage users; Customer has standard access',
      },
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
