import { SCHEDULED_JOBS } from '@/lib/jobs'

/**
 * Cron entry point.
 *
 * Cloudflare Cron Triggers invoke a Worker's `scheduled` handler, but OpenNext
 * builds a fetch-only Worker from a Next app — there is no `scheduled` export to
 * attach to. The supported pattern is therefore a Cron Trigger that calls this
 * HTTP route.
 *
 * That makes it publicly reachable, so it MUST authenticate. A cron endpoint
 * anyone can hit is a way to make the shop email its customers on demand.
 * CRON_SECRET is compared in constant time; a plain === leaks the secret one
 * byte at a time through response timing, which is exactly the kind of endpoint
 * someone would bother to measure.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!timingSafeEqual(provided, secret)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const schedule = searchParams.get('schedule')

  const job = schedule ? SCHEDULED_JOBS[schedule] : undefined
  if (!job) {
    return Response.json(
      { error: 'Unknown schedule', known: Object.keys(SCHEDULED_JOBS) },
      { status: 400 },
    )
  }

  const startedAt = Date.now()

  try {
    const result = await job()

    // Logged as structured JSON so a cron failure is greppable in `wrangler tail`
    // rather than something noticed weeks later.
    console.log(
      JSON.stringify({ level: 'info', msg: 'Cron job completed', ...result, ms: Date.now() - startedAt }),
    )

    return Response.json({ ok: true, ...result, ms: Date.now() - startedAt })
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'Cron job failed',
        schedule,
        err: error instanceof Error ? error.message : String(error),
      }),
    )
    return Response.json({ ok: false, error: 'Job failed' }, { status: 500 })
  }
}
