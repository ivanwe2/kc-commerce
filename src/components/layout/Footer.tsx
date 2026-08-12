import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/routing'
import { getSettings, type StorefrontLocale } from '@/lib/payload'

/**
 * Footer.
 *
 * The company block is a LEGAL REQUIREMENT, not a design choice: the Bulgarian
 * Electronic Commerce Act requires trader identity — name, UIC/Bulstat,
 * registered address, contact details — to be accessible from every page. That
 * is why it renders from the Settings global on every route, and why missing
 * values show a visible warning to signed-out visitors' detriment rather than
 * failing silently.
 */
export async function Footer({ locale }: { locale: StorefrontLocale }) {
  const t = await getTranslations('common')
  const legal = await getTranslations('legal')
  const orders = await getTranslations('orders')
  const settings = await getSettings(locale)

  const company = {
    name: settings.companyName,
    uic: settings.registrationNumber,
    vat: settings.vatNumber,
    address: settings.registeredAddress,
    register: settings.tradeRegisterInfo,
  }

  const legalLinks = [
    { href: '/terms', label: legal('terms') },
    { href: '/privacy', label: legal('privacy') },
    { href: '/cookies', label: legal('cookies') },
    { href: '/withdrawal', label: legal('withdrawal') },
  ]

  return (
    <footer className="mt-auto border-t border-border-default bg-surface">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="text-sm font-semibold text-heading">{settings.siteName ?? 'Битодом'}</h2>
          <p className="mt-2 text-sm text-body">{t('searchPlaceholder')}</p>
        </div>

        <nav aria-label="Shop">
          <h2 className="text-sm font-semibold text-heading">{t('products')}</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/products" className="text-sm text-body hover:text-primary">
                {t('products')}
              </Link>
            </li>
            <li>
              <Link href="/categories" className="text-sm text-body hover:text-primary">
                {t('categories')}
              </Link>
            </li>
            <li>
              <Link href="/orders" className="text-sm text-body hover:text-primary">
                {orders('trackOrder')}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-sm text-body hover:text-primary">
                {t('contact')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="text-sm font-semibold text-heading">{legal('terms')}</h2>
          <ul className="mt-2 space-y-1">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-body hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-heading">{legal('companyInfo')}</h2>
          <address className="mt-2 space-y-1 text-sm text-body not-italic">
            {company.name && <div>{company.name}</div>}
            {company.uic && (
              <div>
                {legal('uic')}: {company.uic}
              </div>
            )}
            {company.vat && (
              <div>
                {legal('vat')}: {company.vat}
              </div>
            )}
            {company.address && <div className="whitespace-pre-line">{company.address}</div>}
            {company.register && <div>{company.register}</div>}
            {settings.contactEmail && (
              <div>
                <a href={`mailto:${settings.contactEmail}`} className="hover:text-primary">
                  {settings.contactEmail}
                </a>
              </div>
            )}
            {settings.contactPhone && (
              <div>
                <a href={`tel:${settings.contactPhone}`} className="hover:text-primary">
                  {settings.contactPhone}
                </a>
              </div>
            )}
          </address>
        </div>
      </div>

      <div className="border-t border-border-default">
        <div className="container-page flex flex-col gap-2 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {company.name ?? 'Битодом'}
          </p>
          <p>{t('checkout')}: Наложен платеж / Cash on Delivery</p>
        </div>
      </div>
    </footer>
  )
}
