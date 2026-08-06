import type { Access, FieldAccess } from 'payload'

/**
 * Access control.
 *
 * Payload denies by default, so every rule here is an explicit grant. Read the
 * comments before loosening any of them — `orders` in particular contains
 * customer names, phone numbers and addresses.
 */

type Role = 'admin' | 'editor'

function roleOf(user: unknown): Role | undefined {
  if (user && typeof user === 'object' && 'role' in user) {
    const role = (user as { role?: unknown }).role
    if (role === 'admin' || role === 'editor') return role
  }
  return undefined
}

/** Public. Use only for genuinely public content. */
export const anyone: Access = () => true

/** Any signed-in admin-panel user. */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Full control — users, settings, anything destructive. */
export const isAdmin: Access = ({ req: { user } }) => roleOf(user) === 'admin'

/** Day-to-day catalogue and order management. */
export const isAdminOrEditor: Access = ({ req: { user } }) => Boolean(roleOf(user))

/**
 * Field-level equivalents.
 *
 * Payload types collection access and field access separately — `FieldAccess`
 * returns a boolean only, since a field cannot be filtered by a query
 * constraint the way a document can. They are not interchangeable.
 */
export const isAdminField: FieldAccess = ({ req: { user } }) => roleOf(user) === 'admin'

export const isAdminOrEditorField: FieldAccess = ({ req: { user } }) => Boolean(roleOf(user))

/**
 * Public reads see only published documents; signed-in staff see drafts too.
 *
 * Returning a *query constraint* rather than a boolean matters — it filters at
 * the database level, so an unpublished document cannot leak through a list
 * endpoint the way a naive post-filter would allow.
 */
export const publishedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true
  return { isPublished: { equals: true } }
}

/** Same idea for catalogue items, which use `isActive`. */
export const activeOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true
  return { isActive: { equals: true } }
}
