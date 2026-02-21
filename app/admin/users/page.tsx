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

  const handleSelectUser = useCallback(
    (userId: string) => {
      setSelectedUserId(userId)
      void loadUserExtractions(userId)
    },
    [loadUserExtractions]
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
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Verificación</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Estado</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Extracciones</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Última extracción</th>
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
                          <p className="font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDateTime(user.created_at)}</td>
                        <td className="px-4 py-3">
                          {user.email_verified_at ? (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              Verificado
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              No verificado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isBlocked ? (
                            <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                              Bloqueado
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              Activo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{user.total_extractions}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {formatDateTime(user.last_extraction_at)}
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
