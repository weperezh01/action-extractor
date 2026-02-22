'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getExtractionModeLabel, isExtractionMode } from '@/lib/extraction-modes'

type VerificationFilter = 'all' | 'verified' | 'unverified'
type BlockedFilter = 'all' | 'blocked' | 'active'

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

interface UserAiCostByModel {
  provider: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

interface UserAiCostDetail {
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_model: UserAiCostByModel[]
  by_use_type: Array<{ use_type: string; calls: number; cost_usd: number }>
}

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
  extraction: 'Extracción',
  chat: 'Chat',
  repair: 'Reparación JSON',
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface AdminUsersResponse {
  users: AdminUserItem[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
  filters: {
    query: string
    verification: VerificationFilter
    blocked: BlockedFilter
  }
  generated_at: string
}

interface AdminUserExtraction {
  id: string
  url: string
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  created_at: string
}

interface AdminUserExtractionsResponse {
  user: AdminUserItem
  extractions: AdminUserExtraction[]
  limit: number
}

function formatCurrencyUsd(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatDateTime(iso: string | null) {
  if (!iso) return 'N/A'
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

export default function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [verification, setVerification] = useState<VerificationFilter>('all')
  const [blocked, setBlocked] = useState<BlockedFilter>('all')

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<AdminUsersResponse | null>(null)

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailPayload, setDetailPayload] = useState<AdminUserExtractionsResponse | null>(null)
  const [costDetail, setCostDetail] = useState<UserAiCostDetail | null>(null)
  const [costLoading, setCostLoading] = useState(false)

  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)

  const hasLoadedUsersRef = useRef(false)

  const loadUsers = useCallback(async () => {
    setError(null)

    if (!hasLoadedUsersRef.current) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const params = new URLSearchParams({
        q: query,
        verification,
        blocked,
        limit: '200',
      })

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: 'no-store',
      })

      const data = (await res.json().catch(() => null)) as
        | (AdminUsersResponse & { error?: string })
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : res.status === 401
              ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
              : res.status === 403
                ? 'No tienes permisos de administrador.'
                : 'No se pudo cargar la lista de usuarios.'
        setError(message)
        return
      }

      if (!data?.users || !data.pagination) {
        setError('Respuesta inválida del servidor.')
        return
      }

