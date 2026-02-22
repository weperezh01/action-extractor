'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Settings2 } from 'lucide-react'
import {
  EXTRACTION_MODE_OPTIONS,
  getExtractionModeLabel,
  type ExtractionMode,
} from '@/lib/extraction-modes'
import {
  EXTRACTION_OUTPUT_LANGUAGE_OPTIONS,
  type ExtractionOutputLanguage,
} from '@/lib/output-language'

interface WorkspaceControlsDockProps {
  extractionMode: ExtractionMode
  outputLanguage: ExtractionOutputLanguage
  isProcessing: boolean
  onExtractionModeChange: (mode: ExtractionMode) => void
  onOutputLanguageChange: (language: ExtractionOutputLanguage) => void

  notionConfigured: boolean
  notionConnected: boolean
  notionWorkspaceName: string | null
  notionLoading: boolean
  notionDisconnectLoading: boolean
  onConnectNotion: () => void
  onDisconnectNotion: () => void

  trelloConfigured: boolean
  trelloConnected: boolean
  trelloUsername: string | null
  trelloLoading: boolean
  trelloDisconnectLoading: boolean
  onConnectTrello: () => void
  onDisconnectTrello: () => void

  todoistConfigured: boolean
  todoistConnected: boolean
  todoistUserLabel: string | null
  todoistLoading: boolean
  todoistDisconnectLoading: boolean
  onConnectTodoist: () => void
  onDisconnectTodoist: () => void

  googleDocsConfigured: boolean
  googleDocsConnected: boolean
  googleDocsUserEmail: string | null
  googleDocsLoading: boolean
  googleDocsDisconnectLoading: boolean
  onConnectGoogleDocs: () => void
  onDisconnectGoogleDocs: () => void
}

type IntegrationControl = {
  key: string
  label: string
  configured: boolean
  connected: boolean
  accountLabel: string | null
  connecting: boolean
  disconnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
}

const triggerClass =
  'inline-flex h-9 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-white/5'

const panelClass =
  'absolute right-0 z-20 mt-2 rounded-xl border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-zinc-950'

