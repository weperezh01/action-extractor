'use client'

import Link from 'next/link'
import { ArrowRight, CreditCard, Handshake, LifeBuoy, Mail, Wrench } from 'lucide-react'
import { MarketingHeader } from '@/app/components/MarketingHeader'
import { useLang } from '@/app/home/hooks/useLang'

const PAGE_COPY = {
  en: {
    eyebrow: 'Contact',
    title: 'Reach the right team without guesswork.',
    intro:
      'Use this page if you need product support, billing help, team rollout guidance, or want to discuss partnerships with Notes Aide and Well Technologies.',
    supportTitle: 'Product support',
    supportBody: 'Questions about the app, bugs, unexpected behavior, or workflow guidance.',
    supportCta: 'Email support',
    billingTitle: 'Billing and plans',
    billingBody: 'Questions about pricing, upgrades, account access, or team setup.',
    billingCta: 'Discuss billing',
    partnershipTitle: 'Partnerships and company',
    partnershipBody: 'Conversations about implementation, partnerships, or strategic collaboration.',
    partnershipCta: 'Contact the company',
    noteTitle: 'What helps us reply faster',
    notes: [
      'Include the page, playbook, or workflow involved.',
      'If something broke, describe what you expected and what happened instead.',
      'If it is a billing issue, include the email tied to the account.',
    ],
    openApp: 'Open the app',
    aboutCompany: 'About the company',
  },
  es: {
    eyebrow: 'Contacto',
    title: 'Llega al equipo correcto sin adivinar.',
    intro:
      'Usa esta página si necesitas soporte del producto, ayuda con billing, guía para despliegue en equipo o si quieres hablar de partnerships con Notes Aide y Well Technologies.',
    supportTitle: 'Soporte del producto',
    supportBody: 'Preguntas sobre la app, bugs, comportamientos inesperados o guía de uso.',
    supportCta: 'Escribir a soporte',
    billingTitle: 'Billing y planes',
    billingBody: 'Preguntas sobre precios, upgrades, acceso a la cuenta o configuración de equipos.',
    billingCta: 'Hablar de billing',
    partnershipTitle: 'Partnerships y compañía',
    partnershipBody: 'Conversaciones sobre implementación, partnerships o colaboración estratégica.',
    partnershipCta: 'Contactar la compañía',
    noteTitle: 'Qué nos ayuda a responder más rápido',
    notes: [
      'Incluye la página, playbook o workflow involucrado.',
      'Si algo falló, describe qué esperabas y qué pasó en su lugar.',
      'Si es un tema de billing, incluye el correo asociado a la cuenta.',
    ],
    openApp: 'Abrir la app',
    aboutCompany: 'Sobre la compañía',
  },
} as const

export function ContactPageContent() {
  const { lang, toggle } = useLang()
  const copy = PAGE_COPY[lang]

  return (
    <>
      <MarketingHeader lang={lang} onToggleLang={toggle} basePath="/" />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#cffafe_0%,#ecfeff_22%,#f8fafc_62%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,#164e63_0%,#020617_44%,#020617_100%)] dark:text-slate-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 md:px-8 md:py-16">
          <section className="overflow-hidden rounded-[32px] border border-cyan-200 bg-white/90 shadow-[0_28px_80px_-36px_rgba(6,182,212,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
            <div className="px-6 py-8 md:px-10 md:py-12">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800">
                <Mail size={13} />
                {copy.eyebrow}
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl dark:text-white">
                {copy.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300">
                {copy.intro}
              </p>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <LifeBuoy size={18} className="text-cyan-700 dark:text-cyan-300" />
              <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.supportTitle}
              </h2>
              <p className="mt-3 text-sm leading-8 text-slate-600 dark:text-slate-300">{copy.supportBody}</p>
              <a
                href="mailto:support@notesaide.com?subject=Notes%20Aide%20Support"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {copy.supportCta}
                <ArrowRight size={15} />
              </a>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CreditCard size={18} className="text-cyan-700 dark:text-cyan-300" />
              <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.billingTitle}
              </h2>
              <p className="mt-3 text-sm leading-8 text-slate-600 dark:text-slate-300">{copy.billingBody}</p>
              <a
                href="mailto:support@notesaide.com?subject=Notes%20Aide%20Billing"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copy.billingCta}
              </a>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <Handshake size={18} className="text-cyan-700 dark:text-cyan-300" />
              <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.partnershipTitle}
              </h2>
              <p className="mt-3 text-sm leading-8 text-slate-600 dark:text-slate-300">{copy.partnershipBody}</p>
              <a
                href="mailto:support@notesaide.com?subject=Notes%20Aide%20Partnership"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copy.partnershipCta}
              </a>
            </article>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <article className="rounded-[28px] border border-cyan-200 bg-cyan-50 p-7 shadow-sm dark:border-cyan-900/50 dark:bg-cyan-950/20">
              <Wrench size={16} className="text-cyan-700 dark:text-cyan-300" />
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                {copy.noteTitle}
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-8 text-slate-700 dark:text-slate-300">
                {copy.notes.map((item) => (
                  <li
                    key={item}
                    className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 dark:border-cyan-900/50 dark:bg-slate-950"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <div className="flex flex-col gap-3 self-start">
              <Link
                href="/app"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {copy.openApp}
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/about-us"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copy.aboutCompany}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