      setPayload(data)
    } catch {
      setError('Error de conexión al cargar usuarios.')
    } finally {
      hasLoadedUsersRef.current = true
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [blocked, query, verification])

  const loadUserExtractions = useCallback(async (userId: string) => {
    setDetailError(null)
    setDetailLoading(true)

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/extractions?limit=50`, {
        cache: 'no-store',
      })

      const data = (await res.json().catch(() => null)) as
        | (AdminUserExtractionsResponse & { error?: string })
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudieron cargar las extracciones del usuario.'
        setDetailError(message)
        setDetailPayload(null)
        return
      }

      if (!data?.user || !Array.isArray(data.extractions)) {
        setDetailError('Respuesta inválida del servidor para detalle de usuario.')
        setDetailPayload(null)
        return
      }

      setDetailPayload(data)
    } catch {
      setDetailError('Error de conexión al cargar extracciones del usuario.')
      setDetailPayload(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadUsers()
    }, 200)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [loadUsers])

  const loadUserCostDetail = useCallback(async (userId: string) => {
    setCostLoading(true)
    setCostDetail(null)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/costs`, { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as (UserAiCostDetail & { error?: string }) | null
      if (res.ok && data && !data.error) {
        setCostDetail(data)
      }
    } catch {
      // silencioso — el panel de costo simplemente no muestra datos
    } finally {
      setCostLoading(false)
    }
  }, [])

  const handleSelectUser = useCallback(
    (userId: string) => {
      setSelectedUserId(userId)
      void loadUserExtractions(userId)
      void loadUserCostDetail(userId)
    },
    [loadUserExtractions, loadUserCostDetail]
  )

  const handleToggleBlock = useCallback(
    async (user: AdminUserItem) => {
      setError(null)
      setTogglingUserId(user.id)

      try {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            blocked: !user.blocked_at,
          }),
        })

        const data = (await res.json().catch(() => null)) as { error?: string } | null

        if (!res.ok) {
          setError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo actualizar el estado del usuario.'
          )
          return
        }

        await loadUsers()

        if (selectedUserId === user.id) {
          await loadUserExtractions(user.id)
        }
      } catch {
        setError('Error de conexión al actualizar el estado del usuario.')
      } finally {
        setTogglingUserId(null)
      }
    },
    [loadUserExtractions, loadUsers, selectedUserId]
  )

  const quickStats = useMemo(() => {
    const users = payload?.users ?? []
    return {
      totalVisible: users.length,
      blockedVisible: users.filter((user) => Boolean(user.blocked_at)).length,
      unverifiedVisible: users.filter((user) => !user.email_verified_at).length,
    }
  }, [payload])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Panel Admin</p>
            <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Ver métricas
            </Link>
            <Link
              href="/"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Volver al extractor
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Usuarios visibles</p>
            <p className="text-2xl font-bold mt-1">{quickStats.totalVisible}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">No verificados</p>
            <p className="text-2xl font-bold mt-1">{quickStats.unverifiedVisible}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Bloqueados</p>
            <p className="text-2xl font-bold mt-1">{quickStats.blockedVisible}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o email..."
            className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 text-sm bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <select
            value={verification}
            onChange={(event) => setVerification(event.target.value as VerificationFilter)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">Verificación: todos</option>
            <option value="verified">Solo verificados</option>
            <option value="unverified">Solo no verificados</option>
          </select>

          <select
            value={blocked}
            onChange={(event) => setBlocked(event.target.value as BlockedFilter)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">Estado: todos</option>
            <option value="active">Solo activos</option>
            <option value="blocked">Solo bloqueados</option>
          </select>

          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isRefreshing}
            className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-700"
          >
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {isLoading && !payload ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Usuario</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Registro</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Extracciones</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Llamadas IA</th>
                    <th className="px-4 py-3 text-right font-semibold text-indigo-600 dark:text-indigo-400">Costo IA</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(payload?.users ?? []).map((user) => {
                    const isSelected = selectedUserId === user.id
                    const isToggling = togglingUserId === user.id
                    const isBlocked = Boolean(user.blocked_at)

                    return (
                      <tr
                        key={user.id}
                        className={isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400 hover:underline"
                          >
                            {user.name}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{formatDateTime(user.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {isBlocked ? (
                              <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                Bloqueado
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                                Activo
                              </span>
                            )}
                            {user.email_verified_at ? (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Verificado
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                Sin verificar
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">{user.total_extractions}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-mono text-sm text-slate-700 dark:text-slate-300">{user.ai_calls}</p>
                          <p className="text-[10px] text-slate-400">{formatTokens(user.ai_input_tokens + user.ai_output_tokens)} tok</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={`font-mono text-sm font-semibold ${user.ai_cost_usd > 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400'}`}>
                            {user.ai_cost_usd > 0 ? formatCurrencyUsd(user.ai_cost_usd) : '$0.0000'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectUser(user.id)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                              Ver extracciones
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleBlock(user)}
                              disabled={isToggling}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:bg-slate-400 dark:disabled:bg-slate-700 ${
                                isBlocked
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-rose-600 hover:bg-rose-700'
                              }`}
                            >
                              {isToggling ? 'Guardando...' : isBlocked ? 'Desbloquear' : 'Bloquear'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {payload && payload.users.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                No hay usuarios para los filtros seleccionados.
              </p>
            )}
          </div>
        )}

        {payload && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando {payload.users.length} de {payload.pagination.total} usuarios.
          </p>
        )}

        {/* Cost detail panel — shown when a user is selected */}
        {selectedUserId && (costLoading || costDetail) && (
          <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 dark:border-indigo-800/50 dark:bg-indigo-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold text-indigo-900 dark:text-indigo-200">Consumo IA del usuario</h2>
                {detailPayload?.user && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {detailPayload.user.name} · {detailPayload.user.email}
                  </p>
                )}
              </div>
              {costLoading && (
                <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              )}
            </div>

            {costDetail && (
              <>
                {/* Summary row */}
                <div className="grid gap-3 sm:grid-cols-4 mb-4">
                  <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900">
                    <p className="text-[10px] uppercase text-slate-400 font-semibold">Costo total</p>
                    <p className={`text-xl font-bold mt-0.5 ${costDetail.total_cost_usd > 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400'}`}>
                      {formatCurrencyUsd(costDetail.total_cost_usd)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900">
                    <p className="text-[10px] uppercase text-slate-400 font-semibold">Llamadas API</p>
                    <p className="text-xl font-bold mt-0.5 text-slate-800 dark:text-slate-100">{costDetail.total_calls}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900">
                    <p className="text-[10px] uppercase text-slate-400 font-semibold">Tokens entrada</p>
                    <p className="text-xl font-bold mt-0.5 text-slate-800 dark:text-slate-100">{formatTokens(costDetail.total_input_tokens)}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900">
                    <p className="text-[10px] uppercase text-slate-400 font-semibold">Tokens salida</p>
                    <p className="text-xl font-bold mt-0.5 text-slate-800 dark:text-slate-100">{formatTokens(costDetail.total_output_tokens)}</p>
                  </div>
                </div>

                {costDetail.total_calls === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Este usuario aún no ha generado llamadas a la IA desde que se activó el tracking.
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* By model */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Desglose por modelo</p>
                      <div className="space-y-2">
                        {costDetail.by_model.map((m) => {
                          const providerColor = PROVIDER_COLORS[m.provider] ?? '#6366f1'
                          const pct = costDetail.total_cost_usd > 0 ? (m.cost_usd / costDetail.total_cost_usd) * 100 : 0
                          return (
                            <div key={`${m.provider}-${m.model}`} className="rounded-lg border border-slate-100 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-medium text-slate-700 dark:text-slate-200">
                                  {MODEL_LABELS[m.model] ?? m.model}
                                </span>
                                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                                  {formatCurrencyUsd(m.cost_usd)}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-1.5">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.max(2, pct)}%`, backgroundColor: providerColor }}
                                />
                              </div>
                              <div className="flex gap-3 text-[10px] text-slate-400">
                                <span style={{ color: providerColor }}>{m.provider}</span>
                                <span>{m.calls} calls</span>
                                <span>↑{formatTokens(m.input_tokens)}</span>
                                <span>↓{formatTokens(m.output_tokens)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* By use type */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por tipo de uso</p>
                      <div className="space-y-2">
                        {costDetail.by_use_type.map((t) => (
                          <div key={t.use_type} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {USE_TYPE_LABELS[t.use_type] ?? t.use_type}
                              </p>
                              <p className="text-xs text-slate-400">{t.calls} llamadas</p>
                            </div>
                            <p className="font-mono font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {formatCurrencyUsd(t.cost_usd)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* ROI hint */}
                      {costDetail.total_cost_usd > 0 && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Punto de equilibrio</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Para cubrir costos, este usuario debería pagar al menos{' '}
                            <span className="font-bold">{formatCurrencyUsd(costDetail.total_cost_usd)}</span>.
                            Con un margen del 3×: <span className="font-bold">{formatCurrencyUsd(costDetail.total_cost_usd * 3)}</span>/período.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold">Extracciones por usuario</h2>
            {detailPayload?.user && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Usuario: {detailPayload.user.name} ({detailPayload.user.email})
              </p>
            )}
          </div>

          {!selectedUserId && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecciona un usuario en la tabla para ver sus extracciones.
            </p>
          )}

          {selectedUserId && detailLoading && (
            <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400 rounded-full animate-spin" />
          )}

          {selectedUserId && detailError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {detailError}
            </div>
          )}

          {selectedUserId && detailPayload && detailPayload.extractions.length === 0 && !detailLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Este usuario no tiene extracciones registradas.</p>
          )}

          {selectedUserId && detailPayload && detailPayload.extractions.length > 0 && (
            <div className="space-y-3">
              {detailPayload.extractions.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  {item.thumbnail_url ? (
                    <div className="relative w-[72px] h-[44px]">
                      <Image
                        src={item.thumbnail_url}
                        alt={item.video_title ?? 'Miniatura'}
                        fill
                        sizes="72px"
                        className="rounded object-cover border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  ) : (
                    <div className="w-[72px] h-[44px] rounded bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700" />
                  )}

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.video_title || item.objective || 'Extracción'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.url}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700">
                        {resolveModeLabel(item.extraction_mode)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
