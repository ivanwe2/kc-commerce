import { formatPrice } from './money'

/**
 * Transactional email via Resend.
 *
 * Deliberately plain `fetch` rather than the `resend` SDK: the API is one POST,
 * the SDK is another dependency inside a 10MB Worker budget, and fetch is
 * native on Workers. Same for the templates — hand-written HTML instead of
 * React Email, which would pull in a renderer for four emails.
 *
 * Every function here is best-effort by contract. Email must NEVER fail an
 * order: the caller catches and logs. If RESEND_API_KEY is absent (as it is
 * until the account is configured), sending is skipped with a warning rather
 * than throwing, so the whole checkout flow is testable without credentials.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

type OrderLine = {
  title: string
  sku: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

type OrderEmailData = {
  orderNumber: string
  email: string
  firstName: string
  locale: string
  lines: OrderLine[]
  subtotal: number
  shippingCost: number
  discount?: number
  couponCode?: string
  total: number
}

type SendArgs = {
  to: string
  subject: string
  html: string
}

async function send({ to, subject, html }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    // Not an error: the store is expected to run without email configured until
    // the Resend account and sending domain exist.
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'Email skipped — RESEND_API_KEY or RESEND_FROM_EMAIL is not set',
        subject,
      }),
    )
    return
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend returned ${response.status}: ${body}`)
  }
}

/** Minimal escaping for values interpolated into email HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const COPY = {
  bg: {
    confirmSubject: (orderNumber: string) => `KC Trading — Потвърждение на поръчка ${orderNumber}`,
    shippedSubject: (orderNumber: string) => `KC Trading — Поръчка ${orderNumber} е изпратена`,
    greeting: (name: string) => `Здравейте, ${name}!`,
    thanks: 'Благодарим за вашата поръчка.',
    orderNumber: 'Номер на поръчка',
    product: 'Продукт',
    quantity: 'Кол.',
    price: 'Цена',
    subtotal: 'Междинна сума',
    shipping: 'Доставка',
    discount: 'Отстъпка',
    total: 'Общо за плащане',
    payment: 'Начин на плащане: наложен платеж (плащате на куриера при получаване).',
    withdrawal:
      'Имате право да се откажете от договора в 14-дневен срок от получаване на стоката, без да посочвате причина.',
    shippedIntro: 'Вашата поръчка е предадена на куриера.',
    tracking: 'Номер за проследяване',
    courier: 'Куриер',
    amountDue: 'Сума за плащане при доставка',
  },
  en: {
    confirmSubject: (orderNumber: string) => `KC Trading — Order confirmation ${orderNumber}`,
    shippedSubject: (orderNumber: string) => `KC Trading — Order ${orderNumber} has shipped`,
    greeting: (name: string) => `Hello ${name},`,
    thanks: 'Thank you for your order.',
    orderNumber: 'Order number',
    product: 'Product',
    quantity: 'Qty',
    price: 'Price',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    total: 'Total due',
    payment: 'Payment method: cash on delivery (you pay the courier on receipt).',
    withdrawal:
      'You have the right to withdraw from this contract within 14 days of receiving the goods, without giving any reason.',
    shippedIntro: 'Your order has been handed to the courier.',
    tracking: 'Tracking number',
    courier: 'Courier',
    amountDue: 'Amount due on delivery',
  },
} as const

function copyFor(locale: string) {
  return locale === 'en' ? COPY.en : COPY.bg
}

function layout(inner: string): string {
  // Inline styles only — email clients discard <style> blocks unpredictably.
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;color:#334155;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">KC Trading</h1>
    ${inner}
  </div>
</body></html>`
}

function lineItemsTable(lines: OrderLine[], locale: string): string {
  const t = copyFor(locale)

  const rows = lines
    .map(
      (line) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          ${escapeHtml(line.title)}<br><span style="color:#94a3b8;font-size:12px;">${escapeHtml(line.sku)}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:center;">${line.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPrice(line.totalPrice, locale)}</td>
      </tr>`,
    )
    .join('')

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
    <thead>
      <tr style="text-align:left;color:#475569;">
        <th style="padding:8px 0;border-bottom:1px solid #e2e8f0;">${t.product}</th>
        <th style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:center;">${t.quantity}</th>
        <th style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${t.price}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

export async function sendOrderConfirmation(data: OrderEmailData): Promise<void> {
  const t = copyFor(data.locale)

  const html = layout(`
    <p style="margin:0 0 8px;">${escapeHtml(t.greeting(data.firstName))}</p>
    <p style="margin:0 0 16px;">${t.thanks}</p>
    <p style="margin:0 0 16px;font-size:16px;"><strong>${t.orderNumber}: ${escapeHtml(data.orderNumber)}</strong></p>
    ${lineItemsTable(data.lines, data.locale)}
    <table style="width:100%;font-size:14px;">
      <tr><td style="padding:4px 0;">${t.subtotal}</td><td style="padding:4px 0;text-align:right;">${formatPrice(data.subtotal, data.locale)}</td></tr>
      ${
        data.discount && data.discount > 0
          ? `<tr><td style="padding:4px 0;">${t.discount}${data.couponCode ? ` (${escapeHtml(data.couponCode)})` : ''}</td><td style="padding:4px 0;text-align:right;">−${formatPrice(data.discount, data.locale)}</td></tr>`
          : ''
      }
      <tr><td style="padding:4px 0;">${t.shipping}</td><td style="padding:4px 0;text-align:right;">${formatPrice(data.shippingCost, data.locale)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#0f172a;">${t.total}</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#0f172a;">${formatPrice(data.total, data.locale)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:14px;">${t.payment}</p>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${t.withdrawal}</p>
  `)

  await send({ to: data.email, subject: t.confirmSubject(data.orderNumber), html })
}

export async function sendOrderShipped(data: {
  orderNumber: string
  email: string
  firstName: string
  locale: string
  trackingNumber: string
  courier: string
  total: number
}): Promise<void> {
  const t = copyFor(data.locale)

  const html = layout(`
    <p style="margin:0 0 8px;">${escapeHtml(t.greeting(data.firstName))}</p>
    <p style="margin:0 0 16px;">${t.shippedIntro}</p>
    <table style="width:100%;font-size:14px;">
      <tr><td style="padding:4px 0;">${t.orderNumber}</td><td style="padding:4px 0;text-align:right;">${escapeHtml(data.orderNumber)}</td></tr>
      <tr><td style="padding:4px 0;">${t.courier}</td><td style="padding:4px 0;text-align:right;">${escapeHtml(data.courier)}</td></tr>
      <tr><td style="padding:4px 0;">${t.tracking}</td><td style="padding:4px 0;text-align:right;"><strong>${escapeHtml(data.trackingNumber)}</strong></td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#0f172a;">${t.amountDue}</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#0f172a;">${formatPrice(data.total, data.locale)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${t.withdrawal}</p>
  `)

  await send({ to: data.email, subject: t.shippedSubject(data.orderNumber), html })
}
