import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const isEs = locale.toLowerCase().startsWith('es')

  return {
    title: 'Careers | Notes Aide',
    description: isEs
      ? 'Interés laboral y oportunidades futuras en Notes Aide.'
      : 'Career interest and future opportunities at Notes Aide.',
  }
}

export default async function CareersPage() {
  const locale = await getLocale()
  const isEs = locale.toLowerCase().startsWith('es')

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-10">
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Well Technologies</p>
        <h1 className="mb-6 text-3xl font-bold tracking-tight">{isEs ? 'Carreras' : 'Careers'}</h1>

        <p className="leading-relaxed text-slate-700 dark:text-slate-300">
          {isEs
            ? 'No estamos publicando vacantes abiertas en esta página por ahora, pero sí revisamos perfiles de personas interesadas en producto, ingeniería y operaciones para futuras oportunidades.'
            : 'We are not publishing open roles on this page yet, but we do review profiles from people interested in product, engineering, and operations for future opportunities.'}
        </p>

        <section className="mt-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-500/20 dark:bg-cyan-950/20">
          <h2 className="text-lg font-semibold">{isEs ? 'Cómo aplicar' : 'How to apply'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isEs
              ? 'Envíanos tu perfil, enlaces relevantes y una nota breve sobre el tipo de rol que te interesa.'
              : 'Send us your profile, relevant links, and a short note about the type of role that interests you.'}
          </p>
          <a
            className="mt-4 inline-flex items-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-700"
            href="mailto:support@notesaide.com?subject=Careers%20at%20Notes%20Aide"
          >
            {isEs ? 'Escribir a soporte' : 'Email support'}
          </a>
        </section>

        <div className="mt-8 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          <Link className="text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200" href="/">
            {isEs ? 'Volver al inicio' : 'Back to home'}
          </Link>
          <Link
            className="text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
            href="/about-us"
          >
            {isEs ? 'Sobre nosotros' : 'About us'}
          </Link>
        </div>
      </div>
    </main>
  )
}
