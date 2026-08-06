import { z } from 'zod'

/**
 * Typed access to configuration. Never read `process.env` anywhere else.
 *
 * What is NOT modelled here: D1 and R2. Those are Worker *bindings*, not
 * environment variables — they arrive on the Cloudflare context, and there is
 * no connection string or token for them anywhere in this project.
 */
const envSchema = z.object({
  PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 characters'),
  NEXT_PUBLIC_SITE_URL: z.url('NEXT_PUBLIC_SITE_URL must be an absolute URL'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['bg', 'en']).default('bg'),
  NEXT_PUBLIC_SUPPORTED_LOCALES: z.string().default('bg,en'),
  NEXT_PUBLIC_CF_IMAGES: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.email().optional(),
  ORDER_NOTIFICATION_EMAIL: z.email().optional(),
  CRON_SECRET: z.string().optional(),
  PAYLOAD_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

/**
 * Validation is lazy on purpose.
 *
 * A top-level `envSchema.parse(process.env)` runs during Worker module
 * evaluation. If anything is missing, *every* route dies — including /admin,
 * where you would go to fix it — with an opaque error and no useful stack.
 * Deferring to first use means a misconfiguration surfaces at the request that
 * actually needed the value, naming the variable.
 */
export function getEnv(): Env {
  if (cached) return cached

  const parsed = envSchema.safeParse({
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_SUPPORTED_LOCALES: process.env.NEXT_PUBLIC_SUPPORTED_LOCALES,
    NEXT_PUBLIC_CF_IMAGES: process.env.NEXT_PUBLIC_CF_IMAGES,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    ORDER_NOTIFICATION_EMAIL: process.env.ORDER_NOTIFICATION_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
    PAYLOAD_LOG_LEVEL: process.env.PAYLOAD_LOG_LEVEL,
  })

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Invalid environment configuration:\n${problems}\n\n` +
        `Local development reads secrets from .dev.vars (see .dev.vars.example).\n` +
        `Deployed environments read them from \`wrangler secret put <NAME>\`.`,
    )
  }

  cached = parsed.data
  return cached
}

/** Locales the storefront serves, derived from configuration rather than duplicated. */
export function getSupportedLocales(): string[] {
  return getEnv()
    .NEXT_PUBLIC_SUPPORTED_LOCALES.split(',')
    .map((locale) => locale.trim())
    .filter(Boolean)
}