export function WorkspaceControlsDock({
  extractionMode,
  outputLanguage,
  isProcessing,
  onExtractionModeChange,
  onOutputLanguageChange,

  notionConfigured,
  notionConnected,
  notionWorkspaceName,
  notionLoading,
  notionDisconnectLoading,
  onConnectNotion,
  onDisconnectNotion,

  trelloConfigured,
  trelloConnected,
  trelloUsername,
  trelloLoading,
  trelloDisconnectLoading,
  onConnectTrello,
  onDisconnectTrello,

  todoistConfigured,
  todoistConnected,
  todoistUserLabel,
  todoistLoading,
  todoistDisconnectLoading,
  onConnectTodoist,
  onDisconnectTodoist,

  googleDocsConfigured,
  googleDocsConnected,
  googleDocsUserEmail,
  googleDocsLoading,
  googleDocsDisconnectLoading,
  onConnectGoogleDocs,
  onDisconnectGoogleDocs,
}: WorkspaceControlsDockProps) {
  const [isModeOpen, setIsModeOpen] = useState(false)
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target || !controlsRef.current) return
      if (controlsRef.current.contains(target)) return

      setIsModeOpen(false)
      setIsLanguageOpen(false)
      setIsIntegrationsOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const outputLanguageLabel =
    EXTRACTION_OUTPUT_LANGUAGE_OPTIONS.find((option) => option.value === outputLanguage)?.label ??
    'Español'

  const integrationControls: IntegrationControl[] = [
    {
      key: 'notion',
      label: 'Notion',
      configured: notionConfigured,
      connected: notionConnected,
      accountLabel: notionWorkspaceName,
      connecting: notionLoading,
      disconnecting: notionDisconnectLoading,
      onConnect: onConnectNotion,
      onDisconnect: onDisconnectNotion,
    },
    {
      key: 'trello',
      label: 'Trello',
      configured: trelloConfigured,
      connected: trelloConnected,
      accountLabel: trelloUsername ? `@${trelloUsername}` : null,
      connecting: trelloLoading,
      disconnecting: trelloDisconnectLoading,
      onConnect: onConnectTrello,
      onDisconnect: onDisconnectTrello,
    },
    {
      key: 'todoist',
      label: 'Todoist',
      configured: todoistConfigured,
      connected: todoistConnected,
      accountLabel: todoistUserLabel,
      connecting: todoistLoading,
      disconnecting: todoistDisconnectLoading,
      onConnect: onConnectTodoist,
      onDisconnect: onDisconnectTodoist,
    },
    {
      key: 'google-docs',
      label: 'Google Docs',
      configured: googleDocsConfigured,
      connected: googleDocsConnected,
      accountLabel: googleDocsUserEmail,
      connecting: googleDocsLoading,
      disconnecting: googleDocsDisconnectLoading,
      onConnect: onConnectGoogleDocs,
      onDisconnect: onDisconnectGoogleDocs,
    },
  ]

  const connectedIntegrations = integrationControls.filter((control) => control.connected).length

  return (
    <div className="mx-auto mb-8 flex w-full max-w-3xl justify-end" ref={controlsRef}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="relative">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              setIsModeOpen((previous) => {
                const next = !previous
                if (next) {
                  setIsLanguageOpen(false)
                  setIsIntegrationsOpen(false)
                }
                return next
              })
            }}
            className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span>Modo: {getExtractionModeLabel(extractionMode)}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isModeOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isModeOpen && (
            <div className={`${panelClass} w-[22rem]`}>
              <div className="space-y-1">
                {EXTRACTION_MODE_OPTIONS.map((option) => {
                  const isActive = extractionMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        onExtractionModeChange(option.value)
                        setIsModeOpen(false)
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-white/5'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {option.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              setIsLanguageOpen((previous) => {
                const next = !previous
                if (next) {
                  setIsModeOpen(false)
                  setIsIntegrationsOpen(false)
                }
                return next
              })
            }}
            className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span>Idioma: {outputLanguageLabel}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isLanguageOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isLanguageOpen && (
            <div className={`${panelClass} w-[20rem]`}>
              <div className="space-y-1">
                {EXTRACTION_OUTPUT_LANGUAGE_OPTIONS.map((option) => {
                  const isActive = outputLanguage === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        onOutputLanguageChange(option.value)
                        setIsLanguageOpen(false)
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-white/5'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {option.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsIntegrationsOpen((previous) => {
                const next = !previous
                if (next) {
                  setIsModeOpen(false)
                  setIsLanguageOpen(false)
                }
                return next
              })
            }}
            className={triggerClass}
          >
            <Settings2 size={13} />
            <span>Conexiones: {connectedIntegrations}/4</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isIntegrationsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isIntegrationsOpen && (
            <div className={`${panelClass} w-[22rem]`}>
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Conexiones de exportación
              </p>
              <div className="space-y-2">
                {integrationControls.map((control) => {
                  const actionDisabled = control.connected
                    ? control.disconnecting
                    : control.connecting || !control.configured
                  const actionLabel = control.connected
                    ? control.disconnecting
                      ? 'Desconectando...'
                      : 'Desconectar'
                    : control.connecting
                      ? 'Conectando...'
                      : control.configured
                        ? 'Conectar'
                        : 'No disponible'

                  const statusLabel = control.connected
                    ? `Conectado${control.accountLabel ? `: ${control.accountLabel}` : ''}`
                    : control.configured
                      ? 'Sin conexión'
                      : 'No configurado en servidor'

                  return (
                    <div
                      key={control.key}
                      className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-white/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                            {control.label}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {statusLabel}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={actionDisabled}
                          onClick={() => {
                            if (control.connected) {
                              control.onDisconnect()
                            } else {
                              control.onConnect()
                            }
                            setIsIntegrationsOpen(false)
                          }}
                          className={`h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
                            control.connected
                              ? 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/5'
                              : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/70'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {actionLabel}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
