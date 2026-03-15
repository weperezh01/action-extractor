'use client'

import Link from 'next/link'
import { ArrowRight, Building2, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { MarketingHeader } from '@/app/components/MarketingHeader'
import { useLang } from '@/app/home/hooks/useLang'

const PAGE_COPY = {
  en: {
    eyebrow: 'Company',
    title: 'We build Notes Aide to move faster from information to execution.',
    intro:
      'Notes Aide is a product by Well Technologies focused on turning videos, documents, and raw notes into structured playbooks, clear decisions, and execution-ready outputs.',
    summaryBody: 'Designed to turn long-form content into actionable structure.',
    primaryCta: 'Open the app',
    secondaryCta: 'Contact support',
    cards: [
      {
        title: 'What we build',
        body: 'An execution layer that turns long-form content into playbooks, decisions, and clear next steps.',
      },
      {
        title: 'Who it is for',
        body: 'Teams and professionals working with dense information who need to turn it into action.',
      },
      {
        title: 'How we work',
        body: 'We design for clarity, speed, and outputs that fit naturally into real workflows.',
      },
    ],
    sectionTitle: 'What matters to us',
    sectionBody:
      'We care about reducing friction between discovering something valuable and turning it into a concrete next step. That means fewer decorative outputs and more formats people can immediately review, edit, share, and execute.',
    principles: [
      'Clarity over noise',
      'Structure over chaos',
      'Action over passive consumption',
    ],
    supportTitle: 'Built by Well Technologies',
    supportBody:
      'If you are evaluating Notes Aide for your team, want to discuss partnerships, or need product help, contact us directly and we will route you to the right next step.',
    supportLink: 'support@notesaide.com',
    contactEyebrow: 'Contact',
  },
  es: {
    eyebrow: 'Compañía',
    title: 'Construimos Notes Aide para pasar más rápido de la información a la ejecución.',
    intro:
      'Notes Aide es un producto de Well Technologies enfocado en convertir videos, documentos y notas en bruto en playbooks estructurados, decisiones claras y salidas listas para ejecutar.',
    summaryBody: 'Diseñado para convertir contenido largo en estructura accionable.',
    primaryCta: 'Abrir la app',
    secondaryCta: 'Contactar soporte',
    cards: [
      {
        title: 'Qué construimos',
        body: 'Una capa de ejecución que convierte contenido largo en playbooks, decisiones y próximos pasos claros.',
      },
      {
        title: 'Para quién es',
        body: 'Para equipos y profesionales que trabajan con información densa y necesitan convertirla en acción.',
      },
      {
        title: 'Cómo trabajamos',
        body: 'Diseñamos para claridad, velocidad y salidas que encajan en flujos de trabajo reales.',
      },
    ],
    sectionTitle: 'Lo que nos importa',
    sectionBody:
      'Nos importa reducir la fricción entre descubrir algo valioso y convertirlo en un siguiente paso concreto. Eso significa menos salidas decorativas y más formatos que una persona pueda revisar, editar, compartir y ejecutar de inmediato.',
    principles: [
      'Claridad sobre ruido',
      'Estructura sobre caos',
      'Acción sobre consumo pasivo',
    ],
    supportTitle: 'Un producto de Well Technologies',
    supportBody:
      'Si estás evaluando Notes Aide para tu equipo, quieres hablar de partnerships o necesitas ayuda con el producto, contáctanos directamente y te llevamos al siguiente paso correcto.',
    supportLink: 'support@notesaide.com',
    contactEyebrow: 'Contacto',
  },
} as const

export function AboutUsPageContent() {
  const { lang, toggle } = useLang()
  const copy = PAGE_COPY[lang]

  return (
    <>
      <MarketingHeader lang={lang} onToggleLang={toggle} basePath="/" />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7_0%,#fff7ed_28%,#f8fafc_60%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,#172554_0%,#020617_48%,#020617_100%)] dark:text-slate-100">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-12 md:px-8 md:py-16">
          <section className="overflow-hidden rounded-[32px] border border-amber-200/70 bg-white/90 shadow-[0_28px_80px_-36px_rgba(120,53,15,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
            <div className="px-6 py-8 md:px-10 md:py-12 lg:px-12 lg:py-14">
              <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
                <div className="lg:col-span-7">
                  <p className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800">
                    <Building2 size={13} />
                    {copy.eyebrow}
                  </p>
                  <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl dark:text-white">
                    {copy.title}
                  </h1>
                  <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 md:text-lg dark:text-slate-300">
                    {copy.intro}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href="/app"
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      {copy.primaryCta}
                      <ArrowRight size={15} />
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {copy.secondaryCta}
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="rounded-[26px] border border-amber-200 bg-gradient-to-br from-amber-100 via-white to-orange-50 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Notes Aide</p>
                    <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                      {copy.summaryBody}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {copy.cards.map((card, index) => {
                  const Icon = index === 0 ? Sparkles : index === 1 ? Users : ShieldCheck
                  return (
                    <article
                      key={card.title}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <Icon size={18} className="text-amber-600 dark:text-amber-300" />
                      <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">{card.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{card.body}</p>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <article className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.sectionTitle}
              </h2>
              <p className="mt-4 text-sm leading-8 text-slate-600 dark:text-slate-300">
                {copy.sectionBody}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {copy.principles.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[28px] border border-cyan-200 bg-cyan-50 p-7 shadow-sm dark:border-cyan-900/50 dark:bg-cyan-950/20">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800 dark:border-cyan-800 dark:bg-slate-950 dark:text-cyan-300">
                <Mail size={13} />
                {copy.contactEyebrow}
              </p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.supportTitle}
              </h2>
              <p className="mt-4 text-sm leading-8 text-slate-700 dark:text-slate-300">
                {copy.supportBody}
              </p>
              <a
                href="mailto:support@notesaide.com?subject=Notes%20Aide%20-%20Company%20Inquiry"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-800"
              >
                {copy.supportLink}
                <ArrowRight size={15} />
              </a>
            </article>
          </section>
        </div>
      </main>
    </>
  )
}
