'use client'

import { X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { Link } from '@/i18n/routing'

/**
 * Mobile navigation drawer.
 *
 * Built on the native <dialog> element rather than a modal library: it gives
 * focus trapping, Escape-to-close and inert background content for free, from
 * the platform, at zero bundle cost. That matters against a 10MB Worker budget.
 */
export function MobileNav({
  links,
  label,
  closeLabel,
  siteName,
  children,
}: {
  links: { href: string; label: string }[]
  label: string
  closeLabel: string
  // Passed down rather than read here: this is a Client Component, and the
  // header already has Settings loaded. A second hardcoded copy of the brand
  // is exactly how a rebrand ends up half-applied.
  siteName: string
  children: React.ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[--radius-control] text-secondary transition-colors hover:bg-surface-alt hover:text-primary md:hidden"
      >
        {children}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        // Clicking the backdrop closes. The check identifies the backdrop
        // because the dialog element itself fills the area behind its content.
        onClick={(event) => {
          if (event.target === dialogRef.current) setIsOpen(false)
        }}
        className="m-0 h-full max-h-full w-4/5 max-w-xs bg-background p-0 backdrop:bg-heading/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-[--header-height] items-center justify-between border-b border-border-default px-4">
            <span className="font-semibold text-heading">{siteName}</span>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[--radius-control] text-secondary hover:bg-surface-alt"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Mobile" className="flex flex-col p-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="flex min-h-11 items-center rounded-[--radius-control] px-3 text-base font-medium text-body transition-colors hover:bg-surface-alt hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </dialog>
    </>
  )
}
