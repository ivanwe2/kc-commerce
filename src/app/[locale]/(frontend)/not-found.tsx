import { getTranslations } from 'next-intl/server'

import { buttonVariants } from '@/components/ui/Button'
import { Link } from '@/i18n/routing'

export default async function NotFound() {
  const t = await getTranslations('errors')
  const common = await getTranslations('common')

  return (
    <main className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-heading">{t('notFoundTitle')}</h1>
      <p className="max-w-prose text-base text-body">{t('notFoundText')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: 'primary' })}>
          {common('backToHome')}
        </Link>
        <Link href="/products" className={buttonVariants({ variant: 'secondary' })}>
          {common('products')}
        </Link>
      </div>
    </main>
  )
}
