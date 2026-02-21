import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Roi Action Extractor App',
  description: 'Convierte videos largos en checklists accionables en segundos.',
  icons: {
    icon: '/roi-logo.png',
    shortcut: '/roi-logo.png',
    apple: '/roi-logo.png',
  },
}

const themeBootstrapScript = `
  (function () {
    try {
      var storedTheme = localStorage.getItem('actionextractor-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var shouldUseDark = storedTheme ? storedTheme === 'dark' : prefersDark;
      document.documentElement.classList.toggle('dark', shouldUseDark);
    } catch (_) {
      document.documentElement.classList.remove('dark');
    }
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
        <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center dark:bg-slate-950 dark:border-slate-800">
          <p className="text-xs text-slate-500">Roi Action Extractor App</p>
        </footer>
      </body>
    </html>
  )
}
