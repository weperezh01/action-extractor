'use client'

import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Brain,
  CheckCircle,
  Download,
  FileText,
  Lightbulb,
  Link2,
  ListChecks,
  Moon,
  PlayCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react'
import { HeroWorkflowPreview } from '@/app/home/components/landing/HeroWorkflowPreview'
import { LandingPricingTable } from '@/app/home/components/landing/LandingPricingTable'
import { UseCasesTabs } from '@/app/home/components/landing/UseCasesTabs'
import { ViewsExplorer } from '@/app/home/components/landing/ViewsExplorer'
import { NotesAideLogo } from '@/app/components/NotesAideLogo'
import { useLang } from '@/app/home/hooks/useLang'
import { applyTheme, getThemeStorageKey, resolveInitialTheme } from '@/app/home/lib/utils'
import { t } from '@/app/home/lib/i18n'
import type { Theme } from '@/app/home/lib/types'
import { GuestExtractorSection } from '@/app/home/components/GuestExtractorSection'

const containerClass = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'
const sectionClass = 'py-16 md:py-24'
const viewportSectionClass =
  'flex min-h-[calc(100svh-4.5rem)] scroll-mt-24 flex-col justify-center py-14 md:py-16 lg:py-20'
const cardBaseClass =
  'rounded-2xl border border-zinc-200/80 bg-white/90 shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)] backdrop-blur transition-all duration-200 dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-black/30'
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-[0_18px_44px_-18px_rgba(6,182,212,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-700 hover:shadow-[0_20px_52px_-16px_rgba(6,182,212,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950'
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-offset-zinc-950'
const heroPrimaryButtonClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(6,182,212,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-700 hover:shadow-[0_18px_44px_-18px_rgba(6,182,212,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950'
const heroSecondaryButtonClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-offset-zinc-950'
const iconShellClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/85 dark:border-white/10 dark:bg-zinc-900'
const chipClass =
  'inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200'

type SectionHeaderProps = {
  kicker?: string
  title: string
  description?: string
  align?: 'left' | 'center'
}

function SectionHeader({ kicker, title, description, align = 'center' }: SectionHeaderProps) {
  const isCentered = align === 'center'

  return (
    <div className={isCentered ? 'text-center' : 'text-left'}>
      {kicker ? (
        <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-900/20 dark:text-cyan-300">
          {kicker}
        </p>
      ) : null}
      <h2 className={`mt-4 text-3xl font-black tracking-tight text-zinc-900 dark:text-white md:text-4xl ${isCentered ? '' : 'max-w-xl'}`}>
        {title}
      </h2>
      {description ? (
        <p className={`mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-300 ${isCentered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>
          {description}
        </p>
      ) : null}
    </div>
  )
}

function StatPill({ value, label }: { value: string; label: string }) {
  const isLongValue = value.length > 3

  return (
    <div className="flex min-h-[124px] h-full flex-col justify-between rounded-[22px] border border-zinc-200/70 bg-white px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-black/20">
      <p
        className={`leading-none tracking-[-0.03em] text-zinc-900 dark:text-white ${
          isLongValue
            ? 'text-[18px] font-black xl:text-[20px]'
            : 'text-[20px] font-black xl:text-[22px]'
        }`}
      >
        {value}
      </p>
      <p className="mt-3 max-w-[14ch] text-[13px] leading-[1.35] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
    </div>
  )
}

function IntegrationChip({ children }: { children: ReactNode }) {
  return (
    <li className={chipClass}>
      <CheckCircle size={14} className="text-emerald-500" aria-hidden="true" />
      {children}
    </li>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className={`${cardBaseClass} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 md:text-base">
          {question}
        </span>
        <span className="text-lg font-semibold text-zinc-400 transition-transform duration-200 group-open:rotate-45 dark:text-zinc-500">
          +
        </span>
      </summary>
      <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{answer}</p>
    </details>
  )
}

export default function LandingPage() {
  const { lang, toggle: toggleLang } = useLang()
  const [theme, setTheme] = useState<Theme>('light')
  const themeStorageKey = getThemeStorageKey()

  useEffect(() => {
    const initial = resolveInitialTheme()
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try {
      localStorage.setItem(themeStorageKey, next)
    } catch {
      // noop
    }
  }

  const steps = [
    {
      num: '01',
      icon: <Link2 size={20} />,
      title: t(lang, 'landing.how.step1.title'),
      desc: t(lang, 'landing.how.step1.desc'),
      accent: 'from-sky-500/20 to-cyan-500/10 text-sky-600 dark:text-sky-300',
    },
    {
      num: '02',
      icon: <Brain size={20} />,
      title: t(lang, 'landing.how.step2.title'),
      desc: t(lang, 'landing.how.step2.desc'),
      accent: 'from-emerald-500/20 to-lime-500/10 text-emerald-600 dark:text-emerald-300',
    },
    {
      num: '03',
      icon: <Download size={20} />,
      title: t(lang, 'landing.how.step3.title'),
      desc: t(lang, 'landing.how.step3.desc'),
      accent: 'from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-300',
    },
  ]

  const modes = [
    {
      icon: <ListChecks size={18} />,
      title: t(lang, 'landing.mode1.title'),
      desc: t(lang, 'landing.mode1.desc'),
      iconTone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
      hoverTone: 'hover:border-sky-300 dark:hover:border-sky-500/40',
    },
    {
      icon: <FileText size={18} />,
      title: t(lang, 'landing.mode2.title'),
      desc: t(lang, 'landing.mode2.desc'),
      iconTone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
      hoverTone: 'hover:border-cyan-300 dark:hover:border-cyan-500/40',
    },
    {
      icon: <Lightbulb size={18} />,
      title: t(lang, 'landing.mode3.title'),
      desc: t(lang, 'landing.mode3.desc'),
      iconTone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      hoverTone: 'hover:border-emerald-300 dark:hover:border-emerald-500/40',
    },
    {
      icon: <Quote size={18} />,
      title: t(lang, 'landing.mode4.title'),
      desc: t(lang, 'landing.mode4.desc'),
      iconTone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      hoverTone: 'hover:border-amber-300 dark:hover:border-amber-500/40',
    },
  ]

  const sectionLinks =
    lang === 'es'
      ? [
          { href: '#how-it-works', label: 'Cómo funciona' },
          { href: '#extraction-modes', label: 'Formatos' },
          { href: '#views', label: 'Vistas' },
          { href: '#use-cases', label: 'Casos de uso' },
          { href: '#integrations', label: 'Integraciones' },
          { href: '#pricing', label: 'Pricing' },
          { href: '#faq', label: 'FAQ' },
        ]
      : [
          { href: '#how-it-works', label: 'How it works' },
          { href: '#extraction-modes', label: 'Formats' },
          { href: '#views', label: 'Views' },
          { href: '#use-cases', label: 'Use cases' },
          { href: '#integrations', label: 'Integrations' },
          { href: '#pricing', label: 'Pricing' },
          { href: '#faq', label: 'FAQ' },
        ]

  const trustTools = ['Notion', 'Trello', 'Todoist', 'Google Docs']
  const heroStats = [
    { value: t(lang, 'hero.stat1.value'), label: t(lang, 'hero.stat1.label') },
    { value: t(lang, 'hero.stat2.value'), label: t(lang, 'hero.stat2.label') },
    { value: t(lang, 'hero.stat3.value'), label: t(lang, 'hero.stat3.label') },
    { value: t(lang, 'hero.stat4.value'), label: t(lang, 'hero.stat4.label') },
  ]

  const faqItems =
    lang === 'es'
      ? [
          {
            question: '¿Qué tipos de contenido puedo analizar?',
            answer:
              'Puedes pegar enlaces de YouTube y páginas web, subir PDF y documentos Word, o escribir texto plano.',
          },
          {
            question: '¿Qué obtengo como resultado?',
            answer:
              'Puedes elegir entre Plan de Acción, Resumen Ejecutivo, Ideas de Negocio o Frases Clave.',
          },
          {
            question: '¿Puedo exportar el resultado?',
            answer:
              'Sí. Puedes exportar a Notion, Trello, Todoist y Google Docs, o copiar en Markdown.',
          },
          {
            question: '¿Necesito tarjeta para empezar?',
            answer: 'No. Puedes crear una cuenta gratuita y empezar sin tarjeta de crédito.',
          },
          {
            question: '¿Mis datos son privados?',
            answer:
              'Sí. Tu contenido se procesa para generar resultados y mantener tu historial según tu configuración.',
          },
          {
            question: '¿Funciona en español e inglés?',
            answer:
              'Sí. Puedes trabajar en ambos idiomas y cambiar la interfaz con el selector de idioma.',
          },
        ]
      : [
          {
            question: 'What type of content can I analyze?',
            answer:
              'You can paste YouTube and web links, upload PDF and Word documents, or add plain text.',
          },
          {
            question: 'What outputs do I get?',
            answer:
              'You can choose Action Plan, Executive Summary, Business Ideas, or Key Quotes.',
          },
          {
            question: 'Can I export the result?',
            answer:
              'Yes. Export to Notion, Trello, Todoist, and Google Docs, or copy the output as Markdown.',
          },
          {
            question: 'Do I need a credit card to start?',
            answer: 'No. You can create a free account and start immediately without a credit card.',
          },
          {
            question: 'Is my data private?',
            answer:
              'Yes. Your content is processed to generate output and keep your history based on your settings.',
          },
          {
            question: 'Does it support both English and Spanish?',
            answer:
              'Yes. You can work in both languages and switch the interface using the language toggle.',
          },
        ]

  const smoothScrollToSection = (
    targetId: string,
    { duration = 1200, extraOffset = 16 }: { duration?: number; extraOffset?: number } = {},
  ) => {
    const target = document.getElementById(targetId)
    if (!target) return

    const start = window.scrollY
    const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 0
    const end = target.getBoundingClientRect().top + window.scrollY - navHeight - extraOffset
    const startTime = performance.now()
    const ease = (n: number) => (n < 0.5 ? 2 * n * n : -1 + (4 - 2 * n) * n)

    const step = (now: number) => {
      const elapsed = Math.min((now - startTime) / duration, 1)
      window.scrollTo(0, start + (end - start) * ease(elapsed))
      if (elapsed < 1) {
        requestAnimationFrame(step)
        return
      }

      window.history.replaceState(null, '', `#${targetId}`)
    }

    requestAnimationFrame(step)
  }

  const handleNavAnchorClick = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      !href.startsWith('#') ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }

    event.preventDefault()
    smoothScrollToSection(href.slice(1), { duration: 1250, extraOffset: 18 })
  }

  const scrollToGuest = () => {
    smoothScrollToSection('guest-extractor', { duration: 1050, extraOffset: 18 })
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-slate-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,0.2),transparent_38%),radial-gradient(circle_at_80%_18%,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.14),transparent_38%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(8,145,178,0.22),transparent_38%),radial-gradient(circle_at_80%_18%,rgba(5,150,105,0.2),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(217,119,6,0.16),transparent_38%)]" />
        <div className="absolute left-1/2 top-[-5.5rem] h-72 w-[35rem] -translate-x-1/2 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-600/20" />
        <div className="absolute right-[-7rem] top-[20rem] h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-600/15" />
        <div className="absolute bottom-[6rem] left-[-8rem] h-80 w-80 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-600/15" />
      </div>

      <nav className="sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/75">
        <div className={`${containerClass} flex items-center justify-between py-3`}>
          <div className="flex items-center">
            <NotesAideLogo
              className="h-10 w-[172px] text-zinc-900 sm:h-11 sm:w-[210px] md:h-12 md:w-[244px] dark:text-zinc-100"
              title="Notes Aide"
            />
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden items-center gap-5 text-xs font-semibold text-zinc-500 lg:flex dark:text-zinc-400">
              {sectionLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleNavAnchorClick(event, item.href)}
                  className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="hidden items-center gap-4 text-xs font-medium text-zinc-500 md:flex lg:hidden dark:text-zinc-400">
              <Link className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" href="/privacy-policy">
                {t(lang, 'nav.privacy')}
              </Link>
              <Link className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" href="/terms-of-use">
                {t(lang, 'nav.terms')}
              </Link>
            </div>

            <button
              onClick={toggleLang}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
            >
              {t(lang, 'nav.langToggle')}
            </button>

            <button
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <Link
              href="/app?mode=login"
              className="hidden text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 md:inline"
            >
              {t(lang, 'nav.signin')}
            </Link>

            <Link
              href="/app?mode=register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-950"
            >
              {t(lang, 'landing.hero.cta')}
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative flex min-h-[calc(100svh-4.5rem)] items-center py-10 md:py-12 lg:py-16">
          <div className={`${containerClass} grid w-full gap-10 lg:grid-cols-[minmax(0,0.97fr)_minmax(0,1.03fr)] lg:gap-8 lg:items-stretch xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]`}>
            <div className="lg:flex lg:flex-col lg:justify-center">
              <div className="flex w-full flex-col items-start justify-center lg:max-w-[620px] xl:max-w-[680px] 2xl:max-w-[720px]">
                <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-[0_12px_28px_-24px_rgba(8,145,178,0.45)] dark:border-cyan-500/30 dark:bg-cyan-900/20 dark:text-cyan-300 xl:mb-5">
                  <Sparkles size={12} />
                  {t(lang, 'landing.hero.badge')}
                </span>

                <h1
                  className="max-w-[520px] self-center text-center text-[44px] font-black leading-[0.95] tracking-[-0.04em] text-zinc-900 dark:text-white sm:text-[56px] md:text-[60px] xl:max-w-[560px] xl:text-[68px] 2xl:max-w-[600px] 2xl:text-[72px]"
                  style={{ textWrap: 'balance' }}
                >
                  {t(lang, 'landing.hero.headline1')}{' '}
                  <span className="bg-gradient-to-r from-cyan-600 via-emerald-500 to-amber-500 bg-clip-text text-transparent">
                    {t(lang, 'landing.hero.headline2')}
                  </span>
                </h1>

                <p className="mt-5 max-w-[560px] text-[17px] leading-[1.72] tracking-[-0.01em] text-zinc-600 dark:text-zinc-300 xl:mt-6 xl:max-w-[590px] xl:text-[18px] xl:leading-[1.75] 2xl:max-w-[620px]">
                  {t(lang, 'landing.hero.sub')}
                </p>

                <div className="mt-7 flex self-center flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center xl:gap-4">
                  <Link href="/app?mode=register" className={heroPrimaryButtonClass}>
                    {t(lang, 'landing.hero.cta')}
                    <ArrowRight size={16} />
                  </Link>

                  <button type="button" onClick={scrollToGuest} className={heroSecondaryButtonClass}>
                    <PlayCircle size={16} />
                    {lang === 'es' ? 'Ver ejemplo' : 'See example'}
                  </button>
                </div>

                <p className="mt-4 self-center text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {t(lang, 'landing.hero.signin')}{' '}
                  <Link
                    href="/app?mode=login"
                    className="font-medium text-cyan-700 underline-offset-4 hover:text-cyan-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:text-cyan-300 dark:hover:text-cyan-200 dark:focus-visible:ring-offset-zinc-950"
                  >
                    {t(lang, 'landing.hero.signinLink')}
                  </Link>
                </p>

                <div className="mt-5 flex max-w-[38rem] self-center flex-wrap items-center justify-center gap-2.5">
                  {trustTools.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-600 shadow-[0_1px_0_rgba(15,23,42,0.02)] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      <CheckCircle size={12} className="text-emerald-500" aria-hidden="true" />
                      {tool}
                    </span>
                  ))}
                </div>

                <p className="mt-3 inline-flex w-fit self-center items-center justify-center gap-2 rounded-full border border-zinc-200/70 bg-white/80 px-3.5 py-1.5 text-center text-xs font-medium text-zinc-500 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400">
                  <ShieldCheck size={13} className="text-cyan-600 dark:text-cyan-300" />
                  {lang === 'es'
                    ? 'Privacidad y control de contenido para tu equipo.'
                    : 'Privacy-first content handling for teams.'}
                </p>

                <div className="mt-8 grid w-full max-w-[24rem] self-center grid-cols-2 gap-3 sm:max-w-[28rem] xl:max-w-none xl:self-auto xl:grid-cols-4 xl:gap-4">
                  {heroStats.map((stat) => (
                    <StatPill key={stat.label} value={stat.value} label={stat.label} />
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:flex lg:h-full lg:w-full">
              <HeroWorkflowPreview lang={lang} mode="main" />
            </div>
          </div>
        </section>

        <section
          id="actionable-outputs"
          className={`${viewportSectionClass} border-t border-zinc-200/70 dark:border-white/10`}
        >
          <div className={`${containerClass} flex flex-1 items-center`}>
            <div className="mx-auto flex w-full max-w-[72rem]">
              <HeroWorkflowPreview lang={lang} mode="secondary" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className={`${viewportSectionClass} border-y border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-zinc-900/25`}>
          <div className={`${containerClass} w-full`}>
            <SectionHeader
              kicker={lang === 'es' ? 'Proceso' : 'Process'}
              title={t(lang, 'landing.how.title')}
              align="center"
            />

            <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.num}
                  className={`${cardBaseClass} group min-h-[220px] p-6 hover:-translate-y-1 hover:shadow-[0_28px_52px_-32px_rgba(15,23,42,0.6)]`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-[0.16em] text-zinc-300 dark:text-zinc-600">
                      {step.num}
                    </span>
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${step.accent}`}
                    >
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-black text-zinc-900 dark:text-zinc-100">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="extraction-modes" className={viewportSectionClass}>
          <div className={`${containerClass} w-full`}>
            <SectionHeader
              kicker={lang === 'es' ? 'Formatos de salida' : 'Output formats'}
              title={t(lang, 'landing.modes.title')}
              description={t(lang, 'landing.modes.sub')}
              align="center"
            />

            <div className="mt-10 grid gap-5 sm:grid-cols-2 md:mt-12">
              {modes.map((mode) => (
                <article
                  key={mode.title}
                  className={`${cardBaseClass} ${mode.hoverTone} min-h-[210px] p-6 hover:-translate-y-1 hover:shadow-[0_28px_52px_-32px_rgba(15,23,42,0.6)]`}
                >
                  <div className={`${iconShellClass} ${mode.iconTone}`}>{mode.icon}</div>
                  <h3 className="mt-4 text-lg font-black text-zinc-900 dark:text-zinc-100">{mode.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{mode.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="views"
          className={`${viewportSectionClass} border-y border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-zinc-900/25`}
        >
          <div className={`${containerClass} w-full`}>
            <SectionHeader
              kicker={lang === 'es' ? 'Vistas' : 'Views'}
              title={
                lang === 'es'
                  ? 'Nueve maneras de ver la misma extracción'
                  : 'Nine ways to see the same extraction'
              }
              description={
                lang === 'es'
                  ? 'La animación superior va rápido. Aquí puedes revisar con calma qué hace cada vista, cuándo conviene usarla y qué tipo de lectura te entrega.'
                  : 'The animated preview moves fast. Here you can review what each view does, when it is useful, and what kind of reading it gives you.'
              }
              align="center"
            />

            <ViewsExplorer lang={lang} />
          </div>
        </section>

        <section id="use-cases" className={`${viewportSectionClass} border-y border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-zinc-900/25`}>
          <div className={`${containerClass} w-full`}>
            <SectionHeader
              kicker={lang === 'es' ? 'Casos de uso' : 'Use cases'}
              title={
                lang === 'es'
                  ? 'Cómo se adapta a cada perfil'
                  : 'How the workflow adapts to each role'
              }
              description={
                lang === 'es'
                  ? 'Selecciona un perfil y revisa el problema operativo que resuelve Notes Aide.'
                  : 'Select a role and review the operational problem Notes Aide is built to solve.'
              }
              align="center"
            />

            <UseCasesTabs lang={lang} />
          </div>
        </section>

        <section id="integrations" className={`${viewportSectionClass} border-y border-zinc-200/70 bg-zinc-100/70 dark:border-white/10 dark:bg-zinc-900/30`}>
          <div className={`${containerClass} grid w-full gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-center`}>
            <SectionHeader
              kicker={lang === 'es' ? 'Stack conectado' : 'Connected stack'}
              title={t(lang, 'landing.integrations.title')}
              description={t(lang, 'landing.integrations.sub')}
              align="left"
            />

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2">
              {['Notion', 'Trello', 'Todoist', 'Google Docs'].map((tool) => (
                <IntegrationChip key={tool}>{tool}</IntegrationChip>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className={viewportSectionClass}>
          <div className={`${containerClass} w-full`}>
            <SectionHeader
              kicker="Pricing"
              title={
                lang === 'es'
                  ? 'Planes claros para crecer sin fricción'
                  : 'Straightforward plans that scale with your workflow'
              }
              description={
                lang === 'es'
                  ? 'Una estructura comercial simple para empezar rápido, operar a diario o desplegar Notes Aide con tu equipo.'
                  : 'A simple commercial structure to start fast, operate daily, or roll out Notes Aide across your team.'
              }
              align="center"
            />

            <LandingPricingTable lang={lang} />
          </div>
        </section>

        <section id="faq" className={viewportSectionClass}>
          <div className={`${containerClass} w-full`}>
            <SectionHeader
              kicker={lang === 'es' ? 'Resolvemos dudas' : 'Objection handling'}
              title={lang === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions'}
              description={
                lang === 'es'
                  ? 'Todo lo esencial antes de implementar Notes Aide en tu flujo.'
                  : 'Everything teams ask before adopting Notes Aide in production workflows.'
              }
              align="center"
            />

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:mt-12">
              {faqItems.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </section>

        <section className={`${viewportSectionClass} border-y border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-zinc-900/30`}>
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white md:text-5xl">
              {t(lang, 'landing.finalcta.title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
              {t(lang, 'landing.finalcta.sub')}
            </p>
            <Link
              href="/app?mode=register"
              className={`${primaryButtonClass} mt-9 px-8 py-4 text-base`}
            >
              {t(lang, 'landing.finalcta.button')}
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section
          id="guest-extractor"
          className={`${viewportSectionClass} border-t border-zinc-200/70 dark:border-white/10`}
        >
          <div className={`${containerClass} w-full`}>
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white md:text-4xl">
                {t(lang, 'landing.guest.title')}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500 dark:text-zinc-400 md:text-base">
                {t(lang, 'landing.guest.sub')}
              </p>
            </div>
            <GuestExtractorSection lang={lang} />
          </div>
        </section>
      </main>
    </div>
  )
}
