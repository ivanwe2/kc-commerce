import React from 'react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center">
      <div className="container flex items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="text-lg font-bold text-slate-900">KC Trading</div>
        <nav className="flex items-center gap-4">
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  )
}

export const HeaderRegion: React.FC = () => {
  return <Header />
}
