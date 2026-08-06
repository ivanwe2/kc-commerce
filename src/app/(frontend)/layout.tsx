import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'

import '@/styles/globals.css'

// Self-hosted and subset by next/font — no external request, no layout shift.
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'KC Trading',
    template: '%s | KC Trading',
  },
  description: 'Качествени стоки на едро и дребно.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
