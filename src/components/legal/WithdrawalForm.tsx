'use client'

import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { submitWithdrawal } from '@/app/[locale]/(frontend)/withdrawal/actions'
import { Turnstile } from '@/components/Turnstile'
import { Button } from '@/components/ui/Button'

/**
 * The electronic withdrawal function required by EU Directive 2023/2673
 * since 19 June 2026.
 *
 * It must be prominent and easy to find — a form buried behind a PDF download
 * does not satisfy the requirement. Hence its placement directly on the
 * withdrawal page rather than behind a link.
 */
export function WithdrawalForm() {
  const t = useTranslations('checkout')
  const errorT = useTranslations('errors')
  const common = useTranslations('common')

  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileNonce, setTurnstileNonce] = useState(0)

  if (isDone) {
    return (
      <div className="mt-8 rounded-[--radius-surface] border border-success bg-success-subtle p-6">
        <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
        <p className="mt-2 text-base font-medium text-success-foreground">
          Заявлението е получено / Request received
        </p>
        <p className="mt-1 text-sm text-success-foreground">
          Изпратихме потвърждение по имейл. / We have emailed you a confirmation.
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none'
  const labelClass = 'mb-1.5 block text-sm font-medium text-body'

  return (
    <form
      className="mt-8 rounded-[--radius-surface] border border-border-default bg-surface p-6"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)

        const formData = new FormData(event.currentTarget)
        const payload = {
          orderNumber: String(formData.get('orderNumber') ?? '').trim(),
          firstName: String(formData.get('firstName') ?? ''),
          lastName: String(formData.get('lastName') ?? ''),
          email: String(formData.get('email') ?? ''),
          reason: String(formData.get('reason') ?? '') || undefined,
          turnstileToken: turnstileToken ?? undefined,
        }

        startTransition(async () => {
          const result = await submitWithdrawal(payload)
          if (result.success) {
            setIsDone(true)
          } else {
            setError(result.error)
            setTurnstileToken(null)
            setTurnstileNonce((value) => value + 1)
          }
        })
      }}
    >
      <h2 className="text-lg font-semibold text-heading">
        Формуляр за отказ / Withdrawal form
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="orderNumber" className={labelClass}>
            Номер на поръчка / Order number *
          </label>
          <input
            id="orderNumber"
            name="orderNumber"
            required
            placeholder="BD-2026-00001"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="w-firstName" className={labelClass}>
            {t('firstName')} *
          </label>
          <input id="w-firstName" name="firstName" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="w-lastName" className={labelClass}>
            {t('lastName')} *
          </label>
          <input id="w-lastName" name="lastName" required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="w-email" className={labelClass}>
            {t('email')} *
          </label>
          <input id="w-email" name="email" type="email" required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="reason" className={labelClass}>
            Причина (по избор) / Reason (optional)
          </label>
          <textarea id="reason" name="reason" rows={3} className={inputClass} />
          {/* Stating this matters: asking for a reason must not imply one is needed. */}
          <p className="mt-1 text-xs text-muted">
            Не сте длъжни да посочвате причина. / You are not required to give a reason.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-[--radius-control] bg-danger-subtle px-3 py-2 text-sm text-danger-foreground">
          {errorT(error as 'fieldRequired')}
        </p>
      )}

      <Turnstile onToken={setTurnstileToken} resetSignal={turnstileNonce} />

      <Button type="submit" variant="primary" className="mt-4" disabled={isPending}>
        {isPending ? common('loading') : 'Изпрати / Submit'}
      </Button>
    </form>
  )
}
