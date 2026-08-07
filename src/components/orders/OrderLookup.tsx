'use client'

import { Package, Truck } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { lookupOrder, type OrderStatusResult } from '@/app/[locale]/(frontend)/orders/actions'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/money'

/** Courier tracking URLs, so a customer does not have to find them. */
const TRACKING_URLS: Record<string, (n: string) => string> = {
  econt: (n) => `https://www.econt.com/services/track-shipment/${encodeURIComponent(n)}`,
  speedy: (n) => `https://www.speedy.bg/en/track-shipment?shipmentNumber=${encodeURIComponent(n)}`,
}

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const

export function OrderLookup() {
  const t = useTranslations('orders')
  const checkout = useTranslations('checkout')
  const errorT = useTranslations('errors')
  const locale = useLocale()

  const [result, setResult] = useState<OrderStatusResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const inputClass =
    'w-full rounded-[--radius-control] border border-border-default bg-background px-3 py-2 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none'

  const order = result?.success ? result.order : null
  const currentStep = order ? STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]) : -1
  const isCancelled = order?.status === 'cancelled' || order?.status === 'returned'

  return (
    <div>
      <form
        className="rounded-[--radius-surface] border border-border-default bg-surface p-6"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          startTransition(async () => {
            setResult(
              await lookupOrder({
                orderNumber: String(data.get('orderNumber') ?? '').trim(),
                email: String(data.get('email') ?? ''),
              }),
            )
          })
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lookup-order" className="mb-1.5 block text-sm font-medium text-body">
              {t('orderNumber')} *
            </label>
            <input
              id="lookup-order"
              name="orderNumber"
              required
              placeholder="KC-2026-00001"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="lookup-email" className="mb-1.5 block text-sm font-medium text-body">
              {checkout('email')} *
            </label>
            <input id="lookup-email" name="email" type="email" required className={inputClass} />
          </div>
        </div>

        <Button type="submit" variant="primary" className="mt-4" disabled={isPending}>
          {isPending ? t('checking') : t('checkStatus')}
        </Button>
      </form>

      {result && !result.success && (
        <p className="mt-4 rounded-[--radius-control] bg-danger-subtle px-3 py-2 text-sm text-danger-foreground">
          {errorT(result.error as 'orderNotFound')}
        </p>
      )}

      {order && (
        <div className="mt-6 rounded-[--radius-surface] border border-border-default bg-background p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-heading">{order.orderNumber}</h2>
            <span className="text-sm text-muted">
              {new Date(order.createdAt).toLocaleDateString(locale === 'bg' ? 'bg-BG' : 'en-GB')}
            </span>
          </div>

          {/* Progress track. Cancelled and returned orders leave the happy path,
              so they show a plain status instead of a misleading progress bar. */}
          {isCancelled ? (
            <p className="mt-4 inline-flex rounded-full bg-danger-subtle px-3 py-1 text-sm font-medium text-danger-foreground">
              {t(`status_${order.status}` as 'status_cancelled')}
            </p>
          ) : (
            <ol className="mt-6 flex flex-wrap gap-2">
              {STATUS_STEPS.map((step, index) => {
                const done = index <= currentStep
                return (
                  <li
                    key={step}
                    aria-current={index === currentStep ? 'step' : undefined}
                    className={`flex-1 rounded-[--radius-control] px-3 py-2 text-center text-xs font-medium ${
                      done ? 'bg-primary text-primary-foreground' : 'bg-surface-alt text-muted'
                    }`}
                  >
                    {t(`status_${step}` as 'status_pending')}
                  </li>
                )
              })}
            </ol>
          )}

          {order.trackingNumber && order.courierService && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[--radius-control] bg-surface p-3">
              <Truck className="size-5 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-heading">{t('trackingNumber')}</p>
                <p className="text-sm text-body">{order.trackingNumber}</p>
              </div>
              <a
                href={TRACKING_URLS[order.courierService]?.(order.trackingNumber) ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('trackParcel')} →
              </a>
            </div>
          )}

          <ul className="mt-6 space-y-2">
            {order.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-2 text-sm">
                <span className="text-body">
                  {item.title} <span className="text-muted">× {item.quantity}</span>
                </span>
                <span className="font-medium text-heading">
                  {formatPrice(item.totalPrice, locale)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-border-default pt-4">
            <span className="flex items-center gap-2 text-base font-semibold text-heading">
              <Package className="size-4" aria-hidden="true" />
              {t('total')}
            </span>
            <span className="text-lg font-bold text-price">{formatPrice(order.total, locale)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
