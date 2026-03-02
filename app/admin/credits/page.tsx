'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminCreditStats {
  total_credits_in_circulation: number
  users_with_credits: number
  total_purchases_alltime: number
  total_purchases_30d: number
  credits_purchased_30d: number
}

interface AdminUserCreditRow {
  user_id: string
  user_name: string
  user_email: string
  extra_credits: number
  plan: string
  total_purchased: number
  last_purchase_at: string | null
}

interface AdminRecentTransaction {
  id: string
  user_id: string
  user_name: string
  user_email: string
  amount: number
  reason: string
  stripe_session_id: string | null
  created_at: string
}

interface AdminCreditsResponse {
  stats: AdminCreditStats
  users: AdminUserCreditRow[]
  transactions: AdminRecentTransaction[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null) {
  if (!iso) return 'N/A'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  starter: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  pro: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  business: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

const REASON_LABELS: Record<string, string> = {
  purchase: 'Compra Stripe',
  manual_admin: 'Manual (admin)',
  promo: 'Promoción',
}

// ── Add credits modal ─────────────────────────────────────────────────────────

function AddCreditsForm({
  prefillUserId,
  prefillUserEmail,
  onSuccess,
  onCancel,
}: {
  prefillUserId?: string
  prefillUserEmail?: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [userId, setUserId] = useState(prefillUserId ?? '')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('manual_admin')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const numAmount = Number.parseInt(amount, 10)
    if (!userId.trim()) { setError('Ingresa el ID del usuario.'); return }
    if (!Number.isFinite(numAmount) || numAmount <= 0) { setError('Ingresa una cantidad válida (> 0).'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), amount: numAmount, reason }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Error al agregar créditos.')
        return
      }
      onSuccess()
    } catch {
      setError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold mb-1">Agregar créditos</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Los créditos se suman al balance existente del usuario.
        </p>
        {prefillUserEmail && (
          <p className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200">
            Usuario: <span className="font-semibold">{prefillUserEmail}</span>
          </p>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {!prefillUserId && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                ID del usuario
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_..."
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Créditos a agregar
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5"
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Razón
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="manual_admin">Manual (admin)</option>
              <option value="promo">Promoción</option>
              <option value="refund">Reembolso</option>
              <option value="compensation">Compensación</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 transition-colors"
            >
              {saving ? 'Guardando...' : 'Agregar créditos'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-10 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCreditsPage() {
  const [payload, setPayload] = useState<AdminCreditsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [prefillUser, setPrefillUser] = useState<{ id: string; email: string } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/credits', { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as (AdminCreditsResponse & { error?: string }) | null
      if (!res.ok || !data) {
        setError(typeof data?.error === 'string' ? data.error : 'Error al cargar.')
        return
      }
      setPayload(data)
    } catch {
      setError('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleOpenAdd = (user?: { id: string; email: string }) => {
    setPrefillUser(user ?? null)
    setShowAddModal(true)
  }

  const handleAddSuccess = () => {
    setShowAddModal(false)
    setPrefillUser(null)
    void load()
  }

  const stats = payload?.stats

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Panel Admin</p>
            <h1 className="text-2xl font-bold">Gestión de Créditos</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAdd()}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              + Agregar créditos
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Actualizar
            </button>
            <Link
              href="/admin/plans"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Planes
            </Link>
            <Link
              href="/admin/users"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Usuarios
            </Link>
            <Link
              href="/admin/prompts"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Prompts
            </Link>
            <Link
              href="/admin"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Métricas
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && !payload && (
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 py-8">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            Cargando datos de créditos...
          </div>
        )}

        {/* KPI Cards */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Créditos en circulación</p>
              <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{stats.total_credits_in_circulation}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Usuarios con créditos</p>
              <p className="text-3xl font-bold">{stats.users_with_credits}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Compras (alltime)</p>
              <p className="text-3xl font-bold">{stats.total_purchases_alltime}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Compras (30d)</p>
              <p className="text-3xl font-bold">{stats.total_purchases_30d}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Créditos comprados (30d)</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.credits_purchased_30d}</p>
            </div>
          </div>
        )}

        {/* Users with credits */}
        {payload && (
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold">Usuarios con créditos / historial de compra</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{payload.users.length} usuarios</span>
            </div>
            {payload.users.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                Ningún usuario tiene créditos extra en este momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase">Usuario</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase">Plan</th>
                      <th className="px-4 py-3 text-right font-semibold text-indigo-600 dark:text-indigo-400 text-xs uppercase">Créditos</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase">Total comprado</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase">Última compra</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payload.users.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/users/${u.user_id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400 hover:underline"
                          >
                            {u.user_name}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{u.user_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_BADGE[u.plan] ?? PLAN_BADGE.free}`}>
                            {u.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono font-bold text-base ${u.extra_credits > 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400'}`}>
                            {u.extra_credits}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {u.total_purchased > 0 ? u.total_purchased : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(u.last_purchase_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAdd({ id: u.user_id, email: u.user_email })}
                            className="px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 text-xs font-medium hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40 transition-colors"
                          >
                            + Créditos
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Recent transactions */}
        {payload && (
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold">Últimas transacciones de créditos</h2>
            </div>
            {payload.transactions.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                No hay transacciones de créditos aún.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase">Usuario</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase">Créditos</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase">Razón</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase">Stripe Session</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payload.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/users/${tx.user_id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400 hover:underline"
                          >
                            {tx.user_name}
                          </Link>
                          <p className="text-xs text-slate-400">{tx.user_email}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-mono font-bold ${tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.reason === 'purchase'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {REASON_LABELS[tx.reason] ?? tx.reason}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-400 max-w-[140px] truncate">
                          {tx.stripe_session_id ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(tx.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddCreditsForm
          prefillUserId={prefillUser?.id}
          prefillUserEmail={prefillUser?.email}
          onSuccess={handleAddSuccess}
          onCancel={() => { setShowAddModal(false); setPrefillUser(null) }}
        />
      )}
    </main>
  )
}
