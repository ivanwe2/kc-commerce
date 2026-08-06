import { Menu, Search } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { CartIcon } from '@/components/cart/CartIcon'
import { MobileNav } from '@/components/layout/MobileNav'
import { Link } from '@/i18n/routing'
import { getSettings, type StorefrontLocale } from '@/lib/payload'

export async function Header({ locale }: { locale: StorefrontLocale }) {
  const t = await getTranslations('common')
  const nav = await getTranslations('nav')
  const settings = await getSettings(locale)

  const links = [
    { href: '/products', label: t('products') },
    { href: '/categories', label: t('categories') },
    { href: '/about', label: t('about') },
    { href: '/contact', label: t('contact') },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-border-default bg-background">
      <div className="container-page flex h-[--header-height] items-center gap-4">
        <MobileNav links={links} label={nav('openMenu')} closeLabel={nav('closeMenu')}>
          <Menu className="size-5" aria-hidden="true" />
        </MobileNav>

        <Link href="/" className="text-lg font-bold text-heading">
          {settings.siteName ?? 'KC Trading'}
        </Link>

        <nav aria-label="Main" className="hidden md:flex md:items-center md:gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-secondary transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/products"
            aria-label={t('search')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[--radius-control] text-secondary transition-colors hover:bg-surface-alt hover:text-primary"
          >
            <Search className="size-5" aria-hidden="true" />
          </Link>

          <CartIcon />

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
