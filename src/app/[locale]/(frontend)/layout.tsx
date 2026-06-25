import './globals.css'
import { Header } from '@/Header/Component'
import { Footer } from '@/Footer/Component'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}
