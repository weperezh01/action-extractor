'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BarChart2, Moon, Star, Sun, Zap } from 'lucide-react'
import { applyTheme, getThemeStorageKey, resolveInitialTheme } from '@/app/home/lib/utils'
import type { Theme } from '@/app/home/lib/types'

interface DashboardStats {
  extractions: {
    total: number
    thisWeek: number
    thisMonth: number
    starred: number
    byMode: Record<string, number>
    bySourceType: Record<string, number>
  }
  tasks: { total: number; completed: number }
  savedMinutes: number
  activity: { date: string; count: number }[]
  streak: { current: number; longest: number }
}

const MODE_LABELS: Record<string, string> = {
  action_plan: 'Plan de acción',
  executive_summary: 'Resumen ejecutivo',
  business_ideas: 'Ideas de negocio',
  key_quotes: 'Citas clave',
  concept_map: 'Mapa conceptual',
}

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  web_url: 'Web',
  pdf: 'PDF',
  docx: 'DOCX',
  text: 'Texto',
}

function heatmapColor(count: number, theme: Theme) {
  if (count === 0) return theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
  if (count <= 2) return theme === 'dark' ? 'bg-indigo-800' : 'bg-indigo-200'
  if (count <= 5) return theme === 'dark' ? 'bg-indigo-600' : 'bg-indigo-400'
  return theme === 'dark' ? 'bg-indigo-400' : 'bg-indigo-600'
}

function formatSavedTime(minutes: number) {
  if (minutes === 0) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>}
    </div>
  )
}

function HorizontalBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500 dark:bg-indigo-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [theme, setTheme] = useState<Theme>('light')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Theme bootstrap
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
      localStorage.setItem(getThemeStorageKey(), next)
    } catch {
      // noop
    }
  }

  // Auth check + data load
  useEffect(() => {
    let cancelled = false
    async function load() {
      // Check session first
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' })
      if (!sessionRes.ok) {
        router.replace('/app')
        return
      }
      const sessionData = await sessionRes.json().catch(() => null)
      if (!sessionData?.user) {
        router.replace('/app')
        return
      }

      // Fetch stats
      const statsRes = await fetch('/api/account/stats', { cache: 'no-store' })
      if (cancelled) return
      if (!statsRes.ok) {
        setError('No se pudieron cargar las estadísticas.')
        setLoading(false)
        return
      }
      const data: DashboardStats = await statsRes.json()
      if (!cancelled) {
        setStats(data)
        setLoading(false)
      }
    }
    load().catch(() => {
      if (!cancelled) {
        setError('Error de conexión.')
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [router])

  // Build 365-day heatmap grid
  const heatmapCells = (() => {
    if (!stats) return []
    const activityMap = new Map(stats.activity.map((a) => [a.date, a.count]))
    const today = new Date()
    // Align to start of week (Sunday). We want 53 columns of 7 days.
    const totalDays = 371 // 53 * 7
    // Find first Sunday on or before (today - 364 days)
    const oldestDay = new Date(today)
    oldestDay.setDate(oldestDay.getDate() - 364)
    // Adjust to Sunday
    const dayOfWeek = oldestDay.getDay() // 0=Sun
    oldestDay.setDate(oldestDay.getDate() - dayOfWeek)

    const cells: { date: string; count: number; isFuture: boolean }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(oldestDay)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const isFuture = d > today
      cells.push({ date: dateStr, count: activityMap.get(dateStr) ?? 0, isFuture })
    }
    return cells
  })()

  const totalHeatmapExtractions = stats?.activity.reduce((s, a) => s + a.count, 0) ?? 0

  const totalModeExtractions = stats
    ? Object.values(stats.extractions.byMode).reduce((s, v) => s + v, 0)
    : 0
  const totalSourceExtractions = stats
    ? Object.values(stats.extractions.bySourceType).reduce((s, v) => s + v, 0)
    : 0

  const taskPct =
    stats && stats.tasks.total > 0
      ? Math.round((stats.tasks.completed / stats.tasks.total) * 100)
      : 0

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/90">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            <ArrowLeft size={14} />
            Extractora
          </Link>
          <div className="flex items-center gap-1.5 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            <BarChart2 size={18} className="text-indigo-500" />
            Mi ROI
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cambiar tema"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24 text-zinc-400">
            Cargando estadísticas...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                label="Playbooks"
                value={stats.extractions.total}
                sub={`${stats.extractions.thisWeek} esta semana · ${stats.extractions.thisMonth} este mes`}
                icon={<Zap size={14} />}
              />
              <KpiCard
                label="Favoritos"
                value={stats.extractions.starred}
                sub="playbooks destacados"
                icon={<Star size={14} />}
              />
              <KpiCard
                label="Tiempo ahorrado"
                value={formatSavedTime(stats.savedMinutes)}
                sub={`${stats.savedMinutes} minutos en total`}
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
              />
              <KpiCard
                label="Racha actual"
                value={`${stats.streak.current}d`}
                sub={`Mejor racha: ${stats.streak.longest} días`}
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                }
              />
            </div>

            {/* Activity Heatmap */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Actividad este año
              </h2>
              <div className="overflow-x-auto">
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: 'repeat(53, minmax(0, 1fr))',
                    gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
                    gridAutoFlow: 'column',
                    width: 'max-content',
                    minWidth: '100%',
                  }}
                >
                  {heatmapCells.map((cell) => (
                    <div
                      key={cell.date}
                      title={
                        cell.isFuture
                          ? cell.date
                          : `${cell.date}: ${cell.count} extracción${cell.count !== 1 ? 'es' : ''}`
                      }
                      className={`h-3 w-3 rounded-sm transition-colors ${
                        cell.isFuture
                          ? 'opacity-0'
                          : heatmapColor(cell.count, theme)
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                {totalHeatmapExtractions} extracciones en el último año
              </p>
            </div>

            {/* Mode + Source breakdown */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* By Mode */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Por modo
                </h2>
                {totalModeExtractions === 0 ? (
                  <p className="text-xs text-zinc-400">Sin datos aún.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats.extractions.byMode)
                      .sort((a, b) => b[1] - a[1])
                      .map(([mode, count]) => (
                        <HorizontalBar
                          key={mode}
                          label={MODE_LABELS[mode] ?? mode}
                          count={count}
                          total={totalModeExtractions}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* By Source */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Por fuente
                </h2>
                {totalSourceExtractions === 0 ? (
                  <p className="text-xs text-zinc-400">Sin datos aún.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats.extractions.bySourceType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([source, count]) => (
                        <HorizontalBar
                          key={source}
                          label={SOURCE_LABELS[source] ?? source}
                          count={count}
                          total={totalSourceExtractions}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tasks Progress */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
              <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Tareas
              </h2>
              {stats.tasks.total === 0 ? (
                <p className="text-xs text-zinc-400">No hay tareas registradas aún.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                      {taskPct}%
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {stats.tasks.completed} de {stats.tasks.total} completadas
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700 dark:bg-emerald-400"
                      style={{ width: `${taskPct}%` }}
                    />
                  </div>
                  <div className="flex gap-6 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {stats.tasks.completed}
                      </span>{' '}
                      completadas
                    </span>
                    <span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {stats.tasks.total - stats.tasks.completed}
                      </span>{' '}
                      pendientes
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
