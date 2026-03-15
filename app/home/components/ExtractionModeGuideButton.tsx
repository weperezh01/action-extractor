'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, X } from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'
import { type ExtractionMode } from '@/lib/extraction-modes'

type CopyLang = 'en' | 'es'

interface ExtractionModeGuideButtonProps {
  mode: ExtractionMode
  align?: 'left' | 'right'
  buttonClassName?: string
  panelClassName?: string
  onBeforeOpen?: () => void
  onOpenChange?: (open: boolean) => void
}

const MODE_ORDER: readonly ExtractionMode[] = [
  'action_plan',
  'executive_summary',
  'business_ideas',
  'key_quotes',
  'concept_map',
]

const GUIDE_COPY = {
  en: {
    buttonLabel: 'How to choose an extraction mode',
    title: 'How to choose the mode',
    subtitle: 'Pick the mode based on the source material and the result you need.',
    currentBadge: 'Current',
    closeLabel: 'Close',
    items: {
      action_plan: {
        label: 'Action Plan',
        when:
          'Use it when the content is procedural and you want clear next steps, phases, and execution.',
        bestFor: 'Best for tutorials, SOPs, project plans, meeting notes, and operational workflows.',
      },
      executive_summary: {
        label: 'Executive Summary',
        when:
          'Use it when the source is long or dense and you need a fast, decision-ready briefing.',
        bestFor: 'Best for reports, strategy documents, market research, and stakeholder updates.',
      },
      business_ideas: {
        label: 'Business Ideas',
        when:
          'Use it when the material contains opportunities, trends, monetization angles, or market gaps.',
        bestFor: 'Best for industry analysis, startup content, innovation research, and product opportunities.',
      },
      key_quotes: {
        label: 'Key Quotes',
        when:
          'Use it when the value lives in memorable phrases, strong arguments, hooks, or reusable statements.',
        bestFor: 'Best for interviews, podcasts, speeches, creator content, and social repurposing.',
      },
      concept_map: {
        label: 'Concept Map',
        when:
          'Use it when the content explains ideas, theories, or systems and the relationships matter more than the sequence.',
        bestFor: 'Best for classes, research, frameworks, explanatory content, and concept-heavy material.',
      },
    },
  },
  es: {
    buttonLabel: 'Como elegir el modo de extraccion',
    title: 'Como elegir el modo',
    subtitle: 'Elige el modo segun el tipo de contenido y el resultado que quieres obtener.',
    currentBadge: 'Actual',
    closeLabel: 'Cerrar',
    items: {
      action_plan: {
        label: 'Plan de Accion',
        when:
          'Usalo cuando el contenido sea procedural y quieras pasos claros, fases y ejecucion.',
        bestFor: 'Ideal para tutoriales, SOPs, planes de proyecto, notas de reunion y flujos operativos.',
      },
      executive_summary: {
        label: 'Resumen Ejecutivo',
        when:
          'Usalo cuando la fuente sea larga o densa y necesites un briefing rapido para decidir.',
        bestFor: 'Ideal para reportes, documentos estrategicos, investigacion de mercado y actualizaciones a stakeholders.',
      },
      business_ideas: {
        label: 'Ideas de Negocio',
        when:
          'Usalo cuando el material traiga oportunidades, tendencias, monetizacion o huecos de mercado.',
        bestFor: 'Ideal para analisis de industria, contenido startup, investigacion de innovacion y oportunidades de producto.',
      },
      key_quotes: {
        label: 'Frases Clave',
        when:
          'Usalo cuando el valor este en frases memorables, argumentos fuertes, hooks o declaraciones reutilizables.',
        bestFor: 'Ideal para entrevistas, podcasts, discursos, contenido de creadores y reutilizacion en redes.',
      },
      concept_map: {
        label: 'Mapa Conceptual',
        when:
          'Usalo cuando el contenido explique ideas, teorias o sistemas y las relaciones importen mas que la secuencia.',
        bestFor: 'Ideal para clases, investigacion, marcos teoricos, contenido explicativo y material cargado de conceptos.',
      },
    },
  },
} as const satisfies Record<
  CopyLang,
  {
    buttonLabel: string
    title: string
    subtitle: string
    currentBadge: string
    closeLabel: string
    items: Record<
      ExtractionMode,
      {
        label: string
        when: string
        bestFor: string
      }
    >
  }
>

const defaultButtonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white'

export function ExtractionModeGuideButton({
  mode,
  buttonClassName,
  onBeforeOpen,
  onOpenChange,
}: ExtractionModeGuideButtonProps) {
  const { lang } = useLang()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  const copy = GUIDE_COPY[lang as CopyLang] ?? GUIDE_COPY.en

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={copy.buttonLabel}
        aria-haspopup="dialog"
        title={copy.buttonLabel}
        onClick={() => {
          setIsOpen((previous) => {
            const next = !previous
            if (next) onBeforeOpen?.()
            return next
          })
        }}
        className={buttonClassName ?? defaultButtonClassName}
      >
        <CircleHelp size={15} />
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={copy.title}
              className="fixed inset-0 z-[9999] flex items-end justify-center p-4 sm:items-center"
              onClick={() => setIsOpen(false)}
            >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

              <div
                className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-zinc-950"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-white/10 sm:px-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {copy.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {copy.subtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label={copy.closeLabel}
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-300"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 sm:px-6">
                  <div className="space-y-3">
                    {MODE_ORDER.map((optionMode) => {
                      const guide = copy.items[optionMode]
                      const isActive = optionMode === mode
                      return (
                        <div
                          key={optionMode}
                          className={`rounded-xl border px-4 py-3 ${
                            isActive
                              ? 'border-violet-300 bg-violet-50/80 dark:border-violet-700 dark:bg-violet-950/40'
                              : 'border-zinc-200 dark:border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 sm:text-base">
                              {guide.label}
                            </p>
                            {isActive ? (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                {copy.currentBadge}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {guide.when}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                            {guide.bestFor}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
