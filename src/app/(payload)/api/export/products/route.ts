import config from '@payload-config'
import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'

/**
 * CSV export of the product catalogue. STAFF ONLY.
 *
 * Exists because bulk price and stock updates are the daily reality of running
 * a merchandise shop, and doing them one form at a time in the admin is the
 * fastest way to make an admin panel hated.
 */

/**
 * Escape a CSV field.
 *
 * The leading-character guard is not paranoia: a value starting with =, +, - or
 * @ is interpreted as a FORMULA by Excel and Sheets. A product title beginning
 * with "=" would execute on open — CSV injection, and the reason exported files
 * from web apps have been an attack vector for years. Prefixing with a single
 * quote neutralises it while displaying identically.
 */
function csvField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${guarded.replace(/"/g, '""')}"`
}

export async function GET(): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (!user || user.collection !== 'users') {
    return new Response('Unauthorized', { status: 401 })
  }

  const products = await payload.find({
    collection: 'products',
    limit: 10000,
    depth: 1,
    locale: 'bg',
    overrideAccess: true,
  })

  const header = [
    'sku',
    'title_bg',
    'brand',
    'category',
    'base_price',
    'sale_price',
    'stock',
    'min_order_quantity',
    'unit',
    'is_active',
    'is_featured',
    'slug',
  ]

  const rows = products.docs.map((product) =>
    [
      product.sku,
      product.title,
      typeof product.brand === 'object' ? product.brand?.name : '',
      typeof product.category === 'object' ? product.category?.title : '',
      product.basePrice,
      product.salePrice ?? '',
      product.stock,
      product.minOrderQuantity,
      product.unit,
      product.isActive ? 'yes' : 'no',
      product.isFeatured ? 'yes' : 'no',
      product.slug,
    ]
      .map(csvField)
      .join(','),
  )

  // UTF-8 BOM: without it Excel on Windows renders Cyrillic as mojibake, and
  // the export looks broken to exactly the person who needs it.
  const csv = `﻿${header.map(csvField).join(',')}\n${rows.join('\n')}`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kc-products-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
