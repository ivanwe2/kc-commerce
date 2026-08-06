'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

import { Link, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'

/**
 * Numbered pagination.
 *
 * Renders real links carrying the full query string, so filters survive paging,
 * pages are crawlable, and the browser back button behaves. A button-and-router
 * implementation would lose all three.
 */
export function Pagination({
  currentPage,
  totalPages,
  className,
}: {
  currentPage: number
  totalPages: number
  className?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) params.delete('page')
    else params.set('page', String(page))
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  // Windowed around the current page so a 500-page catalogue does not render
  // 500 links.
  const windowSize = 2
  const pages: number[] = []
  for (let page = 1; page <= totalPages; page++) {
    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= windowSize) {
      pages.push(page)
    }
  }

  const itemClass =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[--radius-control] px-3 text-sm font-medium transition-colors'

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      {currentPage > 1 && (
        <Link href={hrefFor(currentPage - 1)} rel="prev" aria-label="Previous page" className={cn(itemClass, 'text-secondary hover:bg-surface-alt')}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      )}

      {pages.map((page, index) => {
        const previous = pages[index - 1]
        const gap = previous !== undefined && page - previous > 1

        return (
          <span key={page} className="flex items-center gap-1">
            {gap && <span className="px-1 text-muted">…</span>}
            <Link
              href={hrefFor(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={cn(
                itemClass,
                page === currentPage
                  ? 'bg-primary text-primary-foreground'
                  : 'text-secondary hover:bg-surface-alt',
              )}
            >
              {page}
            </Link>
          </span>
        )
      })}

      {currentPage < totalPages && (
        <Link href={hrefFor(currentPage + 1)} rel="next" aria-label="Next page" className={cn(itemClass, 'text-secondary hover:bg-surface-alt')}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}
