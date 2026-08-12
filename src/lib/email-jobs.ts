import { formatPrice } from './money'

/**
 * Emails sent by scheduled jobs.
 *
 * Same contract as the rest of the email layer: plain fetch to Resend, and a
 * no-op with a warning when it is not configured, so jobs run harmlessly before
 * the account exists.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'Job email skipped — Resend not configured', subject }))
    return
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`)
}

export async function sendBackInStockNotice(data: {
  email: string
  locale: string
  productTitle: string
  productSlug: string
}): Promise<void> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const isBg = data.locale !== 'en'
  const url = `${base}${isBg ? '' : '/en'}/products/${data.productSlug}`

  await send(
    data.email,
    isBg
      ? `${data.productTitle} е отново в наличност`
      : `${data.productTitle} is back in stock`,
    isBg
      ? `<p><strong>${escapeHtml(data.productTitle)}</strong> отново е в наличност.</p>
         <p><a href="${url}">Вижте продукта</a></p>
         <p style="font-size:12px;color:#94a3b8;">Получавате този имейл, защото поискахте да бъдете уведомени.</p>`
      : `<p><strong>${escapeHtml(data.productTitle)}</strong> is available again.</p>
         <p><a href="${url}">View the product</a></p>
         <p style="font-size:12px;color:#94a3b8;">You are receiving this because you asked to be notified.</p>`,
  )
}

export async function sendLowStockDigest(
  products: { title: string; sku: string; stock: number }[],
): Promise<void> {
  const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL
  if (!adminEmail) return

  const rows = products
    .map(
      (p) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(p.title)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(p.sku)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;${p.stock === 0 ? 'color:#dc2626;' : ''}">${p.stock}</td>
      </tr>`,
    )
    .join('')

  await send(
    adminEmail,
    `[Битодом] ${products.length} products low on stock`,
    `<h2>Low stock</h2>
     <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px;">
       <thead><tr>
         <th style="text-align:left;padding:6px 8px;">Product</th>
         <th style="text-align:left;padding:6px 8px;">SKU</th>
         <th style="text-align:right;padding:6px 8px;">Stock</th>
       </tr></thead>
       <tbody>${rows}</tbody>
     </table>
     <p style="font-size:12px;color:#94a3b8;">Sorted lowest first. Zero means the product is unavailable to customers.</p>`,
  )
}

/** Exported so the digest can format money if a value summary is added later. */
export { formatPrice }
