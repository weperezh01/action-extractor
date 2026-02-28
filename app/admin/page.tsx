'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getExtractionModeLabel, isExtractionMode } from '@/lib/extraction-modes'

const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'o1-mini': 'o1-mini',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#d97706',
  openai: '#10b981',
  google: '#3b82f6',
}

interface ProviderInfo {
  id: string
  label: string
  hasApiKey: boolean
  models: Array<{ id: string; label: string }>
}

interface ModelSettingsPayload {
  extractionProvider: string
  extractionModel: string
  chatProvider: string
  chatModel: string
  providers: ProviderInfo[]
  defaults: {
    extractionProvider: string
    extractionModel: string
    chatProvider: string
    chatModel: string
  }
}

function ProviderModelSelector({
  label,
  provider,
  model,
  providers,
  onProviderChange,
  onModelChange,
}: {
  label: string
  provider: string
  model: string
  providers: ProviderInfo[]
  onProviderChange: (p: string) => void
  onModelChange: (m: string) => void
}) {
  const selectedProvider = providers.find((p) => p.id === provider)
  const availableModels = selectedProvider?.models ?? []

  const handleProviderChange = (newProvider: string) => {
    onProviderChange(newProvider)
    const firstModel = providers.find((p) => p.id === newProvider)?.models[0]?.id ?? ''
    onModelChange(firstModel)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{label}</p>
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Proveedor</label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-300 px-2.5 text-sm bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.hasApiKey}>
                {p.label}{!p.hasApiKey ? ' (sin API key)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Modelo</label>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-300 px-2.5 text-sm bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function ModelConfigSection() {
  const [settings, setSettings] = useState<ModelSettingsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [extractionProvider, setExtractionProvider] = useState('')
  const [extractionModel, setExtractionModel] = useState('')
  const [chatProvider, setChatProvider] = useState('')
  const [chatModel, setChatModel] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/settings', { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as ModelSettingsPayload & { error?: unknown } | null
        if (!res.ok || !data) {
          setError(typeof data?.error === 'string' ? data.error : 'Error al cargar configuración.')
          return
        }
        setSettings(data)
        setExtractionProvider(data.extractionProvider)
        setExtractionModel(data.extractionModel)
        setChatProvider(data.chatProvider)
        setChatModel(data.chatModel)
      } catch {
        setError('Error de conexión al cargar configuración.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    setError(null)
    setNotice(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionProvider, extractionModel, chatProvider, chatModel }),
      })
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Error al guardar.')
        return
      }
      setSettings((prev) => prev ? { ...prev, extractionProvider, extractionModel, chatProvider, chatModel } : prev)
      setNotice('Configuración guardada. Los cambios aplican de inmediato.')
    } catch {
      setError('Error de conexión al guardar.')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = settings && (
    extractionProvider !== settings.extractionProvider ||
    extractionModel !== settings.extractionModel ||
    chatProvider !== settings.chatProvider ||
    chatModel !== settings.chatModel
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold mb-1">Configuración de Modelos IA</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Selecciona el proveedor y modelo para el extractor y el chatbot. El cambio aplica en la siguiente solicitud.
      </p>

      {loading ? (
        <div className="h-6 w-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProviderModelSelector
              label="Extractor de video"
              provider={extractionProvider}
              model={extractionModel}
              providers={settings?.providers ?? []}
              onProviderChange={setExtractionProvider}
              onModelChange={setExtractionModel}
            />
            <ProviderModelSelector
              label="Chatbot de conocimiento"
              provider={chatProvider}
              model={chatModel}
              providers={settings?.providers ?? []}
              onProviderChange={setChatProvider}
              onModelChange={setChatModel}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {notice && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  )
}

interface DailyStat {
  date: string
  total: number
}

interface TopVideoStat {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  total: number
}

interface ModeStat {
  extraction_mode: string
  total: number
}

interface AdminStatsPayload {
  period_days: number
  generated_at: string
  total_users: number
  total_extractions: number
  active_users_7d: number
  extractions_last_24h: number
  unique_videos_in_period: number
  extractions_by_day: DailyStat[]
  top_videos: TopVideoStat[]
  extraction_modes: ModeStat[]
}

interface AdminEstimationPayload {
  periodDays: number
  estimatedClaudeCalls: number
  estimatedCostPerExtractionUsd: number
  estimatedClaudeCostUsd: number
  currency: string
  method: string
  note: string
}

interface AdminStatsResponse {
  stats: AdminStatsPayload
  estimation: AdminEstimationPayload
}

interface AiCostByModel {
  provider: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

interface AiCostByDay {
  date: string
  cost_usd: number
  calls: number
}

interface AdminAiCostStats {
  period_days: number
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_model: AiCostByModel[]
  by_day: AiCostByDay[]
}

const PERIOD_OPTIONS = [7, 14, 30, 60, 90]

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES').format(value)
}

function formatCurrencyUsd(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(iso: string) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function resolveModeLabel(mode: string) {
  return isExtractionMode(mode) ? getExtractionModeLabel(mode) : mode
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function CostSvgChart({ data, maxCost }: { data: AiCostByDay[]; maxCost: number }) {
  if (data.length < 2) return null
  const W = 600
  const H = 120
  const PAD = { top: 10, right: 10, bottom: 24, left: 40 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const safeMax = maxCost > 0 ? maxCost : 1

  const points = data.map((d, i) => {
    const x = PAD.left + (i / (data.length - 1)) * innerW
    const y = PAD.top + (1 - d.cost_usd / safeMax) * innerH
    return `${x},${y}`
  })

  const areaPoints = [
    `${PAD.left},${PAD.top + innerH}`,
    ...points,
    `${PAD.left + innerW},${PAD.top + innerH}`,
  ].join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#costGrad)" />
      <polyline points={points.join(' ')} fill="none" stroke="#6366f1" strokeWidth="2" />
      {data.map((d, i) => {
        const x = PAD.left + (i / (data.length - 1)) * innerW
        const y = PAD.top + (1 - d.cost_usd / safeMax) * innerH
        return (
          <circle key={d.date} cx={x} cy={y} r="3" fill="#6366f1" />
        )
      })}
      {/* Y axis labels */}
      <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
        ${safeMax.toFixed(3)}
      </text>
      <text x={PAD.left - 4} y={PAD.top + innerH + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
        $0
      </text>
      {/* X axis date labels — first and last */}
      {data.length > 0 && (
        <>
          <text x={PAD.left} y={H - 6} textAnchor="start" fontSize="9" fill="#94a3b8">
            {data[0].date}
          </text>
          <text x={PAD.left + innerW} y={H - 6} textAnchor="end" fontSize="9" fill="#94a3b8">
            {data[data.length - 1].date}
          </text>
        </>
      )}
    </svg>
  )
}

function AiCostSection({ periodDays }: { periodDays: number }) {
  const [costs, setCosts] = useState<AdminAiCostStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/admin/costs?days=${periodDays}`, { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as (AdminAiCostStats & { error?: unknown }) | null
        if (!res.ok || !data) {
          setError(typeof data?.error === 'string' ? data.error : 'Error al cargar costos IA.')
          return
        }
        setCosts(data)
      } catch {
        setError('Error de conexión al cargar costos.')
      } finally {
        setLoading(false)
      }
    })()
  }, [periodDays])

  const maxModelCost = useMemo(
    () => (costs?.by_model ?? []).reduce((acc, m) => (m.cost_usd > acc ? m.cost_usd : acc), 0),
    [costs]
  )

  const maxDailyCost = useMemo(
    () => (costs?.by_day ?? []).reduce((acc, d) => (d.cost_usd > acc ? d.cost_usd : acc), 0),
    [costs]
  )

  const isEmpty = costs && costs.total_calls === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">Costos Reales por Modelo IA</h2>
        <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
          Últimos {periodDays}d
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
          Cargando costos...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && costs && (
        <>
          {isEmpty && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No hay llamadas a la IA registradas en este período. Los costos se trackean a partir de la siguiente extracción o chat.
            </div>
          )}

          {/* KPI cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Gasto total</p>
              <p className="text-3xl font-bold mt-1 text-indigo-700 dark:text-indigo-300">
                {formatCurrencyUsd(costs.total_cost_usd)}
              </p>
              <p className="text-xs text-slate-400 mt-1">{formatNumber(costs.total_calls)} llamadas API</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Tokens entrada</p>
              <p className="text-3xl font-bold mt-1">{formatTokens(costs.total_input_tokens)}</p>
              <p className="text-xs text-slate-400 mt-1">tokens procesados</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Tokens salida</p>
              <p className="text-3xl font-bold mt-1">{formatTokens(costs.total_output_tokens)}</p>
              <p className="text-xs text-slate-400 mt-1">tokens generados</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Costo promedio</p>
              <p className="text-3xl font-bold mt-1">
                {costs.total_calls > 0
                  ? formatCurrencyUsd(costs.total_cost_usd / costs.total_calls)
                  : '$0.00'}
              </p>
              <p className="text-xs text-slate-400 mt-1">por llamada API</p>
            </div>
          </div>

          {/* Timeline chart + by-model bar chart */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Cost timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold mb-3">Gasto diario (USD)</h3>
              {costs.by_day.length < 2 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Datos insuficientes para graficar.</p>
              ) : (
                <CostSvgChart data={costs.by_day} maxCost={maxDailyCost} />
              )}
              {costs.by_day.length > 0 && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {[...costs.by_day].reverse().slice(0, 10).map((d) => (
                    <div key={d.date} className="grid grid-cols-[90px_1fr_80px_55px] items-center gap-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">{d.date}</span>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${maxDailyCost > 0 ? Math.max(2, (d.cost_usd / maxDailyCost) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-slate-600 dark:text-slate-300">
                        {formatCurrencyUsd(d.cost_usd)}
                      </span>
                      <span className="text-right text-slate-400">{formatNumber(d.calls)} calls</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cost by model bar chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold mb-3">Gasto por modelo</h3>
              {costs.by_model.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos en este período.</p>
              ) : (
                <div className="space-y-3">
                  {costs.by_model.map((m) => {
                    const providerColor = PROVIDER_COLORS[m.provider] ?? '#6366f1'
                    const widthPct = maxModelCost > 0 ? Math.max(2, (m.cost_usd / maxModelCost) * 100) : 0
                    return (
                      <div key={`${m.provider}-${m.model}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {MODEL_LABELS[m.model] ?? m.model}
                          </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrencyUsd(m.cost_usd)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${widthPct}%`, backgroundColor: providerColor }}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span
                            className="inline-flex items-center gap-1 font-medium"
                            style={{ color: providerColor }}
                          >
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: providerColor }}
                            />
                            {PROVIDER_LABELS[m.provider] ?? m.provider}
                          </span>
                          <span>{formatNumber(m.calls)} llamadas</span>
                          <span>↑ {formatTokens(m.input_tokens)}</span>
                          <span>↓ {formatTokens(m.output_tokens)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Detail table */}
          {costs.by_model.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold">Desglose completo por modelo</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase">Proveedor</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase">Modelo</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase">Tipo</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase">Llamadas</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase">Tok. entrada</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase">Tok. salida</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase">Costo USD</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.by_model.map((m) => {
                      const pct = costs.total_cost_usd > 0
                        ? ((m.cost_usd / costs.total_cost_usd) * 100).toFixed(1)
                        : '0.0'
                      const providerColor = PROVIDER_COLORS[m.provider] ?? '#6366f1'
                      return (
                        <tr
                          key={`${m.provider}-${m.model}`}
                          className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        >
                          <td className="px-4 py-2.5">
                            <span
                              className="font-medium"
                              style={{ color: providerColor }}
                            >
                              {PROVIDER_LABELS[m.provider] ?? m.provider}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                            {MODEL_LABELS[m.model] ?? m.model}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              mixed
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatNumber(m.calls)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatTokens(m.input_tokens)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatTokens(m.output_tokens)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrencyUsd(m.cost_usd)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, backgroundColor: providerColor }}
                                />
                              </div>
                              <span className="text-slate-600 dark:text-slate-400 w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                      <td colSpan={3} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Total</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-200">
                        {formatNumber(costs.total_calls)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                        {formatTokens(costs.total_input_tokens)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                        {formatTokens(costs.total_output_tokens)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-indigo-700 dark:text-indigo-300">
                        {formatCurrencyUsd(costs.total_cost_usd)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AdminPage() {
  const [periodDays, setPeriodDays] = useState(30)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<AdminStatsResponse | null>(null)

  const loadStats = useCallback(async () => {
    setError(null)
    if (payload) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const res = await fetch(`/api/admin/stats?days=${periodDays}`, {
        cache: 'no-store',
      })
      const data = (await res.json().catch(() => null)) as
        | (AdminStatsResponse & { error?: unknown })
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : res.status === 401
              ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
              : res.status === 403
                ? 'No tienes permisos de administrador.'
                : 'No se pudieron cargar las métricas.'
        setError(message)
        return
      }

      if (!data?.stats || !data?.estimation) {
        setError('Respuesta inválida del servidor.')
        return
      }

      setPayload({
        stats: data.stats,
        estimation: data.estimation,
      })
    } catch {
      setError('Error de conexión al cargar métricas.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [payload, periodDays])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const maxDailyExtractions = useMemo(() => {
    const values = payload?.stats.extractions_by_day ?? []
    return values.reduce((acc, item) => (item.total > acc ? item.total : acc), 0)
  }, [payload])

  if (isLoading && !payload) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400 rounded-full animate-spin" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Panel Admin</p>
            <h1 className="text-2xl font-bold">Métricas de Uso y Costos</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/plans"
              className="px-3 py-2 text-sm rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
            >
              Gestionar planes
            </Link>
            <Link
              href="/admin/users"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Gestionar usuarios
            </Link>
            <Link
              href="/"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Volver al extractor
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <label className="text-sm text-slate-600 dark:text-slate-300">Periodo</label>
          <select
            value={periodDays}
            onChange={(event) => setPeriodDays(Number.parseInt(event.target.value, 10))}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {PERIOD_OPTIONS.map((days) => (
              <option key={days} value={days}>
                Últimos {days} días
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={isRefreshing}
            className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-700"
          >
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          {payload && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Actualizado: {formatDateTime(payload.stats.generated_at)}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>
        )}

        <ModelConfigSection />

        <AiCostSection periodDays={periodDays} />

        {payload && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Usuarios totales</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(payload.stats.total_users)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Extracciones totales</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(payload.stats.total_extractions)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Usuarios activos (7d)</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(payload.stats.active_users_7d)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Extracciones (24h)</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(payload.stats.extractions_last_24h)}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-semibold mb-4">Extracciones por día</h2>
                <div className="space-y-2">
                  {payload.stats.extractions_by_day.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No hay datos para el periodo seleccionado.</p>
                  ) : (
                    payload.stats.extractions_by_day.map((item) => {
                      const width =
                        maxDailyExtractions > 0
                          ? Math.max(2, Math.round((item.total / maxDailyExtractions) * 100))
                          : 0
                      return (
                        <div key={item.date} className="grid grid-cols-[90px_1fr_55px] items-center gap-3">
                          <p className="text-xs text-slate-600 dark:text-slate-300">{item.date}</p>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <p className="text-xs text-right font-semibold text-slate-700 dark:text-slate-200">
                            {formatNumber(item.total)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-semibold mb-4">Costo estimado (Claude)</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Videos únicos ({payload.estimation.periodDays}d)</p>
                    <p className="text-xl font-bold">{formatNumber(payload.estimation.estimatedClaudeCalls)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Costo unitario estimado</p>
                    <p className="font-semibold">
                      {formatCurrencyUsd(payload.estimation.estimatedCostPerExtractionUsd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Costo total estimado</p>
                    <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                      {formatCurrencyUsd(payload.estimation.estimatedClaudeCostUsd)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{payload.estimation.note}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-semibold mb-4">Videos más procesados</h2>
                <div className="space-y-3">
                  {payload.stats.top_videos.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No hay videos para mostrar.</p>
                  ) : (
                    payload.stats.top_videos.map((item) => (
                      <div
                        key={item.video_id}
                        className="grid grid-cols-[64px_1fr_auto] gap-3 items-center border border-slate-100 rounded-lg p-2 dark:border-slate-700"
                      >
                        {item.thumbnail_url ? (
                          <div className="relative w-16 h-10">
                            <Image
                              src={item.thumbnail_url}
                              alt={item.video_title ?? 'Miniatura'}
                              fill
                              sizes="64px"
                              className="rounded object-cover border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-10 rounded bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {item.video_title || item.video_id}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.video_id}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatNumber(item.total)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-semibold mb-4">Distribución por modo</h2>
                <div className="space-y-3">
                  {payload.stats.extraction_modes.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No hay datos de modos en este periodo.</p>
                  ) : (
                    payload.stats.extraction_modes.map((item) => (
                      <div
                        key={item.extraction_mode}
                        className="flex items-center justify-between rounded-lg border border-slate-100 p-2 dark:border-slate-700"
                      >
                        <p className="text-sm text-slate-700 dark:text-slate-300">{resolveModeLabel(item.extraction_mode)}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatNumber(item.total)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
