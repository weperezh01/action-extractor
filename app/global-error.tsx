'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ActionExtractor] global error boundary:', error)
  }, [error])

  return (
    <html lang="es">
      <body className="antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <main className="min-h-screen px-4 py-16 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-lg shadow-rose-100/40 dark:border-rose-900/70 dark:bg-slate-900 dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
              Error inesperado
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">La app encontró un problema</h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Ya registramos este error para revisarlo en producción. Puedes intentar nuevamente.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Reintentar
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
