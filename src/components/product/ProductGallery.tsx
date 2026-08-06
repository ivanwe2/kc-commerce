'use client'

import Image from 'next/image'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import type { Media } from '@/payload-types'

type GalleryImage = { image: Media | number; id?: string | null }

/**
 * Product image gallery.
 *
 * Client component only because switching the main image needs local state.
 * Thumbnails are real buttons so the gallery is keyboard-navigable — a
 * div-with-onClick would leave keyboard users unable to see any image past the
 * first.
 */
export function ProductGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const usable = images.filter(
    (item): item is { image: Media; id?: string | null } =>
      typeof item.image === 'object' && Boolean(item.image?.url),
  )

  const [activeIndex, setActiveIndex] = useState(0)
  const active = usable[activeIndex] ?? usable[0]

  if (!active) {
    return (
      <div className="aspect-square rounded-[--radius-surface] bg-surface" aria-hidden="true" />
    )
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[--radius-surface] border border-border-default bg-surface">
        <Image
          src={active.image.url!}
          alt={active.image.alt ?? title}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-contain p-6"
        />
      </div>

      {usable.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {usable.map((item, index) => (
            <li key={item.id ?? index}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${title} — ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={cn(
                  'relative size-16 overflow-hidden rounded-[--radius-control] border bg-surface transition-colors',
                  index === activeIndex
                    ? 'border-primary'
                    : 'border-border-default hover:border-border-strong',
                )}
              >
                <Image
                  src={item.image.url!}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
