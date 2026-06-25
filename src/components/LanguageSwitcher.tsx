'use client'

import { usePathname, useRouter } from '@/i18n/routing'

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()

  const locales = [
    { code: 'bg', label: 'BG' },
    { code: 'en', label: 'EN' },
  ]

  const switchLocale = (locale: string) => {
    router.push(pathname, { locale })
  }

  return (
    <div className="flex items-center gap-2">
      {locales.map((loc) => (
        <button
          key={loc.code}
          type="button"
          onClick={() => switchLocale(loc.code)}
          className="text-sm font-medium px-2 py-1 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-100 text-slate-600 hover:text-blue-800"
        >
          {loc.label}
        </button>
      ))}
    </div>
  )
}
