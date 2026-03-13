import type { Metadata } from 'next'
import { AppFooter } from '@/app/components/AppFooter'
import './globals.css'

export const metadata: Metadata = {
  title: 'Notes Aide',
  description: 'Convert videos into clear, actionable execution plans in seconds.',
  icons: {
    icon: '/notes-aide-tab-v3.png',
    shortcut: '/notes-aide-favicon-v3.ico',
    apple: '/notes-aide-tab-v3.png',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
        <AppFooter />
      </body>
    </html>
  )
}
