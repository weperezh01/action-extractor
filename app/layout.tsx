import type { Metadata } from 'next'
import { getLocale, getMessages } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'
import './globals.css'

export const metadata: Metadata = {
  title: 'Notes Aide',
  description: 'Convert videos into clear, actionable execution plans in seconds.',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  const isEs = locale.toLowerCase().startsWith('es')

  const footerText = isEs
    ? {
        tagline: 'Convierte contenido en planes de ejecución claros en segundos.',
        product: 'Producto',
        app: 'Aplicación',
        pricing: 'Precios',
        account: 'Cuenta',
        settings: 'Configuración',
        careers: 'Empleos',
        legal: 'Legal',
        privacy: 'Política de Privacidad',
        terms: 'Términos de Uso',
        rights: 'Todos los derechos reservados.',
        poweredBy: 'Impulsado por',
      }
    : {
        tagline: 'Turn content into execution-ready plans in seconds.',
        product: 'Product',
        app: 'App',
        pricing: 'Pricing',
        account: 'Account',
        settings: 'Settings',
        careers: 'Careers',
        legal: 'Legal',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        rights: 'All rights reserved.',
        poweredBy: 'Powered by',
      }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-5xl px-6 py-10">
            {/* Top row: brand + nav links */}
            <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-start sm:justify-between">
              {/* Brand */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/roi-logo-clean.png" alt="Notes Aide logo" className="h-7 w-7 rounded-lg object-contain" />
                  <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    Notes Aide
                  </span>
                </div>
                <p className="max-w-[220px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {footerText.tagline}
                </p>
              </div>

              {/* Nav links */}
              <nav className="flex flex-wrap gap-x-8 gap-y-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{footerText.product}</span>
                  <a href="/app" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">{footerText.app}</a>
                  <a href="/pricing" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">{footerText.pricing}</a>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{footerText.account}</span>
                  <a href="/settings" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">{footerText.settings}</a>
                  <a href="/careers" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">{footerText.careers}</a>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{footerText.legal}</span>
                  <a href="/privacy-policy" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">{footerText.privacy}</a>
                  <a href="/terms-of-use" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">{footerText.terms}</a>
                </div>
              </nav>
            </div>

            {/* Divider */}
            <div className="my-8 border-t border-slate-100 dark:border-slate-800" />

            {/* Bottom row: copyright + powered by */}
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                © {new Date().getFullYear()} Notes Aide. {footerText.rights}
              </p>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {footerText.poweredBy}{' '}
                <a
                  href="https://welltechnologies.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-800 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-slate-100"
                >
                  Well Technologies
                </a>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
