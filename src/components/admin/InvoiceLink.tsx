'use client'

import { useDocumentInfo } from '@payloadcms/ui'

/**
 * "Open invoice" link in the order sidebar.
 *
 * A link rather than a button that fetches: the invoice is a full HTML document
 * meant to be printed, so opening it in a tab is exactly the right interaction
 * and needs no JavaScript beyond reading the current order number.
 */
export function InvoiceLink() {
  const { savedDocumentData } = useDocumentInfo()
  const orderNumber = (savedDocumentData as { orderNumber?: string } | undefined)?.orderNumber

  if (!orderNumber) return null

  return (
    <div style={{ marginBottom: '1rem' }}>
      <a
        href={`/api/invoice/${encodeURIComponent(orderNumber)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn--style-secondary btn--size-small"
        style={{ display: 'inline-block' }}
      >
        Invoice / Фактура →
      </a>
    </div>
  )
}
