import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const isEs = locale.toLowerCase().startsWith('es')

  return {
    title: isEs ? 'Sobre Nosotros | Notes Aide' : 'About Us | Notes Aide',
    description: isEs
      ? 'Información general sobre Notes Aide y Well Technologies.'
      : 'General information about Notes Aide and Well Technologies.',
  }
}

export default async function AboutUsPage() {
  const locale = await getLocale()
  const isEs = locale.toLowerCase().startsWith('es')

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-10">
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Notes Aide by Well Technologies</p>
        <h1 className="mb-6 text-3xl font-bold tracking-tight">
          {isEs ? 'Sobre Notes Aide' : 'About Notes Aide'}
        </h1>

        <p className="leading-relaxed text-slate-700 dark:text-slate-300">
          {isEs
            ? 'Notes Aide convierte videos, documentos y texto en planes de acción, resúmenes ejecutivos e ideas listas para trabajar. El producto está impulsado por Well Technologies y está diseñado para reducir la fricción entre descubrir información y ejecutar.'
            : 'Notes Aide turns videos, documents, and text into action plans, executive summaries, and ideas that are ready to use. The product is powered by Well Technologies and is built to reduce the friction between discovery and execution.'}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
            <h2 className="text-lg font-semibold">
              {isEs ? 'Qué estamos construyendo' : 'What we are building'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isEs
                ? 'Una capa de ejecución para equipos y profesionales que necesitan convertir contenido largo en decisiones claras, tareas priorizadas e integraciones accionables.'
                : 'An execution layer for teams and professionals who need to turn long-form content into clear decisions, prioritized tasks, and actionable integrations.'}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
            <h2 className="text-lg font-semibold">{isEs ? 'Contacto' : 'Contact'}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isEs
                ? 'Para soporte, partnerships o despliegues de equipo, escríbenos y te responderemos con el mejor siguiente paso.'
                : 'For support, partnerships, or team rollouts, email us and we will reply with the best next step.'}
            </p>
            <a
              className="mt-3 inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
              href="mailto:support@notesaide.com"
            >
              support@notesaide.com
            </a>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          <Link className="text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200" href="/">
            {isEs ? 'Volver al inicio' : 'Back to home'}
          </Link>
          <a
            className="text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
            href="https://welltechnologies.net"
            target="_blank"
            rel="noopener noreferrer"
          >
            Well Technologies
          </a>
        </div>
      </div>
    </main>
  )
}
