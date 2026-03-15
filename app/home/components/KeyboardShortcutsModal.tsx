'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useLang } from '@/app/home/hooks/useLang'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const SHORTCUT_COPY = {
  en: {
    dialogLabel: 'Keyboard shortcuts',
    title: 'Keyboard shortcuts',
    close: 'Close',
    footer: 'Shortcuts 1-5 only work outside text fields.',
    groups: [
      {
        title: 'Navigation',
        items: [
          { keys: [MOD, 'K'], label: 'Focus the input field' },
          { keys: [MOD, '↵'], label: 'Start extraction' },
        ],
      },
      {
        title: 'Extraction modes',
        items: [
          { keys: ['1'], label: 'Mode: Action Plan' },
          { keys: ['2'], label: 'Mode: Executive Summary' },
          { keys: ['3'], label: 'Mode: Business Ideas' },
          { keys: ['4'], label: 'Mode: Key Quotes' },
          { keys: ['5'], label: 'Mode: Concept Map' },
        ],
      },
      {
        title: 'Result',
        items: [
          { keys: [MOD, 'D'], label: 'Download PDF' },
          { keys: [MOD, '⇧', 'C'], label: 'Copy as Markdown' },
        ],
      },
      {
        title: 'Help',
        items: [{ keys: ['?'], label: 'Show this window' }],
      },
    ],
  },
  es: {
    dialogLabel: 'Atajos de teclado',
    title: 'Atajos de teclado',
    close: 'Cerrar',
    footer: 'Los atajos 1-5 solo funcionan fuera de campos de texto.',
    groups: [
      {
        title: 'Navegación',
        items: [
          { keys: [MOD, 'K'], label: 'Enfocar el campo de entrada' },
          { keys: [MOD, '↵'], label: 'Iniciar extracción' },
        ],
      },
      {
        title: 'Modos de extracción',
        items: [
          { keys: ['1'], label: 'Modo: Plan de Acción' },
          { keys: ['2'], label: 'Modo: Resumen Ejecutivo' },
          { keys: ['3'], label: 'Modo: Ideas de Negocio' },
          { keys: ['4'], label: 'Modo: Citas Clave' },
          { keys: ['5'], label: 'Modo: Mapa Conceptual' },
        ],
      },
      {
        title: 'Resultado',
        items: [
          { keys: [MOD, 'D'], label: 'Descargar PDF' },
          { keys: [MOD, '⇧', 'C'], label: 'Copiar como Markdown' },
        ],
      },
      {
        title: 'Ayuda',
        items: [{ keys: ['?'], label: 'Mostrar esta ventana' }],
      },
    ],
  },
} as const

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[28px] items-center justify-center rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const { lang } = useLang()
  const ui = SHORTCUT_COPY[lang]

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ui.dialogLabel}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {ui.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={ui.close}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          {ui.groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.title}
              </p>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[11px] text-slate-400 dark:text-slate-500">
          {ui.footer}
        </p>
      </div>
    </div>,
    document.body
  )
}
