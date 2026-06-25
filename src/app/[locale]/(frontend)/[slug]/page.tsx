import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

export default async function SlugPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  notFound()
}
