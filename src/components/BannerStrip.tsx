import { MediaImage } from '@/components/MediaImage'
import { buttonVariants } from '@/components/ui/Button'
import { Link } from '@/i18n/routing'
import { findActiveBanners, type StorefrontLocale } from '@/lib/payload'

/**
 * Renders whatever banners are scheduled for a placement.
 *
 * Returns null when nothing is live, so a placement never leaves an empty box
 * or a stray heading on the page — the section simply does not exist.
 */
export async function BannerStrip({
  placement,
  locale,
}: {
  placement: 'homepage_hero' | 'homepage_mid' | 'listing_top'
  locale: StorefrontLocale
}) {
  const banners = await findActiveBanners(placement, locale)

  if (banners.length === 0) return null

  return (
    <section className="container-page py-6">
      <div className="grid gap-4 md:grid-cols-2">
        {banners.map((banner) => {
          const content = (
            <div className="relative flex min-h-40 flex-col justify-center overflow-hidden rounded-[--radius-surface] border border-border-default bg-surface p-6">
              {banner.image && (
                <div className="absolute inset-0 opacity-20">
                  <MediaImage media={banner.image} sizes="(max-width: 768px) 100vw, 50vw" />
                </div>
              )}

              <div className="relative">
                <h3 className="text-xl font-semibold text-heading">{banner.title}</h3>
                {banner.subtitle && <p className="mt-1 text-base text-body">{banner.subtitle}</p>}
                {banner.linkUrl && banner.linkLabel && (
                  <span className={`${buttonVariants({ variant: 'primary', size: 'sm' })} mt-4`}>
                    {banner.linkLabel}
                  </span>
                )}
              </div>
            </div>
          )

          // When there is a link but no button label, the whole panel becomes
          // the target rather than rendering a banner nobody can act on.
          return banner.linkUrl ? (
            <Link key={banner.id} href={banner.linkUrl} className="block">
              {content}
            </Link>
          ) : (
            <div key={banner.id}>{content}</div>
          )
        })}
      </div>
    </section>
  )
}
