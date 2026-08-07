/**
 * Withdrawal and contact notifications.
 *
 * Split from lib/email.ts so the checkout path does not carry code it never
 * uses. Same contract: best-effort, and a no-op with a warning when Resend is
 * not configured.
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
    console.warn(
      JSON.stringify({ level: 'warn', msg: 'Email skipped — Resend not configured', subject }),
    )
    return
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`)
  }
}

export async function sendWithdrawalNotice(data: {
  orderNumber: string
  customerEmail: string
  customerName: string
  reason?: string
  matched: boolean
}): Promise<void> {
  const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL

  // Consumer acknowledgement. Directive 2023/2673 requires confirming receipt
  // of a withdrawal without undue delay.
  await send(
    data.customerEmail,
    `KC Trading — ${data.orderNumber}`,
    `<p>Получихме вашето заявление за отказ от поръчка <strong>${escapeHtml(data.orderNumber)}</strong>.</p>
     <p>We have received your withdrawal request for order <strong>${escapeHtml(data.orderNumber)}</strong>.</p>
     <p>Ще се свържем с вас относно връщането на стоката и възстановяването на сумата.<br>
        We will contact you regarding the return and your refund.</p>`,
  )

  if (!adminEmail) return

  await send(
    adminEmail,
    `[WITHDRAWAL] ${data.orderNumber}${data.matched ? '' : ' — EMAIL MISMATCH'}`,
    `<h2>Withdrawal request</h2>
     <p><strong>Order:</strong> ${escapeHtml(data.orderNumber)}</p>
     <p><strong>Name:</strong> ${escapeHtml(data.customerName)}</p>
     <p><strong>Email:</strong> ${escapeHtml(data.customerEmail)}</p>
     <p><strong>Email matches order:</strong> ${data.matched ? 'yes' : '<strong style="color:#dc2626">NO — verify manually</strong>'}</p>
     <p><strong>Reason:</strong> ${escapeHtml(data.reason || '(none given)')}</p>
     <p>Refund is due within 14 days of this notice.</p>`,
  )
}

export async function sendLowStockAlert(data: {
  title: string
  sku: string
  stock: number
  threshold: number
  outOfStock: boolean
}): Promise<void> {
  const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL
  if (!adminEmail) return

  await send(
    adminEmail,
    `[${data.outOfStock ? 'OUT OF STOCK' : 'LOW STOCK'}] ${data.sku}`,
    `<h2>${data.outOfStock ? 'Out of stock' : 'Low stock'}</h2>
     <p><strong>${escapeHtml(data.title)}</strong> (${escapeHtml(data.sku)})</p>
     <p>Remaining: <strong>${data.stock}</strong> (threshold ${data.threshold})</p>
     ${data.outOfStock ? '<p>This product is now hidden from customers as unavailable.</p>' : ''}`,
  )
}

export async function sendContactMessage(data: {
  name: string
  email: string
  subject: string
  message: string
}): Promise<void> {
  const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL
  if (!adminEmail) {
    console.warn(
      JSON.stringify({ level: 'warn', msg: 'Contact message dropped — no ORDER_NOTIFICATION_EMAIL' }),
    )
    return
  }

  await send(
    adminEmail,
    `[CONTACT] ${data.subject}`,
    `<p><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
     <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
     <hr>
     <p>${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>`,
  )
}
