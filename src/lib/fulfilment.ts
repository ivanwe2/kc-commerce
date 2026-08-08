import type { Order, Setting } from '@/payload-types'

/**
 * Warehouse paperwork: pick lists and packing slips.
 *
 * Printable HTML, for the same reason invoices are — see lib/invoice.ts. These
 * are printed and carried around a stockroom, so they are laid out for that:
 * large SKUs, generous tick boxes, and no colour that would vanish on a
 * monochrome laser printer.
 *
 * A PACKING SLIP goes in the box: one order, what the customer should find.
 * A PICK LIST stays with the picker: many orders at once, aggregated by
 * product, so the stockroom is walked once rather than once per order. That
 * distinction is the whole point of having both.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SHARED_STYLES = `
  body { font-family: system-ui, -apple-system, sans-serif; color: #000; margin: 0; padding: 24px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #444; margin-bottom: 16px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ccc; vertical-align: top; }
  th { border-bottom: 2px solid #000; font-size: 11px; text-transform: uppercase; }
  .num { text-align: right; white-space: nowrap; }
  .sku { font-family: ui-monospace, monospace; font-weight: 700; font-size: 14px; }
  .tick { width: 28px; height: 28px; border: 2px solid #000; display: inline-block; }
  .qty { font-size: 18px; font-weight: 700; }
  .order { page-break-after: always; }
  .order:last-child { page-break-after: auto; }
  @media print { body { padding: 0; } .noprint { display: none; } }
`

/** Packing slip for a single order — the document that goes in the box. */
export function renderPackingSlip(order: Order, settings: Setting): string {
  const address = order.shippingAddress
  const destination = address?.street
    ? `${address.street}<br>${address.postalCode ?? ''} ${address.city ?? ''}`
    : escapeHtml(order.officeCode ?? '')

  const rows = (order.items ?? [])
    .map(
      (item) => `<tr>
        <td><span class="tick"></span></td>
        <td class="sku">${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td class="num qty">${item.quantity}</td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="bg"><head><meta charset="utf-8">
<title>Packing slip ${escapeHtml(order.orderNumber)}</title>
<style>${SHARED_STYLES}</style></head>
<body>
  <h1>${escapeHtml(settings.companyName ?? 'KC Trading')}</h1>
  <div class="meta">
    Товарителница / Packing slip &nbsp;·&nbsp; <strong>${escapeHtml(order.orderNumber)}</strong>
    &nbsp;·&nbsp; ${new Date(order.createdAt).toLocaleDateString('bg-BG')}
  </div>

  <p>
    <strong>${escapeHtml(`${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim())}</strong><br>
    ${escapeHtml(order.customer?.phone ?? '')}<br>
    ${destination}
  </p>

  <table>
    <thead><tr><th></th><th>SKU</th><th>Продукт</th><th class="num">Кол.</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <p style="margin-top:24px;">
    <strong>Наложен платеж:</strong> плащане при доставка.<br>
    <em>Право на отказ в 14-дневен срок / 14-day right of withdrawal.</em>
  </p>
  <p class="noprint" style="color:#666;font-size:11px;">Ctrl+P за печат</p>
</body></html>`
}

/**
 * Pick list across many orders, aggregated by product.
 *
 * Aggregation is the point: picking ten orders individually means ten walks
 * past the same shelf. Grouped by SKU with a per-order breakdown underneath,
 * the stockroom is walked once and the items are split at the packing bench.
 */
export function renderPickList(orders: Order[], settings: Setting): string {
  const byProduct = new Map<
    string,
    { sku: string; title: string; total: number; orders: { number: string; quantity: number }[] }
  >()

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const existing = byProduct.get(item.sku) ?? {
        sku: item.sku,
        title: item.title,
        total: 0,
        orders: [],
      }
      existing.total += item.quantity
      existing.orders.push({ number: order.orderNumber, quantity: item.quantity })
      byProduct.set(item.sku, existing)
    }
  }

  const rows = [...byProduct.values()]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map(
      (entry) => `<tr>
        <td><span class="tick"></span></td>
        <td class="sku">${escapeHtml(entry.sku)}</td>
        <td>
          ${escapeHtml(entry.title)}<br>
          <small style="color:#555;">${entry.orders
            .map((o) => `${escapeHtml(o.number)} ×${o.quantity}`)
            .join(' &nbsp;·&nbsp; ')}</small>
        </td>
        <td class="num qty">${entry.total}</td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="bg"><head><meta charset="utf-8">
<title>Pick list</title>
<style>${SHARED_STYLES}</style></head>
<body>
  <h1>${escapeHtml(settings.companyName ?? 'KC Trading')}</h1>
  <div class="meta">
    Лист за комплектоване / Pick list &nbsp;·&nbsp;
    ${orders.length} поръчки &nbsp;·&nbsp; ${new Date().toLocaleString('bg-BG')}
  </div>

  <table>
    <thead><tr><th></th><th>SKU</th><th>Продукт / Поръчки</th><th class="num">Общо</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <p class="noprint" style="color:#666;font-size:11px;">Ctrl+P за печат</p>
</body></html>`
}
