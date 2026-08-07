import type { CollectionSlug, Payload, Where } from 'payload'

/**
 * Collect slugs for generateStaticParams, tolerating an unreachable or empty
 * database.
 *
 * `generateStaticParams` runs at BUILD time and queries D1. That is fine on a
 * developer machine with migrations applied, but a build can legitimately run
 * against a database that has none — a fresh CI checkout, or the very first
 * deploy before `deploy:database` has ever run. Letting that throw turns a
 * missing table into a failed build, which is a wildly disproportionate
 * response to "there is nothing to pre-render yet".
 *
 * Returning an empty list instead means those routes are simply rendered on
 * demand and cached from then on. The site is correct either way; only the
 * first request to each page is slower.
 */
export async function collectSlugs(
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
  limit: number,
): Promise<{ slug: string }[]> {
  try {
    const result = await payload.find({
      collection,
      where,
      limit,
      depth: 0,
      select: { slug: true },
      overrideAccess: true,
    })

    return result.docs
      .map((doc) => (doc as { slug?: string | null }).slug)
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => ({ slug }))
  } catch (error) {
    console.warn(
      `generateStaticParams: could not read "${collection}" (${
        error instanceof Error ? error.message : String(error)
      }). Falling back to on-demand rendering.`,
    )
    return []
  }
}
