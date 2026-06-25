import React from 'react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-8">
      <div className="container px-4 md:px-6 lg:px-8 text-center text-sm text-slate-400">
        <p>&copy; {new Date().getFullYear()} KC Trading</p>
      </div>
    </footer>
  )
}

export const FooterRegion: React.FC = () => {
  return <Footer />
}
