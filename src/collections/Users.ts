import type { CollectionConfig } from 'payload'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Admin users. Roles and per-collection access control arrive in Phase 1;
 * this file establishes the auth hardening that everything else depends on.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'updatedAt'],
  },
  auth: {
    tokenExpiration: 7200, // 2 hours
    maxLoginAttempts: 5,
    lockTime: 600 * 1000, // 10 minute lockout after 5 failures
    cookies: {
      // `secure` must follow the environment: a Secure cookie is silently
      // dropped over plain http, which would make local login fail with no
      // visible error. Cloudflare terminates TLS, so production is always https.
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
  ],
}
