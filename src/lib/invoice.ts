import { formatPrice, roundMoney } from './money'
import type { Order, Setting } from '@/payload-types'

/**
 * Invoice rendering, Bulgarian format.
 *
 * HTML with print styles rather than a generated PDF, deliberately. Every
 * JavaScript PDF library either bundles a font subsetter and a rasteriser
 * (hundreds of kilobytes into a 10MB Worker budget) or needs native bindings
 * that do not exist on workerd. The browser already contains an excellent
 * PDF writer: Ctrl+P → Save as PDF produces a selectable, searchable file with
 * correct Cyrillic, at zero bundle cost.
 *
 * The layout follows the Bulgarian invoice convention: sequential number,
 * issue date, both parties with UIC/Bulstat and VAT numbers, line items, and
 * the VAT treatment stated explicitly.
 *
 * NOTE ON VAT: prices in this shop are stored VAT-inclusive. The breakdown below
 * therefore back-calculates the net and tax amounts from the gross, which is the
 * correct direction when the displayed price is what the customer pays. If the
 * business is not VAT-registered, set vatRate to 0 and the invoice states that
 * instead of showing a zero tax line.
 */

const VAT_RATE = 0.2 // Bulgaria standard rate

export type InvoiceData = {
  order: Order
  settings: Setting
  locale: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const LABELS = {
  bg: {
    invoice: 'ФАКТУРА',
    proforma: 'Оригинал',
    number: 'Фактура №',
    date: 'Дата на издаване',
    supplier: 'Доставчик',
    recipient: 'Получател',
    uic: 'ЕИК',
    vat: 'ДДС №',
    address: 'Адрес',
    item: 'Наименование',
    qty: 'Кол.',
    unitPrice: 'Ед. цена',
    lineTotal: 'Стойност',
    subtotal: 'Данъчна основа',
    vatAmount: 'ДДС 20%',
    shipping: 'Доставка',
    total: 'Общо за плащане',
    payment: 'Начин на плащане',
    cod: 'Наложен платеж',
    notVatRegistered: 'Лицето не е регистрирано по ЗДДС',
    printHint: 'За PDF: Ctrl+P → Запази като PDF',
  },
  en: {
    invoice: 'INVOICE',
    proforma: 'Original',
    number: 'Invoice No.',
    date: 'Issue date',
    supplier: 'Supplier',
    recipient: 'Recipient',
    uic: 'UIC',
    vat: 'VAT No.',
    address: 'Address',
    item: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit price',
    lineTotal: 'Amount',
    subtotal: 'Taxable amount',
    vatAmount: 'VAT 20%',
    shipping: 'Shipping',
    total: 'Total due',
    payment: 'Payment method',
    cod: 'Cash on delivery',
    notVatRegistered: 'Not registered under the VAT Act',
    printHint: 'For PDF: Ctrl+P → Save as PDF',
  },
} as const

export function renderInvoiceHtml({ order, settings, locale }: InvoiceData): string {
  const lang = locale === 'en' ? 'en' : 'bg'
  const t = LABELS[lang]

  const isVatRegistered = Boolean(settings.vatNumber)
  const gross = roundMoney(order.total ?? 0)

  // Back-calculate from the VAT-inclusive gross: net = gross / (1 + rate).
  const net = isVatRegistered ? roundMoney(gross / (1 + VAT_RATE)) : gross
  const vat = roundMoney(gross - net)

  const rows = (order.items ?? [])
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.title)}<br><small>${escapeHtml(item.sku)}</small></td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatPrice(item.unitPrice, lang)}</td>
        <td class="num">${formatPrice(item.totalPrice, lang)}</td>
      </tr>`,
    )
    .join('')

  const address = order.shippingAddress
  const recipientAddress = address?.street
    ? `${address.street}, ${address.postalCode ?? ''} ${address.city ?? ''}`
    : (order.officeCode ?? '')

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${t.invoice} ${escapeHtml(order.orderNumber)}</title>
<style>
  /* Self-contained: an invoice must render identically when saved or emailed,
     so it carries no external stylesheet and no web font. */
  body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 32px; font-size: 13px; }
  .sheet { max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
  .meta { color: #475569; margin-bottom: 24px; }
  .parties { display: flex; gap: 32px; margin-bottom: 24px; }
  .party { flex: 1; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; }
  .party h2 { font-size: 12px; text-transform: uppercase; color: #475569; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #475569; }
  .num { text-align: right; white-space: nowrap; }
  small { color: #94a3b8; }
  .totals { margin-left: auto; width: 280px; }
  .totals td { border: none; padding: 4px 8px; }
  .grand td { border-top: 2px solid #0f172a; font-weight: 700; font-size: 15px; padding-top: 8px; }
  .hint { margin-top: 32px; color: #94a3b8; font-size: 11px; }
  @media print { body { padding: 0; } .hint { display: none; } }
</style>
</head>
<body>
<div class="sheet">
  <h1>${t.invoice}</h1>
  <div class="meta">
    <strong>${t.number}:</strong> ${escapeHtml(order.orderNumber)} &nbsp;·&nbsp;
    <strong>${t.date}:</strong> ${new Date(order.createdAt).toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB')}
    &nbsp;·&nbsp; ${t.proforma}
  </div>

  <div class="parties">
    <div class="party">
      <h2>${t.supplier}</h2>
      <strong>${escapeHtml(settings.companyName ?? 'KC Trading')}</strong><br>
      ${settings.registrationNumber ? `${t.uic}: ${escapeHtml(settings.registrationNumber)}<br>` : ''}
      ${settings.vatNumber ? `${t.vat}: ${escapeHtml(settings.vatNumber)}<br>` : ''}
      ${settings.registeredAddress ? `${escapeHtml(settings.registeredAddress)}<br>` : ''}
      ${settings.contactEmail ? escapeHtml(settings.contactEmail) : ''}
    </div>
    <div class="party">
      <h2>${t.recipient}</h2>
      <strong>${escapeHtml(`${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim())}</strong><br>
      ${escapeHtml(order.customer?.email ?? '')}<br>
      ${escapeHtml(order.customer?.phone ?? '')}<br>
      ${escapeHtml(recipientAddress)}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${t.item}</th>
        <th class="num">${t.qty}</th>
        <th class="num">${t.unitPrice}</th>
        <th class="num">${t.lineTotal}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>${t.subtotal}</td><td class="num">${formatPrice(net, lang)}</td></tr>
    ${
      isVatRegistered
        ? `<tr><td>${t.vatAmount}</td><td class="num">${formatPrice(vat, lang)}</td></tr>`
        : `<tr><td colspan="2"><small>${t.notVatRegistered}</small></td></tr>`
    }
    <tr><td>${t.shipping}</td><td class="num">${formatPrice(order.shippingCost ?? 0, lang)}</td></tr>
    <tr class="grand"><td>${t.total}</td><td class="num">${formatPrice(gross, lang)}</td></tr>
  </table>

  <p><strong>${t.payment}:</strong> ${t.cod}</p>
  <p class="hint">${t.printHint}</p>
</div>
</body>
</html>`
}
