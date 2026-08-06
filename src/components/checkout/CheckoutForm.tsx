'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'

import { createOrder } from '@/app/[locale]/(frontend)/checkout/actions'
import { Button } from '@/components/ui/Button'
import { Link, useRouter } from '@/i18n/routing'
import { formatPrice, roundMoney } from '@/lib/money'
import type { ShippingMethod } from '@/lib/shipping'
import type { CheckoutFieldErrors } from '@/lib/validations/checkout'
import { cartSubtotal, lineTotal, lineUnitPrice, useCartStore } from '@/stores/cart'

const SHIPPING_METHODS: { value: ShippingMethod; labelKey: string }[] = [
  { value: 'econt_office', labelKey: 'econtOffice' },
  { value: 'econt_address', labelKey: 'econtAddress' },
  { value: 'speedy_office', labelKey: 'speedyOffice' },
  { value: 'speedy_address', labelKey: 'speedyAddress' },
]

type Rates = Record<ShippingMethod, number> & { freeShippingThreshold: number | null }

export function CheckoutForm({ rates }: { rates: Rates }) {
  const t = useTranslations('checkout')
  const cartT = useTranslations('cart')
  const errorT = useTranslations('errors')
  const locale = useLocale()
  const router = useRouter()

  const items = useCartStore((state) => state.items)
  const hasHydrated = useCartStore((state) => state.hasHydrated)
  const clearCart = useCartStore((state) => state.clearCart)

  const [method, setMethod] = useState<ShippingMethod>('econt_office')
  const [errors, setErrors] = useState<CheckoutFieldErrors>({})
  const [isPending, startTransition] = useTransition()

  const subtotal = cartSubtotal(items)
  const isToOffice = method.endsWith('_office')

  // Display only. The server recomputes shipping from Settings, so a tampered
  // value here changes what the customer sees and nothing they are charged.
  const shippingCost = useMemo(() => {
    const threshold = rates.freeShippingThreshold
    if (threshold && subtotal >= threshold) return 0
    return rates[method]
  }, [rates, method, subtotal])

  const total = roundMoney(subtotal + shippingCost)

  if (hasHydrated && items.length === 0) {
    return (
      <div className="rounded-[--radius-surface] border border-border-default bg-surface p-12 text-center">
        <p className="text-base font-medium text-heading">{cartT('empty')}</p>
        <Link href="/products" className="mt-2 inline-block text-sm text-primary hover:underline">
          {cartT('emptyHint')}
        </Link>
      </div>
    )
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrors({})

    const formData = new FormData(event.currentTarget)

    const payload = {
      firstName: String(formData.get('firstName') ?? ''),
      lastName: String(formData.get('lastName') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      shippingMethod: method,
      officeCode: String(formData.get('officeCode') ?? '') || undefined,
      street: String(formData.get('street') ?? '') || undefined,
      city: String(formData.get('city') ?? '') || undefined,
      postalCode: String(formData.get('postalCode') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '') || undefined,
      acceptedTerms: formData.get('acceptedTerms') === 'on',
      acceptedPrivacy: formData.get('acceptedPrivacy') === 'on',
      acceptedWithdrawal: formData.get('acceptedWithdrawal') === 'on',
      marketingConsent: formData.get('marketingConsent') === 'on',
      // Only ids and quantities cross the wire. There is deliberately no field
      // in which a price could be submitted.
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      locale,
    }

    startTransition(async () => {
      const result = await createOrder(payload)

      if (result.success) {
        clearCart()
        router.push(`/checkout/confirmation?order=${encodeURIComponent(result.orderNumber)}`)
        return
      }

      setErrors(result.errors)
      // Bring the first problem into view rather than leaving the customer to
      // hunt for it on a long form.
      document.querySelector('[data-error="true"]')?.scrollIntoView({ block: 'center' })
    })
  }

  const fieldError = (field: keyof CheckoutFieldErrors) => {
    const key = errors[field]
    if (!key) return null
    return (
      <p data-error="true" className="mt-1 text-xs text-danger">
        {errorT(key as 'fieldRequired')}
      </p>
    )
  }

  const inputClass =
    'w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none'
  const labelClass = 'mb-1.5 block text-sm font-medium text-body'

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-heading">{t('contactInfo')}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className={labelClass}>
                {t('firstName')} *
              </label>
              <input id="firstName" name="firstName" required className={inputClass} />
              {fieldError('firstName')}
            </div>
            <div>
              <label htmlFor="lastName" className={labelClass}>
                {t('lastName')} *
              </label>
              <input id="lastName" name="lastName" required className={inputClass} />
              {fieldError('lastName')}
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>
                {t('email')} *
              </label>
              <input id="email" name="email" type="email" required className={inputClass} />
              {fieldError('email')}
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>
                {t('phone')} *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+359 88 123 4567"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">{t('phoneHint')}</p>
              {fieldError('phone')}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-heading">{t('shippingMethod')}</h2>
          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">{t('shippingMethod')}</legend>
            {SHIPPING_METHODS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[--radius-control] border border-border-default px-3 py-2 hover:bg-surface-alt has-checked:border-primary has-checked:bg-primary-subtle"
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="size-4 text-primary"
                />
                <span className="flex-1 text-sm text-body">{t(option.labelKey as 'econtOffice')}</span>
                <span className="text-sm font-medium text-price">
                  {formatPrice(rates[option.value], locale)}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {isToOffice ? (
              <div className="sm:col-span-2">
                <label htmlFor="officeCode" className={labelClass}>
                  {t('officeCode')} *
                </label>
                <input id="officeCode" name="officeCode" className={inputClass} />
                {fieldError('officeCode')}
              </div>
            ) : (
              <>
                <div className="sm:col-span-2">
                  <label htmlFor="street" className={labelClass}>
                    {t('street')} *
                  </label>
                  <input id="street" name="street" className={inputClass} />
                  {fieldError('street')}
                </div>
                <div>
                  <label htmlFor="city" className={labelClass}>
                    {t('city')} *
                  </label>
                  <input id="city" name="city" className={inputClass} />
                  {fieldError('city')}
                </div>
                <div>
                  <label htmlFor="postalCode" className={labelClass}>
                    {t('postalCode')} *
                  </label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    inputMode="numeric"
                    maxLength={4}
                    className={inputClass}
                  />
                  {fieldError('postalCode')}
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="notes" className={labelClass}>
                {t('deliveryNotes')}
              </label>
              <textarea id="notes" name="notes" rows={2} className={inputClass} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-heading">{t('paymentMethod')}</h2>
          <div className="mt-2 rounded-[--radius-surface] border border-border-default bg-surface p-4">
            <p className="text-sm font-medium text-heading">{t('cashOnDelivery')}</p>
            <p className="mt-1 text-sm text-body">{t('codExplanation')}</p>
          </div>
        </section>

        {/*
          Consent checkboxes. NOT pre-ticked — GDPR and the Consumer Protection
          Act both require an affirmative act, and a pre-ticked box is not one.
          Marketing consent is separate and genuinely optional.
        */}
        <section className="space-y-3">
          {(
            [
              ['acceptedTerms', 'acceptTerms', '/terms'],
              ['acceptedPrivacy', 'acceptPrivacy', '/privacy'],
              ['acceptedWithdrawal', 'acceptWithdrawal', '/withdrawal'],
            ] as const
          ).map(([name, labelKey, href]) => (
            <div key={name}>
              <label className="flex items-start gap-3 text-sm text-body">
                <input
                  type="checkbox"
                  name={name}
                  required
                  className="mt-0.5 size-4 rounded border-border-strong text-primary"
                />
                <span>
                  <Link href={href} target="_blank" className="text-primary hover:underline">
                    {t(labelKey)}
                  </Link>{' '}
                  *
                </span>
              </label>
              {fieldError(name)}
            </div>
          ))}

          <label className="flex items-start gap-3 text-sm text-body">
            <input
              type="checkbox"
              name="marketingConsent"
              className="mt-0.5 size-4 rounded border-border-strong text-primary"
            />
            <span>{t('marketingConsent')}</span>
          </label>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-[--radius-surface] border border-border-default bg-surface p-4 lg:sticky lg:top-20">
        <h2 className="text-lg font-semibold text-heading">{t('orderSummary')}</h2>

        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-2">
              <span className="text-body">
                {item.title}
                <span className="text-muted">
                  {' '}
                  × {item.quantity} @ {formatPrice(lineUnitPrice(item), locale)}
                </span>
              </span>
              <span className="shrink-0 font-medium text-heading">
                {formatPrice(lineTotal(item), locale)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-border-default pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-body">{cartT('subtotal')}</dt>
            <dd className="font-medium text-heading">{formatPrice(subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-body">{cartT('shipping')}</dt>
            <dd className="font-medium text-heading">{formatPrice(shippingCost, locale)}</dd>
          </div>
        </dl>

        <div className="flex justify-between border-t border-border-default pt-3">
          <span className="text-base font-semibold text-heading">{cartT('total')}</span>
          <span className="text-xl font-bold text-price">{formatPrice(total, locale)}</span>
        </div>

        {errors.form && (
          <p data-error="true" className="rounded-[--radius-control] bg-danger-subtle px-3 py-2 text-sm text-danger-foreground">
            {errorT(errors.form as 'orderFailed', { product: errors.items ?? '' })}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" block disabled={isPending}>
          {isPending ? t('placingOrder') : t('placeOrder')}
        </Button>

        {/* EU requirement: the order button must make the payment obligation explicit. */}
        <p className="text-xs text-muted">{t('obligationNotice')}</p>
      </aside>
    </form>
  )
}
