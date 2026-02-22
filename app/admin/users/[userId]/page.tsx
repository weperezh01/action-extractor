'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminUserItem {
  id: string
  name: string
  email: string
  created_at: string
  email_verified_at: string | null
  blocked_at: string | null
  total_extractions: number
  last_extraction_at: string | null
  ai_calls: number
  ai_input_tokens: number
  ai_output_tokens: number
  ai_cost_usd: number
}

interface MonthStat {
  month: string
  month_label: string
  ai_calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  extractions: number
}

interface CostByModel {
  provider: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

interface CostDetail {
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_model: CostByModel[]
  by_use_type: Array<{ use_type: string; calls: number; cost_usd: number }>
}

interface UserMonthlyPayload {
  user: AdminUserItem
  monthly: { user_id: string; months: MonthStat[] }
  costDetail: CostDetail
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#d97706',
  openai: '#10b981',
  google: '#3b82f6',
}

const USE_TYPE_LABELS: Record<string, string> = {
  extraction: 'Extracción de video',
  chat: 'Chat de conocimiento',
  repair: 'Reparación JSON',
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatUsd(value: number, decimals = 4) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(iso: string | null) {
  if (!iso) return 'N/A'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(d)
}

// ─── Sparkbar chart (monthly costs) ──────────────────────────────────────────

function MonthlyBarChart({ months }: { months: MonthStat[] }) {
  if (months.length === 0) return null
  const maxCost = Math.max(...months.map((m) => m.cost_usd), 0.000001)

  return (
    <div className="flex items-end gap-1 h-24 w-full">
      {months.map((m) => {
        const heightPct = Math.max(4, (m.cost_usd / maxCost) * 100)
        const hasData = m.cost_usd > 0
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${heightPct}%`,
                backgroundColor: hasData ? '#6366f1' : '#e2e8f0',
              }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <p className="font-semibold text-slate-700 dark:text-slate-200">{m.month_label}</p>
              <p className="text-indigo-600 dark:text-indigo-400">{formatUsd(m.cost_usd)}</p>
              <p className="text-slate-500">{m.extractions} extr · {m.ai_calls} calls</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function UserDetailPage({ params }: { params: { userId: string } }) {
  const { userId } = params
  const [payload, setPayload] = useState<UserMonthlyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/monthly`, {
          cache: 'no-store',
        })
        const data = (await res.json().catch(() => null)) as (UserMonthlyPayload & { error?: string }) | null
        if (!res.ok || !data) {
          setError(typeof data?.error === 'string' ? data.error : 'Error al cargar el usuario.')
          return
        }
        setPayload(data)
      } catch {
        setError('Error de conexión.')
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </main>
    )
  }

  if (error || !payload) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-10 text-slate-900 dark:text-slate-100">
        <div className="mx-auto max-w-5xl space-y-4">
          <Link href="/admin/users" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            ← Volver a usuarios
          </Link>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error ?? 'Usuario no encontrado.'}
          </div>
        </div>
      </main>
    )
  }

  const { user, monthly, costDetail } = payload
  const months = monthly.months
  const isBlocked = Boolean(user.blocked_at)

  // Current month (last in list)
  const currentMonth = months.at(-1)
  // Previous month
  const prevMonth = months.at(-2)

  // MoM change
  const momChange =
    prevMonth && prevMonth.cost_usd > 0
      ? ((currentMonth?.cost_usd ?? 0) - prevMonth.cost_usd) / prevMonth.cost_usd * 100
      : null

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* ── Breadcrumb ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/admin" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Admin
            </Link>
            <span className="text-slate-400">/</span>
            <Link href="/admin/users" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Usuarios
            </Link>
            <span className="text-slate-400">/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{user.name}</span>
          </div>
          <Link
            href="/admin/users"
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            ← Volver
          </Link>
        </div>

        {/* ── User profile header ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xl font-bold text-indigo-700 dark:text-indigo-300">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold">{user.name}</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${
                  isBlocked
                    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                }`}>
                  {isBlocked ? 'Bloqueado' : 'Activo'}
                </span>
                {user.email_verified_at ? (
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Email verificado
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Sin verificar
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 text-right">
              <p>Registrado: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(user.created_at)}</span></p>
              <p>Última extracción: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(user.last_extraction_at)}</span></p>
              <p>ID: <span className="font-mono text-[10px] text-slate-400">{user.id}</span></p>
            </div>
          </div>
        </div>

        {/* ── Lifetime KPIs ── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Costo total (lifetime)</p>
            <p className={`text-2xl font-bold ${user.ai_cost_usd > 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400'}`}>
              {formatUsd(user.ai_cost_usd)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Extracciones totales</p>
            <p className="text-2xl font-bold">{user.total_extractions}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Llamadas IA totales</p>
            <p className="text-2xl font-bold">{user.ai_calls}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{formatTokens(user.ai_input_tokens + user.ai_output_tokens)} tokens</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Costo promedio/extracción</p>
            <p className="text-2xl font-bold">
              {user.total_extractions > 0 && user.ai_cost_usd > 0
                ? formatUsd(user.ai_cost_usd / user.total_extractions)
                : '$0.0000'}
            </p>
          </div>
        </div>

        {/* ── Monthly breakdown ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-semibold">Costo por mes</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Alineado a tu ciclo de facturación mensual
              </p>
            </div>
            {currentMonth && (
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Mes actual ({currentMonth.month_label})</p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{formatUsd(currentMonth.cost_usd)}</p>
                {momChange !== null && (
                  <p className={`text-xs font-medium ${momChange >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {momChange >= 0 ? '▲' : '▼'} {Math.abs(momChange).toFixed(1)}% vs mes anterior
                  </p>
                )}
              </div>
            )}
          </div>

          {months.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No hay datos históricos para este usuario aún.
            </p>
          ) : (
            <>
              {/* Bar chart */}
              <div className="mb-1">
                <MonthlyBarChart months={months} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-5">
                <span>{months[0]?.month_label}</span>
                <span>{months.at(-1)?.month_label}</span>
              </div>

