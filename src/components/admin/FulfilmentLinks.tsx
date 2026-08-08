'use client'

import { useDocumentInfo } from '@payloadcms/ui'

/**
 * Packing slip link in the order sidebar, next to the invoice.
 *
 * Rendered only once the order has a number — a document that has never been
 * saved has nothing to print.
 */
export function PackingSlipLink() {
  const { savedDocumentData } = useDocumentInfo()
  const orderNumber = (savedDocumentData as { orderNumber?: string } | undefined)?.orderNumber

  if (!orderNumber) return null

  return (
    <div style={{ marginBottom: '1rem' }}>
      <a
        href={`/api/fulfilment?type=packing-slip&order=${encodeURIComponent(orderNumber)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn--style-secondary btn--size-small"
        style={{ display: 'inline-block' }}
      >
        Packing slip / Товарителница →
      </a>
    </div>
  )
}
