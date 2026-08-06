import Image from 'next/image'

import { cn } from '@/lib/utils'
import type { Media } from '@/payload-types'

/**
 * Renders a Payload media document.
 *
 * Payload cannot generate thumbnails on Workers (no sharp), so there are no
 * `sizes` variants to pick from — one original is stored and Cloudflare resizes
 * it at request time via the custom loader. That makes an accurate `sizes` prop
 * more important than usual: it is the only thing telling the loader which
 * width to actually request.
 */
export function MediaImage({
  media,
  className,
  sizes,
  priority = false,
  fill = true,
  width,
  height,
}: {
  media: Media | number | null | undefined
  className?: string
  sizes: string
  priority?: boolean
  fill?: boolean
  width?: number
  height?: number
}) {
  // depth:0 queries leave relationships as bare ids; there is nothing to render.
  if (!media || typeof media === 'number' || !media.url) {
    return <div className={cn('bg-surface-alt', className)} aria-hidden="true" />
  }

  const alt = media.alt ?? ''

  if (fill) {
    return (
      <Image
        src={media.url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('object-contain', className)}
      />
    )
  }

  return (
    <Image
      src={media.url}
      alt={alt}
      width={width ?? media.width ?? 600}
      height={height ?? media.height ?? 600}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  )
}
