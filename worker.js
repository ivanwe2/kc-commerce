/**
 * Custom Worker entry.
 *
 * OpenNext compiles the Next app into a worker that exports only `fetch`.
 * Cloudflare Cron Triggers need a `scheduled` handler and Queue consumers need a
 * `queue` handler, so neither could be used against the generated worker
 * directly — which is why scheduling previously lived in GitHub Actions.
 *
 * This wrapper adds those handlers and delegates everything else to OpenNext
 * untouched. `wrangler.jsonc` points `main` here instead of at
 * `.open-next/worker.js`.
 *
 * Plain JavaScript rather than TypeScript on purpose: it imports from
 * `.open-next/`, which does not exist until a build has run. A .ts file would
 * fail `tsc --noEmit` on a clean checkout — including in CI, where nothing has
 * been built yet — for an import that is correct at the only time it matters.
 */

// Resolved by wrangler at build time, after `opennextjs-cloudflare build`.
import openNextWorker from './.open-next/worker.js'

/**
 * Runs a job by invoking the app's own /api/cron route in-process.
 *
 * A synthetic Request through the same worker rather than an outbound fetch:
 * there is no network hop, no DNS, no TLS, and the request never leaves the
 * isolate — so it works identically in local dev and production, and cannot be
 * reached from outside.
 *
 * The route still authenticates. Sharing CRON_SECRET here rather than adding an
 * internal bypass keeps exactly one authorisation path into the jobs, which is
 * the one that gets scrutinised.
 */
async function runSchedule(cron, env, ctx) {
  const request = new Request(`https://cron.internal/api/cron?schedule=${encodeURIComponent(cron)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET ?? ''}`,
      'Content-Type': 'application/json',
    },
  })

  const response = await openNextWorker.fetch(request, env, ctx)
  const body = await response.text()

  // Structured so a failed cron is greppable in `wrangler tail` rather than
  // discovered weeks later by its absence.
  console.log(
    JSON.stringify({
      level: response.ok ? 'info' : 'error',
      msg: 'Scheduled job finished',
      cron,
      status: response.status,
      body: body.slice(0, 500),
    }),
  )

  if (!response.ok) {
    throw new Error(`Scheduled job for "${cron}" returned ${response.status}`)
  }
}

export default {
  ...openNextWorker,

  /**
   * Cron Triggers.
   *
   * `event.cron` is the pattern that fired, matching the strings in
   * wrangler.jsonc, which is also how the job registry is keyed — so adding a
   * schedule means adding it in exactly two places that read identically.
   *
   * waitUntil keeps the isolate alive for the whole job. Without it, returning
   * from `scheduled` would cancel work still in flight.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSchedule(event.cron, env, ctx))
  },

  /**
   * Queue consumer.
   *
   * Present so async work has somewhere to land the moment a queue exists. It
   * is inert until `queues.consumers` is configured in wrangler.jsonc — see the
   * note there — because declaring a consumer for a queue that has not been
   * created fails the deploy.
   *
   * Messages are acked individually: one poison message must not force the
   * whole batch to be retried, which would replay the successful ones too.
   */
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        const request = new Request('https://queue.internal/api/queue', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CRON_SECRET ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message.body),
        })

        const response = await openNextWorker.fetch(request, env, ctx)

        if (response.ok) {
          message.ack()
        } else {
          // Retried with backoff by Cloudflare, then dead-lettered if configured.
          message.retry()
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'Queue message failed',
            id: message.id,
            err: error instanceof Error ? error.message : String(error),
          }),
        )
        message.retry()
      }
    }
  },
}
