import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { AppFooter } from '@/app/components/AppFooter'
import { LangProvider } from '@/app/home/hooks/useLang'
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

const serviceWorkerCleanupScript = `
  (function () {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.getRegistrations()
      .then(function (registrations) {
        var staleRegistrations = registrations.filter(function (registration) {
          var worker = registration.active || registration.waiting || registration.installing;
          return Boolean(worker && worker.scriptURL && worker.scriptURL.indexOf('/sw.js') !== -1);
        });

        if (staleRegistrations.length === 0) {
          return null;
        }

        return Promise.all(staleRegistrations.map(function (registration) {
          return registration.unregister();
        })).then(function () {
          if (!('caches' in window)) {
            return null;
          }

          return caches.keys().then(function (cacheNames) {
            return Promise.all(cacheNames.map(function (cacheName) {
              return caches.delete(cacheName);
            }));
          });
        });
      })
      .catch(function () {});
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const lang = cookieStore.get('roi-lang')?.value === 'es' ? 'es' : 'en'

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerCleanupScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <LangProvider initialLang={lang}>
          {children}
          <AppFooter lang={lang} />
        </LangProvider>
      </body>
    </html>
  )
}
