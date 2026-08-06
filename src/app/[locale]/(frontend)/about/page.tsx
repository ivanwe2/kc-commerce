import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { RichText } from '@/components/RichText'
import { findPageBySlug, type StorefrontLocale } from '@/lib/payload'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: t('about') }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('common')
  const page = await findPageBySlug('about', locale as StorefrontLocale)

  return (
    <main className="container-page py-12">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-heading">{page?.title ?? t('about')}</h1>
        <div className="mt-6">
          {page?.content ? (
            <RichText data={page.content} />
          ) : (
            <p className="text-base text-body">
              Съдържанието на тази страница се управлява от административния панел.
              <br />
              This page&apos;s content is managed from the admin panel.
            </p>
          )}
        </div>
      </article>
    </main>
  )
}
