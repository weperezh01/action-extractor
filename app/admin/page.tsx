'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getExtractionModeLabel, isExtractionMode } from '@/lib/extraction-modes'

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
