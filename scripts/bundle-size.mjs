import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Report the deployable Worker size and fail before it becomes a deploy blocker.
 *
 * Cloudflare enforces 10 MB gzipped on the Paid plan, and it enforces it at
 * deploy time — so discovering an overage during a release is discovering it at
 * the worst possible moment. This runs in CI instead.
 *
 * `wrangler deploy --dry-run` is the measurement, rather than sizing files on
 * disk, because it is the only number that matches what Cloudflare actually
 * receives: wrangler bundles and tree-shakes before uploading. The two obvious
 * alternatives are both wrong in opposite directions.
 *
 *   - `.open-next/worker.js` is a ~2 KB entry stub that imports the real code.
 *     Sizing it reports 0.00 MB and would never fail, however large the Worker
 *     got. This script exists because that is what the npm script used to do.
 *   - Concatenating every .js under .open-next/server-functions and gzipping it
 *     over-reports substantially (~6.8 MB against a real 4.3 MB), because it
 *     counts code wrangler discards. Safe, but it can fail the gate on a Worker
 *     that would have deployed fine.
 *
 * Requires `.open-next` to already exist — run the OpenNext build first.
 * Needs no Cloudflare credentials: --dry-run never contacts the API.
 */

const LIMIT_MB = 10
// Fail below the real limit so there is room to react before a deploy is blocked.
const WARN_MB = 9

const outDir = mkdtempSync(join(tmpdir(), 'worker-size-'))

try {
  const output = execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'deploy', '--dry-run', `--outdir=${outDir}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )

  // "Total Upload: 20837.76 KiB / gzip: 4427.78 KiB"
  const match = output.match(/gzip:\s*([\d.]+)\s*KiB/)

  if (!match) {
    console.error('Could not find the gzip size in wrangler output.')
    console.error('This usually means the wrangler output format changed.\n')
    console.error(output)
    process.exit(1)
  }

  const mb = Number(match[1]) / 1024
  // eslint-disable-next-line no-console -- CLI script; the number is the point.
  console.log(`Worker bundle: ${mb.toFixed(2)} MB gzipped (Cloudflare limit: ${LIMIT_MB} MB)`)

  if (mb > WARN_MB) {
    // GitHub Actions renders ::error:: as an annotation; harmless locally.
    console.error(
      `::error::Bundle is ${mb.toFixed(2)} MB, past the ${WARN_MB} MB warning threshold and approaching Cloudflare's ${LIMIT_MB} MB hard limit.`,
    )
    process.exit(1)
  }
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
