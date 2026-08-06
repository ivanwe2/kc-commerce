import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Health check for uptime monitoring and post-deploy verification.
 *
 * It deliberately touches D1 rather than just returning 200: a Worker that
 * boots but cannot reach its database is exactly the failure this endpoint
 * exists to catch, and a static OK would report it as healthy.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const startedAt = Date.now()

  try {
    const { env } = await getCloudflareContext({ async: true })
    await env.D1.prepare('SELECT 1').first()

    return Response.json(
      {
        status: 'ok',
        database: 'ok',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    // The message is logged, not returned: error text can disclose schema and
    // infrastructure detail to anyone who can curl this endpoint.
    console.error(
      JSON.stringify({ level: 'error', msg: 'Health check failed', err: String(error) }),
    )

    return Response.json(
      { status: 'error', database: 'unreachable', timestamp: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
