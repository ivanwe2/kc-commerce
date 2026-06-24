import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 characters'),
  NEXT_PUBLIC_SERVER_URL: z.string().url('NEXT_PUBLIC_SERVER_URL must be a valid URL'),
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
  PREVIEW_SECRET: z.string().min(1, 'PREVIEW_SECRET is required'),
  RESEND_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['bg', 'en']).default('bg'),
  NEXT_PUBLIC_SUPPORTED_LOCALES: z.string().default('bg,en'),
})

export const env = envSchema.parse(process.env)

export function getEnv(key: keyof z.infer<typeof envSchema>): z.infer<typeof envSchema>[typeof key] {
  return env[key]
}
