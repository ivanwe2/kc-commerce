import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { formatPrice } from '@/lib/money'

/**
 * Operations summary above the admin dashboard.
 *
 * A server component, so the counts are computed on the server and no data
 * reaches the browser beyond the rendered numbers. Each figure is a `count`
 * query with `limit: 0` rather than a fetch-and-length: the shop only needs the
 * totals, and reading whole documents to count them is metered work on D1 for
 * nothing.
 *
 * What it deliberately shows is the work waiting to be done — orders that need
 * confirming, orders that need shipping, products that need reordering —
 * rather than vanity metrics. The first thing someone opening the admin at 9am
 * wants is a to-do list.
 */

async function getStats() {
  const payload = await getPayload({ config })

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const countOrders = (where: Where) =>
    payload.count({ collection: 'orders', where, overrideAccess: true })

  const [pending, confirmed, processing, shipped, today, lowStock, pendingReviews] =
    await Promise.all([
      countOrders({ status: { equals: 'pending' } }),
      countOrders({ status: { equals: 'confirmed' } }),
      countOrders({ status: { equals: 'processing' } }),
      countOrders({ status: { equals: 'shipped' } }),
      countOrders({ createdAt: { greater_than_equal: startOfDay.toISOString() } }),
      payload.count({
        collection: 'products',
        where: { and: [{ isActive: { equals: true } }, { stock: { less_than_equal: 10 } }] },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'reviews',
        where: { isApproved: { equals: false } },
        overrideAccess: true,
      }),
    ])

  // Revenue over the last 30 days, excluding cancelled and returned orders —
  // money that was refunded is not revenue, and counting it flatters the number
  // in exactly the month you would least want to be misled.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recent = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { createdAt: { greater_than_equal: since.toISOString() } },
        { status: { not_in: ['cancelled', 'returned'] } },
      ],
    },
    limit: 1000,
    depth: 0,
    select: { total: true },
    overrideAccess: true,
  })

  const revenue = recent.docs.reduce((sum, order) => sum + (order.total ?? 0), 0)

  return {
    needsAction: pending.totalDocs + confirmed.totalDocs + processing.totalDocs,
    pending: pending.totalDocs,
    confirmed: confirmed.totalDocs,
    processing: processing.totalDocs,
    shipped: shipped.totalDocs,
    today: today.totalDocs,
    lowStock: lowStock.totalDocs,
    pendingReviews: pendingReviews.totalDocs,
    revenue,
    orderCount: recent.totalDocs,
  }
}

const card: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '4px',
  padding: '12px 16px',
  minWidth: '150px',
  flex: '1 1 150px',
}
const label: React.CSSProperties = { fontSize: '11px', textTransform: 'uppercase', opacity: 0.65 }
const value: React.CSSProperties = { fontSize: '26px', fontWeight: 700, lineHeight: 1.2 }

export async function Dashboard() {
  let stats: Awaited<ReturnType<typeof getStats>>

  try {
    stats = await getStats()
  } catch {
    // The dashboard is a convenience. If a query fails — an unmigrated database
    // on a first deploy, say — the admin must still be usable to fix it.
    return null
  }

  const tiles: { label: string; value: string; href?: string; accent?: boolean }[] = [
    {
      label: 'Needs action',
      value: String(stats.needsAction),
      href: '/admin/collections/orders?where[status][not_in]=shipped,delivered,cancelled,returned',
      accent: stats.needsAction > 0,
    },
    { label: 'Orders today', value: String(stats.today) },
    {
      label: 'To confirm',
      value: String(stats.pending),
      href: '/admin/collections/orders?where[status][equals]=pending',
    },
    {
      label: 'To ship',
      value: String(stats.confirmed + stats.processing),
      href: '/admin/collections/orders?where[status][in]=confirmed,processing',
    },
    { label: 'In transit', value: String(stats.shipped) },
    {
      label: 'Revenue (30 days)',
      value: formatPrice(stats.revenue, 'bg'),
    },
    {
      label: 'Low stock',
      value: String(stats.lowStock),
      href: '/admin/collections/products?where[stock][less_than_equal]=10',
      accent: stats.lowStock > 0,
    },
    {
      label: 'Reviews to moderate',
      value: String(stats.pendingReviews),
      href: '/admin/collections/reviews?where[isApproved][equals]=false',
      accent: stats.pendingReviews > 0,
    },
  ]

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Today</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {tiles.map((tile) => {
          const body = (
            <div
              style={{
                ...card,
                borderColor: tile.accent ? 'var(--theme-warning-500)' : 'var(--theme-elevation-150)',
              }}
            >
              <div style={label}>{tile.label}</div>
              <div style={value}>{tile.value}</div>
            </div>
          )

          return tile.href ? (
            <a
              key={tile.label}
              href={tile.href}
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flex: '1 1 150px' }}
            >
              {body}
            </a>
          ) : (
            <div key={tile.label} style={{ display: 'flex', flex: '1 1 150px' }}>
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
