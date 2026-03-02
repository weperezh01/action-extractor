'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Loader2, Plus, X } from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'
import { t } from '@/app/home/lib/i18n'

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
  const { lang } = useLang()

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

  const [notifPrefs, setNotifPrefs] = useState<{
    notifyTaskStatusChange: boolean
    notifyNewComment: boolean
  } | null>(null)
  const [savingNotif, setSavingNotif] = useState(false)

  // Workspaces
  interface WorkspaceItem {
    id: string
    name: string
    slug: string
    avatar_color: string
    description: string | null
    role: string
    member_count: number
  }
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [wsLoading, setWsLoading] = useState(false)
  const [showCreateWs, setShowCreateWs] = useState(false)
  const [wsName, setWsName] = useState('')
  const [wsColor, setWsColor] = useState('indigo')
  const [creatingWs, setCreatingWs] = useState(false)
  const [wsCreateError, setWsCreateError] = useState<string | null>(null)

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
              : t(lang, 'settings.loadError')
          setPageError(message)
          return
        }

        if (!data?.user || !data?.rateLimit) {
          setPageError(t(lang, 'settings.invalidResponse'))
          return
        }

        setAccount({ user: data.user, rateLimit: data.rateLimit })
        setNameInput(data.user.name)
        setDeleteEmail(data.user.email)
      } catch {
        setPageError(t(lang, 'settings.connectionError'))
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

  useEffect(() => {
    fetch('/api/account/notifications', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { notifyTaskStatusChange: boolean; notifyNewComment: boolean } | null) => {
        if (data) setNotifPrefs(data)
      })
      .catch(() => undefined)
  }, [])

  const handleToggleNotif = async (key: 'notifyTaskStatusChange' | 'notifyNewComment') => {
    if (!notifPrefs || savingNotif) return
    const next = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(next)
    setSavingNotif(true)
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      if (!res.ok) {
        // Revert on error
        setNotifPrefs(notifPrefs)
      }
    } catch {
      setNotifPrefs(notifPrefs)
    } finally {
      setSavingNotif(false)
    }
  }

  const loadWorkspaces = useCallback(async () => {
    setWsLoading(true)
    try {
      const res = await fetch('/api/workspaces', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(data.workspaces ?? [])
      }
    } catch { /* ignore */ } finally {
      setWsLoading(false)
    }
  }, [])

  useEffect(() => { void loadWorkspaces() }, [loadWorkspaces])

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wsName.trim()) return
    setCreatingWs(true)
    setWsCreateError(null)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsName.trim(), avatarColor: wsColor }),
      })
      const data = await res.json()
      if (!res.ok) { setWsCreateError(data.error ?? 'Error al crear.'); return }
      setWsName('')
      setWsColor('indigo')
      setShowCreateWs(false)
      void loadWorkspaces()
    } finally {
      setCreatingWs(false)
    }
  }

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
      setPageError(t(lang, 'settings.nameInvalid'))
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
            : t(lang, 'settings.nameUpdateError')
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
      setPageNotice(t(lang, 'settings.nameUpdated'))
    } catch {
      setPageError(t(lang, 'settings.nameUpdateConnectionError'))
    } finally {
      setSavingName(false)
    }
  }

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!account || savingPassword) return

    if (newPassword.trim().length < 8) {
      setPageError(t(lang, 'settings.passwordTooShort'))
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPageError(t(lang, 'settings.passwordMismatch'))
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
            : t(lang, 'settings.sessionExpired')

        if (message.toLowerCase().includes('sesión') || message.toLowerCase().includes('session')) {
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
            : t(lang, 'settings.passwordUpdateError')
        setPageError(message)
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setPageNotice(t(lang, 'settings.passwordUpdated'))
    } catch {
      setPageError(t(lang, 'settings.passwordUpdateConnectionError'))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!account || deletingAccount) return

    if (deleteEmail.trim().toLowerCase() !== account.user.email.toLowerCase()) {
      setPageError(t(lang, 'settings.emailMismatch'))
      return
    }

    if (deleteConfirmation.trim() !== 'ELIMINAR' && deleteConfirmation.trim() !== 'ELIMINATE') {
      setPageError(t(lang, 'settings.eliminateConfirm'))
      return
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(t(lang, 'settings.deleteConfirmDialog'))
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
            : t(lang, 'settings.deleteError')
        setPageError(message)
        return
      }

      router.replace('/?account_deleted=1')
    } catch {
      setPageError(t(lang, 'settings.deleteConnectionError'))
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
            {t(lang, 'settings.backToExtractor')}
          </Link>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {pageError ?? t(lang, 'settings.loadError')}
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
              {t(lang, 'settings.account')}
            </p>
            <h1 className="text-2xl font-bold">{t(lang, 'settings.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t(lang, 'settings.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {t(lang, 'settings.backToExtractor')}
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
          <h2 className="text-base font-semibold mb-4">{t(lang, 'settings.profile')}</h2>
          <form className="space-y-4" onSubmit={handleUpdateName}>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{t(lang, 'settings.emailLabel')}</label>
              <input
                type="email"
                value={account.user.email}
                disabled
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-100 px-3 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{t(lang, 'settings.nameLabel')}</label>
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
              {savingName ? t(lang, 'settings.saving') : t(lang, 'settings.saveName')}
            </button>
          </form>
        </section>

        {/* Plan Actual */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold">{t(lang, 'settings.currentPlan')}</h2>
            <Link
              href="/pricing"
              className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              {t(lang, 'settings.viewPlans')}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${planBadgeClass}`}>
              {planLabel}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {(planSnapshot as (typeof planSnapshot & { extractionsPerDay?: number }) | null)?.extractionsPerDay ?? planSnapshot?.extractionsPerHour ?? 3} {t(lang, 'settings.extractionsPerDay')}
            </span>
            {planSnapshot?.currentPeriodEnd && planSnapshot.plan !== 'free' && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t(lang, 'settings.renewsOn')} {formatPlanDate(planSnapshot.currentPeriodEnd)}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 inline-flex items-center"
            >
              {t(lang, 'settings.changePlan')}
            </Link>
            {planSnapshot?.hasStripeCustomer && planSnapshot.plan !== 'free' && (
              <button
                type="button"
                onClick={() => void handleManageBilling()}
                disabled={openingPortal}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {openingPortal ? t(lang, 'settings.openingPortal') : t(lang, 'settings.manageBilling')}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold">{t(lang, 'settings.currentUsage')}</h2>
            <button
              type="button"
              onClick={() => void loadAccount(false)}
              disabled={refreshingRateLimit}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              {refreshingRateLimit ? t(lang, 'settings.updating') : t(lang, 'settings.update')}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {account.rateLimit.used} / {account.rateLimit.limit} {t(lang, 'settings.extractionsUsed')}
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t(lang, 'settings.remaining')} {account.rateLimit.remaining}
              </p>
            </div>

            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${rateLimitPercent}%` }}
              />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'settings.limitResets')} {formatDateTime(account.rateLimit.resetAt)}
            </p>
          </div>
        </section>

        {/* Extra Credits */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-base font-semibold">{t(lang, 'settings.extraCredits')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(lang, 'settings.creditsDesc')}
              </p>
            </div>
            <Link
              href="/pricing#credits"
              className="shrink-0 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 inline-flex items-center"
            >
              {t(lang, 'settings.buyMore')}
            </Link>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {(planSnapshot as (typeof planSnapshot & { creditBalance?: number }) | null)?.creditBalance ?? 0}
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">{t(lang, 'settings.creditsAvailable')}</span>
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold mb-1">{t(lang, 'settings.exportHistory')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t(lang, 'settings.exportDesc')}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/account/export?format=json"
              download
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t(lang, 'settings.downloadJson')}
            </a>
            <a
              href="/api/account/export?format=csv"
              download
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t(lang, 'settings.downloadCsv')}
            </a>
          </div>
        </section>

        {/* Notificaciones por Email */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-base font-semibold">{t(lang, 'settings.notifications')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(lang, 'settings.notificationsDesc')}
            </p>
          </div>

          {notifPrefs ? (
            <div className="space-y-3">
              {(
                [
                  {
                    key: 'notifyTaskStatusChange' as const,
                    label: t(lang, 'settings.notifStatusChange'),
                    description: t(lang, 'settings.notifStatusChangeDesc'),
                  },
                  {
                    key: 'notifyNewComment' as const,
                    label: t(lang, 'settings.notifNewComment'),
                    description: t(lang, 'settings.notifNewCommentDesc'),
                  },
                ] as const
              ).map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifPrefs[key]}
                      onClick={() => void handleToggleNotif(key)}
                      disabled={savingNotif}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
                        notifPrefs[key] ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          notifPrefs[key] ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400 dark:text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
              {t(lang, 'settings.loadingPrefs')}
            </div>
          )}
        </section>

        {/* Mis Workspaces */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold">{t(lang, 'settings.myWorkspaces')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(lang, 'settings.workspacesDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowCreateWs((v) => !v); setWsCreateError(null) }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <Plus size={14} /> {t(lang, 'settings.createWorkspace')}
            </button>
          </div>

          {showCreateWs && (
            <form onSubmit={handleCreateWorkspace} className="mb-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/20 space-y-3">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">{t(lang, 'settings.wsNameLabel')}</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  required
                  maxLength={80}
                  autoFocus
                  placeholder={t(lang, 'settings.wsNamePlaceholder')}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">{t(lang, 'settings.wsColorLabel')}</label>
                <div className="flex gap-2 flex-wrap">
                  {(['indigo','violet','blue','emerald','rose','amber','cyan','slate'] as const).map((c) => {
                    const cls: Record<string, string> = { indigo:'bg-indigo-500', violet:'bg-violet-500', blue:'bg-blue-500', emerald:'bg-emerald-500', rose:'bg-rose-500', amber:'bg-amber-500', cyan:'bg-cyan-500', slate:'bg-slate-500' }
                    return (
                      <button key={c} type="button" onClick={() => setWsColor(c)}
                        className={`w-7 h-7 rounded-full ${cls[c]} ${wsColor === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                      />
                    )
                  })}
                </div>
              </div>
              {wsCreateError && <p className="text-sm text-rose-600">{wsCreateError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creatingWs || !wsName.trim()}
                  className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {creatingWs && <Loader2 size={13} className="animate-spin" />}
                  {creatingWs ? t(lang, 'settings.creating') : t(lang, 'settings.create')}
                </button>
                <button type="button" onClick={() => setShowCreateWs(false)} className="h-9 px-3 rounded-lg border border-slate-300 text-sm dark:border-slate-700">
                  {t(lang, 'settings.cancel')}
                </button>
              </div>
            </form>
          )}

          {wsLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> {t(lang, 'settings.loadingWorkspaces')}
            </div>
          ) : workspaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center">
              <Building2 className="mx-auto mb-2 text-slate-300" size={28} />
              <p className="text-sm text-slate-400">{t(lang, 'settings.noWorkspace')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workspaces.map((ws) => {
                const colorCls: Record<string, string> = { indigo:'bg-indigo-500', violet:'bg-violet-500', blue:'bg-blue-500', emerald:'bg-emerald-500', rose:'bg-rose-500', amber:'bg-amber-500', cyan:'bg-cyan-500', slate:'bg-slate-500' }
                const roleBadge: Record<string, string> = { owner:'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', admin:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', member:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', viewer:'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
                const roleLabels: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: t(lang, 'ws.roleMember'), viewer: t(lang, 'ws.roleViewer') }
                const memberWord = ws.member_count !== 1 ? t(lang, 'settings.memberCountPlural') : t(lang, 'settings.memberCount')
                return (
                  <Link
                    key={ws.id}
                    href={`/workspace/${ws.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors group"
                  >
                    <div className={`${colorCls[ws.avatar_color] ?? colorCls['indigo']} w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{ws.name}</p>
                      <p className="text-xs text-slate-400">{ws.member_count} {memberWord}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[ws.role] ?? roleBadge['member']}`}>
                      {roleLabels[ws.role] ?? ws.role}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Consumo de IA */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-semibold">{t(lang, 'settings.aiUsage')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(lang, 'settings.aiUsageDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAiUsage()}
              disabled={aiUsageLoading}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              {aiUsageLoading ? t(lang, 'settings.loading') : t(lang, 'settings.update')}
            </button>
          </div>

          {aiUsageLoading && !aiUsage && (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-400 dark:text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
              {t(lang, 'settings.loadingUsage')}
            </div>
          )}

          {aiUsage && (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t(lang, 'settings.totalCalls')}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {aiUsage.totals.calls.toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t(lang, 'settings.tokensUsed')}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {aiUsage.totals.totalTokens >= 1000
                      ? `${(aiUsage.totals.totalTokens / 1000).toFixed(1)}k`
                      : aiUsage.totals.totalTokens.toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t(lang, 'settings.estimatedCost')}</p>
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
                    {t(lang, 'settings.callsLast30')}
                  </p>
                  <AiDailyBarChart data={aiUsage.daily} />
                </div>
              )}

              {/* Breakdown por tipo */}
              {aiUsage.byUseType.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    {t(lang, 'settings.byType')}
                  </p>
                  <ul className="space-y-2">
                    {aiUsage.byUseType.map((entry) => (
                      <li key={entry.useType} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">{entry.label}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {entry.calls.toLocaleString('es-MX')} {t(lang, 'settings.calls')}
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
                  {t(lang, 'settings.noAiUsage')}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold mb-4">{t(lang, 'settings.changePassword')}</h2>
          <form className="space-y-4" onSubmit={handleUpdatePassword}>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
                {t(lang, 'settings.currentPasswordLabel')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder={t(lang, 'settings.currentPasswordPlaceholder')}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
                  {t(lang, 'settings.newPasswordLabel')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  required
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder={t(lang, 'settings.newPasswordPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
                  {t(lang, 'settings.confirmPasswordLabel')}
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
              {savingPassword ? t(lang, 'settings.updatingPassword') : t(lang, 'settings.updatePassword')}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-rose-300 bg-rose-50 p-5 shadow-sm dark:border-rose-900 dark:bg-rose-950/30">
          <h2 className="text-base font-semibold text-rose-800 dark:text-rose-300 mb-2">{t(lang, 'settings.dangerZone')}</h2>
          <p className="text-sm text-rose-700 dark:text-rose-400 mb-4">
            {t(lang, 'settings.dangerDesc')}
          </p>

          <form className="space-y-4" onSubmit={handleDeleteAccount}>
            <div>
              <label className="block text-sm text-rose-700 dark:text-rose-400 mb-1.5">
                {t(lang, 'settings.confirmEmailLabel')}
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
                {t(lang, 'settings.typeEliminate')}
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
                {t(lang, 'settings.currentPasswordLabel')}
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
              {deletingAccount ? t(lang, 'settings.deletingAccount') : t(lang, 'settings.deleteAccountBtn')}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
