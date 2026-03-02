'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw, Save, CheckCircle2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromptEntry {
  promptKey: string
  label: string
  category: 'extraction' | 'chat'
  mode: string | null
  type: 'system' | 'user'
  defaultContent: string
  overriddenContent: string | null
  isOverridden: boolean
  updatedAt: string | null
  updatedBy: string | null
}

type ExtractionMode = 'action_plan' | 'executive_summary' | 'business_ideas' | 'key_quotes' | 'concept_map'

const EXTRACTION_MODES: ExtractionMode[] = [
  'action_plan',
  'executive_summary',
  'business_ideas',
  'key_quotes',
  'concept_map',
]

const MODE_LABELS: Record<ExtractionMode, string> = {
  action_plan: 'Plan de Acción',
  executive_summary: 'Resumen Ejecutivo',
  business_ideas: 'Ideas de Negocio',
  key_quotes: 'Frases Clave',
  concept_map: 'Mapa Conceptual',
}

// ── PromptEditor ──────────────────────────────────────────────────────────────

function PromptEditor({
  entry,
  onSaved,
}: {
  entry: PromptEntry
  onSaved: () => void
}) {
  const [value, setValue] = useState(entry.overriddenContent ?? entry.defaultContent)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Reset local value when entry changes
  useEffect(() => {
    setValue(entry.overriddenContent ?? entry.defaultContent)
    setSavedAt(null)
    setSaveError(null)
  }, [entry.promptKey, entry.overriddenContent, entry.defaultContent])

  const isDirty = value !== (entry.overriddenContent ?? entry.defaultContent)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/prompts/${encodeURIComponent(entry.promptKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Error al guardar el prompt.')
      }
      setSavedAt(new Date())
      onSaved()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setSaving(false)
    }
  }, [entry.promptKey, value, onSaved])

  const handleReset = useCallback(async () => {
    if (!entry.isOverridden) {
      setValue(entry.defaultContent)
      return
    }
    setResetting(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/prompts/${encodeURIComponent(entry.promptKey)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Error al restablecer el prompt.')
      }
      setValue(entry.defaultContent)
      setSavedAt(null)
      onSaved()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setResetting(false)
    }
  }, [entry.promptKey, entry.isOverridden, entry.defaultContent, onSaved])

  const isUserPrompt = entry.type === 'user'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {entry.type === 'system' ? 'Prompt de Sistema' : 'Prompt de Usuario (plantilla)'}
          </span>
          {entry.isOverridden && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              Modificado
            </span>
          )}
        </div>
        {entry.isOverridden && entry.updatedAt && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Guardado {new Date(entry.updatedAt).toLocaleString('es-MX')}
            {entry.updatedBy ? ` por ${entry.updatedBy}` : ''}
          </span>
        )}
        {savedAt && !isDirty && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={12} />
            Guardado
          </span>
        )}
      </div>

      {isUserPrompt && (
        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
          Usa <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{transcript}}'}</code> como marcador donde irá el contenido del video/página. El encabezado MODO/IDIOMA se antepone automáticamente.
        </p>
      )}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        className="w-full font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-y leading-relaxed"
        spellCheck={false}
      />

      {saveError && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {saveError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={12} />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={handleReset}
          disabled={resetting || (!entry.isOverridden && value === entry.defaultContent)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={12} />
          {resetting ? 'Restableciendo...' : 'Restablecer predeterminado'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<PromptEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'extraction' | 'chat'>('extraction')
  const [activeMode, setActiveMode] = useState<ExtractionMode>('action_plan')

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/prompts')
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Error al cargar prompts.')
      }
      const data = (await res.json()) as { prompts: PromptEntry[] }
      setPrompts(data.prompts)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPrompts()
  }, [fetchPrompts])

  const getEntry = (key: string) => prompts.find((p) => p.promptKey === key) ?? null

  const extractionEntries = prompts.filter((p) => p.category === 'extraction')
  const overriddenCount = prompts.filter((p) => p.isOverridden).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Gestión de Prompts</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Edita los prompts de IA en tiempo real sin redeploy
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/credits"
              className="px-3 py-2 text-sm rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
            >
              Créditos
            </Link>
            <Link
              href="/admin/plans"
              className="px-3 py-2 text-sm rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
            >
              Planes
            </Link>
            <Link
              href="/admin/users"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Usuarios
            </Link>
            <Link
              href="/admin"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Métricas
            </Link>
            <Link
              href="/"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Volver al extractor
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Warning banner */}
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-medium">Los cambios afectan todas las extracciones nuevas</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Los resultados almacenados en caché no se ven afectados: fueron generados con el prompt anterior.
              Para invalidar caché de un video específico, el admin puede eliminar entradas manualmente en la DB.
            </p>
          </div>
        </div>

        {/* Stats row */}
        {!loading && !error && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Total de prompts: <span className="font-semibold text-slate-900 dark:text-white">{prompts.length}</span>
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              Modificados:{' '}
              <span className={`font-semibold ${overriddenCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                {overriddenCount}
              </span>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {(['extraction', 'chat'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-900 border border-b-white dark:border-b-slate-900 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'extraction' ? 'Extractor' : 'Chat'}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">Cargando prompts...</div>
        )}

        {error && (
          <div className="text-center py-16 text-red-500 dark:text-red-400">{error}</div>
        )}

        {!loading && !error && activeTab === 'extraction' && (
          <div className="space-y-6">
            {/* Mode selector */}
            <div className="flex gap-2 flex-wrap">
              {EXTRACTION_MODES.map((mode) => {
                const modeEntries = extractionEntries.filter((e) => e.mode === mode)
                const hasOverride = modeEntries.some((e) => e.isOverridden)
                return (
                  <button
                    key={mode}
                    onClick={() => setActiveMode(mode)}
                    className={`relative px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      activeMode === mode
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {MODE_LABELS[mode]}
                    {hasOverride && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* System and User prompts for selected mode */}
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {(['system', 'user'] as const).map((type) => {
                const key = `extraction:${activeMode}:${type}`
                const entry = getEntry(key)
                if (!entry) return null
                return (
                  <div
                    key={key}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm"
                  >
                    <PromptEditor entry={entry} onSaved={fetchPrompts} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && !error && activeTab === 'chat' && (
          <div className="space-y-4">
            {(() => {
              const entry = getEntry('chat:system')
              if (!entry) return null
              return (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Prompt de Sistema del Asistente
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Controla el comportamiento y personalidad del asistente de chat.
                    </p>
                  </div>
                  <PromptEditor entry={entry} onSaved={fetchPrompts} />
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