              {/* Monthly table */}
              <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Mes</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Extracciones</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Llamadas IA</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Tok. entrada</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Tok. salida</th>
                      <th className="px-3 py-2 text-right font-semibold text-indigo-600 dark:text-indigo-400 uppercase">Costo IA</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Precio sugerido (3×)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...months].reverse().map((m, idx) => {
                      const suggested = m.cost_usd * 3
                      const isCurrentMonth = idx === 0
                      return (
                        <tr
                          key={m.month}
                          className={`border-b border-slate-50 dark:border-slate-800/50 ${
                            isCurrentMonth
                              ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                            {m.month_label}
                            {isCurrentMonth && (
                              <span className="ml-2 text-[9px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                                actual
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{m.extractions}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{m.ai_calls}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-500 dark:text-slate-500">{formatTokens(m.input_tokens)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-500 dark:text-slate-500">{formatTokens(m.output_tokens)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                            {m.cost_usd > 0 ? formatUsd(m.cost_usd) : <span className="text-slate-400">$0.0000</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                            {suggested > 0 ? formatUsd(suggested, 2) : <span className="text-slate-400">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {months.length > 1 && (
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold border-t border-slate-200 dark:border-slate-700">
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">Total lifetime</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                          {months.reduce((s, m) => s + m.extractions, 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                          {months.reduce((s, m) => s + m.ai_calls, 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {formatTokens(months.reduce((s, m) => s + m.input_tokens, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {formatTokens(months.reduce((s, m) => s + m.output_tokens, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-indigo-700 dark:text-indigo-300">
                          {formatUsd(months.reduce((s, m) => s + m.cost_usd, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                          {formatUsd(months.reduce((s, m) => s + m.cost_usd, 0) * 3, 2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Pricing context note */}
              <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                * "Precio sugerido (3×)" es el mínimo recomendado para cubrir costos de IA con margen operativo básico. Ajusta según tu modelo de negocio.
              </p>
            </>
          )}
        </div>

        {/* ── Lifetime model breakdown ── */}
        {costDetail.by_model.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold mb-4">Desglose por modelo (lifetime)</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {/* By model */}
              <div className="space-y-3">
                {costDetail.by_model.map((m) => {
                  const color = PROVIDER_COLORS[m.provider] ?? '#6366f1'
                  const pct = costDetail.total_cost_usd > 0 ? (m.cost_usd / costDetail.total_cost_usd) * 100 : 0
                  return (
                    <div key={`${m.provider}-${m.model}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {MODEL_LABELS[m.model] ?? m.model}
                        </span>
                        <span className="font-mono font-semibold">{formatUsd(m.cost_usd)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, backgroundColor: color }} />
                      </div>
                      <div className="flex gap-3 text-[10px] text-slate-400">
                        <span style={{ color }}>{m.provider}</span>
                        <span>{m.calls} calls</span>
                        <span>↑{formatTokens(m.input_tokens)} ↓{formatTokens(m.output_tokens)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* By use type */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por tipo de uso</p>
                {costDetail.by_use_type.map((t) => (
                  <div key={t.use_type} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 p-2.5">
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {USE_TYPE_LABELS[t.use_type] ?? t.use_type}
                      </p>
                      <p className="text-[10px] text-slate-400">{t.calls} llamadas</p>
                    </div>
                    <p className="font-mono text-xs font-semibold">{formatUsd(t.cost_usd)}</p>
                  </div>
                ))}

                {costDetail.total_cost_usd > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Punto de equilibrio mensual</p>
                    {currentMonth ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Este mes ha costado <span className="font-bold">{formatUsd(currentMonth.cost_usd)}</span>.
                        Para ser rentable con margen 3×:{' '}
                        <span className="font-bold">{formatUsd(currentMonth.cost_usd * 3, 2)}</span>/mes.
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Costo lifetime: <span className="font-bold">{formatUsd(costDetail.total_cost_usd)}</span>.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
