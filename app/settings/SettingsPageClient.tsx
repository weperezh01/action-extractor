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

function formatDateTime(iso: string) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
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
