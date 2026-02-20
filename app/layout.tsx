import type { Metadata } from 'next'
import Link from 'next/link'
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
        <header className="border-b border-slate-200 bg-white px-4 py-2 dark:bg-slate-950 dark:border-slate-800">
          <div className="mx-auto max-w-5xl text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Roi Action Extractor App</p>
              <div className="flex items-center gap-4">
                <Link className="text-indigo-600 hover:text-indigo-700" href="/privacy-policy">
                  Política de Privacidad
                </Link>
                <Link className="text-indigo-600 hover:text-indigo-700" href="/terms-of-use">
                  Términos de Uso
                </Link>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Convierte videos de YouTube en planes accionables y permite exportar resultados a Google Docs, Notion,
              Trello y Todoist. Solo solicitamos permisos OAuth para exportar contenido cuando el usuario lo autoriza.
            </p>
          </div>
        </header>
        {children}
        <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center dark:bg-slate-950 dark:border-slate-800">
          <p className="text-xs text-slate-500 mb-2">Roi Action Extractor App</p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <Link className="text-indigo-600 hover:text-indigo-700" href="/privacy-policy">
              Política de Privacidad
            </Link>
            <Link className="text-indigo-600 hover:text-indigo-700" href="/terms-of-use">
              Términos de Uso
            </Link>
          </div>
        </footer>
      </body>
    </html>
  )
}
