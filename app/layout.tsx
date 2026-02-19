import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ActionExtractor',
  description: 'Convierte videos largos en checklists accionables en segundos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  )
}
