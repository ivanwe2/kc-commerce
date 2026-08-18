import config from '@payload-config'
import { getPayload } from 'payload'

/**
 * Create the first admin user.
 *
 * Payload's create-first-user route is open to anyone until an admin exists.
 * That is by design and harmless on localhost, but the moment the Worker is
 * reachable on a real domain it is a live exposure: whoever loads /admin first
 * becomes the administrator of the shop. This script closes that window without
 * a human having to be at a keyboard at the right moment.
 *
 * Credentials come from the environment so they never appear in the file or in
 * shell history. Run with CLOUDFLARE_REMOTE=true to target production.
 */
async function run() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.')

  const payload = await getPayload({ config })

  const existing = await payload.count({ collection: 'users' })
  if (existing.totalDocs > 0) {
    // eslint-disable-next-line no-console -- CLI script; output is the point.
    console.log(`Refusing to run: ${existing.totalDocs} user(s) already exist.`)
    return
  }

  const user = await payload.create({
    collection: 'users',
    data: { email, password, name: process.env.ADMIN_NAME ?? 'Administrator', role: 'admin' },
  })

  // eslint-disable-next-line no-console -- CLI script; output is the point.
  console.log(`Created admin user ${user.email} (id ${user.id}).`)
}

try {
  await run()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
