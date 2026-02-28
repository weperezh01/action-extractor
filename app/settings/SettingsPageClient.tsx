'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface AccountUser {
  id: string
  name: string
  email: string
}

interface RateLimitSnapshot {
  limit: number
  used: number
  remaining: number
  resetAt: string
  retryAfterSeconds: number
}

interface AccountPayload {
  user: AccountUser
  rateLimit: RateLimitSnapshot
}

interface PlanSnapshot {
  plan: string
  extractionsPerHour: number
  status: string
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
}

interface AiUsageTotals {
  calls: number
  totalTokens: number
  costUsd: number
}

interface AiUseTypeEntry {
  useType: string
  label: string
  calls: number
  costUsd: number
}

interface AiDailyStat {
  date: string
  calls: number
  tokens: number
  costUsd: number
}

interface AiUsagePayload {
  totals: AiUsageTotals
  byUseType: AiUseTypeEntry[]
  daily: AiDailyStat[]
}

function formatDateTime(iso: string) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function AiDailyBarChart({ data }: { data: AiDailyStat[] }) {
  // Build a full 30-day array filling missing days with 0
  const days = 30
  const today = new Date()
  const fullDays: { date: string; calls: number }[] = []
  const dataMap = new Map(data.map((d) => [d.date, d]))

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const entry = dataMap.get(dateStr)
    fullDays.push({ date: dateStr, calls: entry?.calls ?? 0 })
  }

  const maxCalls = Math.max(1, ...fullDays.map((d) => d.calls))

  return (
    <div className="flex items-end gap-0.5 h-16">
      {fullDays.map((day) => {
        const heightPct = Math.max(4, Math.round((day.calls / maxCalls) * 100))
        const shortDate = day.date.slice(5) // MM-DD
        return (
          <div
            key={day.date}
            className="group relative flex-1"
            title={`${shortDate}: ${day.calls} llamadas`}
          >
            <div
              className={`w-full rounded-sm transition-colors ${
                day.calls > 0
                  ? 'bg-indigo-400 group-hover:bg-indigo-500 dark:bg-indigo-500 dark:group-hover:bg-indigo-400'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
              style={{ height: `${heightPct}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function SettingsPageClient() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshingRateLimit, setRefreshingRateLimit] = useState(false)
  const [account, setAccount] = useState<AccountPayload | null>(null)

  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)

  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const [aiUsage, setAiUsage] = useState<AiUsagePayload | null>(null)
  const [aiUsageLoading, setAiUsageLoading] = useState(false)

  const [planSnapshot, setPlanSnapshot] = useState<PlanSnapshot | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)

  const loadAccount = useCallback(
    async (showLoader: boolean) => {
      if (showLoader) {
        setLoading(true)
      } else {
        setRefreshingRateLimit(true)
      }

      try {
        const res = await fetch('/api/account', { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as
          | (AccountPayload & { error?: unknown })
          | null

        if (res.status === 401) {
          router.replace('/')
          return
        }

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo cargar la configuración de cuenta.'
          setPageError(message)
          return
        }

        if (!data?.user || !data?.rateLimit) {
          setPageError('Respuesta inválida del servidor.')
          return
        }

        setAccount({ user: data.user, rateLimit: data.rateLimit })
        setNameInput(data.user.name)
        setDeleteEmail(data.user.email)
      } catch {
        setPageError('Error de conexión al cargar la configuración de cuenta.')
      } finally {
        setLoading(false)
        setRefreshingRateLimit(false)
      }
    },
    [router]
  )

  useEffect(() => {
    void loadAccount(true)
  }, [loadAccount])

  const loadAiUsage = useCallback(async () => {
    if (aiUsageLoading) return
    setAiUsageLoading(true)
    try {
      const res = await fetch('/api/account/usage', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json().catch(() => null)) as AiUsagePayload | null
      if (data) setAiUsage(data)
    } catch {
      // ignore — section just won't show data
    } finally {
      setAiUsageLoading(false)
    }
  }, [aiUsageLoading])

  useEffect(() => {
    void loadAiUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetch('/api/account/plan', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlanSnapshot | null) => {
        if (data) setPlanSnapshot(data)
      })
      .catch(() => undefined)
  }, [])

  const rateLimitPercent = useMemo(() => {
    const limit = account?.rateLimit.limit ?? 0
    const used = account?.rateLimit.used ?? 0
    if (limit <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((used / limit) * 100)))
  }, [account?.rateLimit.limit, account?.rateLimit.used])

  const handleUpdateName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!account || savingName) return

    const nextName = nameInput.trim()
    if (nextName.length < 2) {
      setPageError('Nombre inválido (mínimo 2 caracteres).')
      return
    }

    setPageError(null)
    setPageNotice(null)
    setSavingName(true)

    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })

      const data = (await res.json().catch(() => null)) as
        | { user?: AccountUser; error?: unknown }
        | null

      if (res.status === 401) {
        router.replace('/')
        return
      }

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo actualizar el nombre.'
        setPageError(message)
        return
      }

      if (data?.user) {
        setAccount((previous) =>
          previous
            ? {
                ...previous,
                user: data.user as AccountUser,
              }
            : previous
        )
      }

      setNameInput(nextName)
      setPageNotice('Nombre actualizado correctamente.')
    } catch {
      setPageError('Error de conexión al actualizar el nombre.')
    } finally {
      setSavingName(false)
    }
  }

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!account || savingPassword) return

    if (newPassword.trim().length < 8) {
      setPageError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPageError('La confirmación de contraseña no coincide.')
      return
    }

    setPageError(null)
    setPageNotice(null)
    setSavingPassword(true)

    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (res.status === 401) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'Tu sesión expiró. Vuelve a iniciar sesión.'

        if (message.toLowerCase().includes('sesión')) {
          router.replace('/')
          return
        }

        setPageError(message)
        return
      }

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo actualizar la contraseña.'
        setPageError(message)
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setPageNotice('Contraseña actualizada correctamente.')
    } catch {
      setPageError('Error de conexión al actualizar la contraseña.')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!account || deletingAccount) return

    if (deleteEmail.trim().toLowerCase() !== account.user.email.toLowerCase()) {
      setPageError('Debes escribir el correo exacto de tu cuenta para confirmar.')
      return
    }

    if (deleteConfirmation.trim() !== 'ELIMINAR') {
      setPageError('Debes escribir ELIMINAR para confirmar.')
      return
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Esta acción eliminará tu cuenta y todos tus datos. No se puede deshacer. ¿Deseas continuar?'
      )
      if (!confirmed) return
    }

    setPageError(null)
    setPageNotice(null)
    setDeletingAccount(true)

    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: deleteEmail,
          confirmationText: deleteConfirmation,
          password: deletePassword,
        }),
      })

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo eliminar la cuenta.'
        setPageError(message)
        return
      }

      router.replace('/?account_deleted=1')
    } catch {
      setPageError('Error de conexión al eliminar la cuenta.')
    } finally {
      setDeletingAccount(false)
    }
  }

  const handleManageBilling = async () => {
    setOpeningPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as { url?: string } | null
      if (res.ok && data?.url) {
        window.location.href = data.url
      }
    } catch {
      // ignore
    } finally {
      setOpeningPortal(false)
    }
  }

  function formatPlanDate(iso: string | null) {
    if (!iso) return ''
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(iso))
  }

  const planLabel = planSnapshot ? planSnapshot.plan.charAt(0).toUpperCase() + planSnapshot.plan.slice(1) : 'Free'
  const planBadgeClass =
    planSnapshot?.plan === 'business'
      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
      : planSnapshot?.plan === 'pro'
      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400 rounded-full animate-spin" />
        </div>
      </main>
    )
  }

  if (!account) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700">
            ← Volver al extractor
          </Link>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {pageError ?? 'No se pudo cargar la cuenta.'}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Cuenta
            </p>
            <h1 className="text-2xl font-bold">Configuración de Cuenta</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Administra tu perfil, contraseña, consumo y privacidad.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Volver al extractor
            </Link>
          </div>
        </div>

        {pageNotice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {pageNotice}
          </div>
        )}

        {pageError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {pageError}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold mb-4">Perfil</h2>
          <form className="space-y-4" onSubmit={handleUpdateName}>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Correo</label>
              <input
                type="email"
                value={account.user.email}
                disabled
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-100 px-3 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Nombre</label>
              <input
                type="text"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                minLength={2}
                maxLength={80}
                required
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={savingName}
              className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {savingName ? 'Guardando...' : 'Guardar nombre'}
            </button>
          </form>
        </section>

        {/* Plan Actual */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold">Plan Actual</h2>
            <Link
              href="/pricing"
              className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Ver planes →
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${planBadgeClass}`}>
              {planLabel}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {planSnapshot?.extractionsPerHour ?? 12} extracciones / hora
            </span>
            {planSnapshot?.currentPeriodEnd && planSnapshot.plan !== 'free' && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                · Renueva el {formatPlanDate(planSnapshot.currentPeriodEnd)}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 inline-flex items-center"
            >
              Cambiar plan
            </Link>
            {planSnapshot?.hasStripeCustomer && planSnapshot.plan !== 'free' && (
              <button
                type="button"
                onClick={() => void handleManageBilling()}
                disabled={openingPortal}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {openingPortal ? 'Abriendo...' : 'Gestionar facturación'}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold">Consumo Actual</h2>
            <button
              type="button"
              onClick={() => void loadAccount(false)}
              disabled={refreshingRateLimit}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              {refreshingRateLimit ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {account.rateLimit.used} / {account.rateLimit.limit} extracciones usadas
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Restantes: {account.rateLimit.remaining}
              </p>
            </div>

            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${rateLimitPercent}%` }}
              />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              El límite se reinicia: {formatDateTime(account.rateLimit.resetAt)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold mb-1">Exportar Historial</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Descarga todos tus playbooks en formato JSON o CSV.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/account/export?format=json"
              download
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Descargar JSON
            </a>
            <a
              href="/api/account/export?format=csv"
              download
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Descargar CSV
            </a>
          </div>
        </section>

        {/* Consumo de IA */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-semibold">Consumo de IA</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tokens y costo estimado de todas tus llamadas a IA.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAiUsage()}
              disabled={aiUsageLoading}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              {aiUsageLoading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>

          {aiUsageLoading && !aiUsage && (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-400 dark:text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
              Cargando datos de consumo...
            </div>
          )}

          {aiUsage && (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Llamadas totales</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {aiUsage.totals.calls.toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tokens usados</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {aiUsage.totals.totalTokens >= 1000
                      ? `${(aiUsage.totals.totalTokens / 1000).toFixed(1)}k`
                      : aiUsage.totals.totalTokens.toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Costo estimado</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                    ${aiUsage.totals.costUsd < 0.01 && aiUsage.totals.costUsd > 0
                      ? aiUsage.totals.costUsd.toFixed(4)
                      : aiUsage.totals.costUsd.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">USD</p>
                </div>
              </div>

              {/* Bar chart — últimos 30 días */}
              {aiUsage.daily.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                    Llamadas — últimos 30 días
                  </p>
                  <AiDailyBarChart data={aiUsage.daily} />
                </div>
              )}

              {/* Breakdown por tipo */}
              {aiUsage.byUseType.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Por tipo de uso
                  </p>
                  <ul className="space-y-2">
                    {aiUsage.byUseType.map((entry) => (
                      <li key={entry.useType} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">{entry.label}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {entry.calls.toLocaleString('es-MX')} llamadas
                          <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                            (${Number(entry.costUsd).toFixed(4)} USD)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiUsage.totals.calls === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Aún no hay registros de uso de IA.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold mb-4">Cambiar Contraseña</h2>
          <form className="space-y-4" onSubmit={handleUpdatePassword}>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
                Contraseña actual (opcional)
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Ingresa tu contraseña actual para mayor seguridad"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  required
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
                  Confirmar nueva contraseña
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  minLength={8}
                  required
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {savingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-rose-300 bg-rose-50 p-5 shadow-sm dark:border-rose-900 dark:bg-rose-950/30">
          <h2 className="text-base font-semibold text-rose-800 dark:text-rose-300 mb-2">Zona de Peligro</h2>
          <p className="text-sm text-rose-700 dark:text-rose-400 mb-4">
            Eliminar tu cuenta borrará historial, integraciones y datos asociados. Esta acción no se puede deshacer.
          </p>

          <form className="space-y-4" onSubmit={handleDeleteAccount}>
            <div>
              <label className="block text-sm text-rose-700 dark:text-rose-400 mb-1.5">
                Confirma tu correo
              </label>
              <input
                type="email"
                value={deleteEmail}
                onChange={(event) => setDeleteEmail(event.target.value)}
                required
                className="w-full h-11 rounded-lg border border-rose-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:border-rose-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm text-rose-700 dark:text-rose-400 mb-1.5">
                Escribe ELIMINAR para confirmar
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                required
                className="w-full h-11 rounded-lg border border-rose-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:border-rose-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm text-rose-700 dark:text-rose-400 mb-1.5">
                Contraseña actual (opcional)
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                className="w-full h-11 rounded-lg border border-rose-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:border-rose-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={deletingAccount}
              className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {deletingAccount ? 'Eliminando cuenta...' : 'Eliminar cuenta permanentemente'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
