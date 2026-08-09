'use client'

import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { sendContact } from '@/app/[locale]/(frontend)/contact/actions'
import { Turnstile } from '@/components/Turnstile'
import { Button } from '@/components/ui/Button'

export function ContactForm() {
  const t = useTranslations('checkout')
  const common = useTranslations('common')
  const errorT = useTranslations('errors')

  const [error, setError] = useState<string | null>(null)
  const [isSent, setIsSent] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  // A Turnstile token is single-use. Bumping this after a rejected submission
  // re-renders the widget, or every retry would fail on the spent token.
  const [turnstileNonce, setTurnstileNonce] = useState(0)

  if (isSent) {
    return (
      <div className="rounded-[--radius-surface] border border-success bg-success-subtle p-6">
        <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
        <p className="mt-2 text-base font-medium text-success-foreground">
          Съобщението е изпратено / Message sent
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none'
  const labelClass = 'mb-1.5 block text-sm font-medium text-body'

  return (
    <form
      className="rounded-[--radius-surface] border border-border-default bg-surface p-6"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)

        const formData = new FormData(event.currentTarget)
        const payload = {
          name: String(formData.get('name') ?? ''),
          email: String(formData.get('email') ?? ''),
          subject: String(formData.get('subject') ?? ''),
          message: String(formData.get('message') ?? ''),
          website: String(formData.get('website') ?? ''),
          turnstileToken: turnstileToken ?? undefined,
        }

        startTransition(async () => {
          const result = await sendContact(payload)
          if (result.success) {
            setIsSent(true)
          } else {
            setError(result.error)
            setTurnstileToken(null)
            setTurnstileNonce((value) => value + 1)
          }
        })
      }}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="c-name" className={labelClass}>
            {t('firstName')} *
          </label>
          <input id="c-name" name="name" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-email" className={labelClass}>
            {t('email')} *
          </label>
          <input id="c-email" name="email" type="email" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-subject" className={labelClass}>
            Тема / Subject *
          </label>
          <input id="c-subject" name="subject" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-message" className={labelClass}>
            Съобщение / Message *
          </label>
          <textarea id="c-message" name="message" rows={5} required className={inputClass} />
        </div>

        {/*
          Honeypot. Hidden from users and assistive technology; bots fill it in
          because they see a text input named "website". Submissions carrying a
          value are accepted and discarded, so the bot never learns it failed.
        */}
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-[--radius-control] bg-danger-subtle px-3 py-2 text-sm text-danger-foreground">
          {errorT(error as 'genericText')}
        </p>
      )}

      <Turnstile onToken={setTurnstileToken} resetSignal={turnstileNonce} />

      <Button type="submit" variant="primary" className="mt-4" disabled={isPending}>
        {isPending ? common('loading') : 'Изпрати / Send'}
      </Button>
    </form>
  )
}
