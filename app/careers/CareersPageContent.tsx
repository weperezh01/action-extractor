'use client'

import Link from 'next/link'
import { ArrowRight, Briefcase, Mail, Rocket, Wrench } from 'lucide-react'
import { MarketingHeader } from '@/app/components/MarketingHeader'
import { useLang } from '@/app/home/hooks/useLang'

const PAGE_COPY = {
  en: {
    eyebrow: 'Careers',
    title: 'We are building a small, sharp team around product, engineering, and execution.',
    intro:
      'There are no public openings listed right now, but we do want to hear from people who care about strong product thinking, high-agency execution, and useful software.',
    primaryCta: 'Email the team',
    secondaryCta: 'Learn about the company',
    areasTitle: 'Where we are most interested',
    areas: [
      'Product and workflow design',
      'Full-stack engineering',
      'AI-assisted operations and tooling',
      'Growth and implementation support',
    ],
    processTitle: 'What to send',
    processBody:
      'Send a short note with your profile, relevant work, links, and the type of role you would want to discuss. Strong signal matters more than a long introduction.',
    notHiringTitle: 'No public hiring board yet',
    notHiringBody:
      'If the timing is not right, we still keep strong profiles on file for future opportunities.',
  },
  es: {
    eyebrow: 'Carreras',
    title: 'Estamos construyendo un equipo pequeño y fuerte alrededor de producto, ingeniería y ejecución.',
    intro:
      'Ahora mismo no tenemos vacantes públicas listadas, pero sí queremos conocer personas que valoren buen criterio de producto, ejecución con autonomía y software realmente útil.',
    primaryCta: 'Escribir al equipo',
    secondaryCta: 'Conocer la compañía',
    areasTitle: 'Dónde tenemos más interés',
    areas: [
      'Diseño de producto y workflows',
      'Ingeniería full-stack',
      'Operaciones y tooling asistido por IA',
      'Growth e implementación con clientes',
    ],
    processTitle: 'Qué enviarnos',
    processBody:
      'Envíanos una nota breve con tu perfil, trabajo relevante, enlaces y el tipo de rol que te gustaría conversar. Nos importa más una señal fuerte que una introducción larga.',
    notHiringTitle: 'Todavía no tenemos bolsa pública de vacantes',
    notHiringBody:
      'Si el momento no es el correcto, igual guardamos perfiles sólidos para oportunidades futuras.',
  },
} as const

export function CareersPageContent() {
  const { lang, toggle } = useLang()
  const copy = PAGE_COPY[lang]

  return (
    <>
      <MarketingHeader lang={lang} onToggleLang={toggle} basePath="/" />
      <main className="min-h-screen bg-[linear-gradient(180deg,#ecfeff_0%,#f8fafc_28%,#ffffff_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#082f49_0%,#020617_36%,#020617_100%)] dark:text-slate-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 md:px-8 md:py-16">
          <section className="overflow-hidden rounded-[32px] border border-cyan-200 bg-white/90 shadow-[0_28px_80px_-36px_rgba(8,145,178,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
            <div className="grid gap-8 px-6 py-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:px-10 md:py-12">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800">
                  <Briefcase size={13} />
                  {copy.eyebrow}
                </p>
                <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl dark:text-white">
                  {copy.title}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
                  {copy.intro}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="mailto:support@notesaide.com?subject=Notes%20Aide%20Careers"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    {copy.primaryCta}
                    <ArrowRight size={15} />
                  </a>
                  <Link
                    href="/about-us"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {copy.secondaryCta}
                  </Link>
                </div>
              </div>

              <div className="grid gap-4">
                <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                  <Rocket size={16} className="text-cyan-700 dark:text-cyan-300" />
                  <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">{copy.areasTitle}</h2>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {copy.areas.map((item) => (
                      <li key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <Wrench size={16} className="text-cyan-700 dark:text-cyan-300" />
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.processTitle}
              </h2>
              <p className="mt-4 text-sm leading-8 text-slate-600 dark:text-slate-300">
                {copy.processBody}
              </p>
            </article>

            <article className="rounded-[28px] border border-cyan-200 bg-cyan-50 p-7 shadow-sm dark:border-cyan-900/50 dark:bg-cyan-950/20">
              <Mail size={16} className="text-cyan-700 dark:text-cyan-300" />
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.notHiringTitle}
              </h2>
              <p className="mt-4 text-sm leading-8 text-slate-700 dark:text-slate-300">
                {copy.notHiringBody}
              </p>
              <a
                href="mailto:support@notesaide.com?subject=Notes%20Aide%20Career%20Profile"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-800"
              >
                support@notesaide.com
                <ArrowRight size={15} />
              </a>
            </article>
          </section>
        </div>
      </main>
    </>
  )
}
