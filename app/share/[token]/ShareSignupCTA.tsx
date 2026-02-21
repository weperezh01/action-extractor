'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

type FieldName = 'name' | 'email' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<FieldName, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REDIRECT_DELAY_MS = 2200
const DEFAULT_SUCCESS_MESSAGE =
  'Cuenta creada. Revisa tu correo para verificar el email antes de iniciar sesión.'

function getRegisterErrorField(error: string): FieldName | null {
  const normalized = error.toLowerCase()
  if (normalized.includes('nombre')) return 'name'
  if (normalized.includes('correo')) return 'email'
  if (normalized.includes('contraseña')) return 'password'
  return null
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.08 3.56-5.16 3.56-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3A7.17 7.17 0 0 1 12 19.33a7.2 7.2 0 0 1-6.75-4.97H1.24v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.36a7.2 7.2 0 0 1 0-4.72V6.55H1.24a12 12 0 0 0 0 10.9l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.82l3.42-3.42A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.24 6.55l4 3.09A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
  )
}

export function ShareSignupCTA() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [successState, setSuccessState] = useState<{
    email: string
    message: string
  } | null>(null)

  useEffect(() => {
    if (!successState) return

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        signup: 'success',
        email: successState.email,
      })
      router.push(`/?${params.toString()}`)
    }, REDIRECT_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [router, successState])

  const handleGoogleAuthStart = () => {
    if (loading || googleLoading) return
    setGoogleLoading(true)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ next: '/' })
      window.location.href = `/api/auth/google/start?${params.toString()}`
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const nextFieldErrors: FieldErrors = {}

    setFieldErrors({})
    setFormError(null)

    if (trimmedName.length < 2) {
      nextFieldErrors.name = 'Nombre inválido (mínimo 2 caracteres).'
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextFieldErrors.email = 'Correo electrónico inválido.'
    }

    if (password.trim().length < 8) {
      nextFieldErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
    }

    if (confirmPassword !== password) {
      nextFieldErrors.confirmPassword = 'Las contraseñas no coinciden.'
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }

      if (!response.ok) {
        const apiError = data.error ?? 'No se pudo crear la cuenta. Intenta nuevamente.'
        const field = getRegisterErrorField(apiError)
        if (field) {
          setFieldErrors({ [field]: apiError })
        } else {
          setFormError(apiError)
        }
        return
      }

      setSuccessState({
        email: trimmedEmail,
        message: data.message ?? DEFAULT_SUCCESS_MESSAGE,
      })
      setPassword('')
      setConfirmPassword('')
    } catch {
      setFormError('No se pudo crear la cuenta. Revisa tu conexión e intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (successState) {
    return (
      <section
        id="signup-cta"
        className="rounded-3xl border border-emerald-200/70 bg-white p-8 shadow-xl shadow-emerald-100/40 dark:border-emerald-900/60 dark:bg-slate-900 dark:shadow-none"
      >
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
            <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            ¡Cuenta creada!
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {successState.message}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Correo registrado:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-100">{successState.email}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Redirigiendo a la app en unos segundos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Abrir la app
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      id="signup-cta"
      className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 shadow-xl shadow-indigo-100/40 dark:border-indigo-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-none md:p-8"
    >
      <div className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-700/20" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-800/20" />

      <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300">
            <Sparkles size={12} />
            Prueba gratuita
          </p>

          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            ¿Quieres analizar tus propios videos?
          </h2>

          <p className="mt-3 text-base text-slate-700 dark:text-slate-300">
            Regístrate gratis y convierte videos largos en un plan ejecutable en minutos.
          </p>

          <ul className="mt-5 space-y-3 text-sm text-slate-700 dark:text-slate-300">
            {[
              'Plan de Acción paso a paso listo para ejecutar.',
              'Resumen Ejecutivo claro para tomar decisiones rápidas.',
              'Exportación a Notion, Trello, Todoist y Google Docs.',
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              form="share-signup-form"
              disabled={loading || googleLoading}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors ${
                loading || googleLoading
                  ? 'cursor-not-allowed bg-slate-400'
                  : 'bg-indigo-600 shadow-lg shadow-indigo-500/20 hover:bg-indigo-700'
              }`}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
              {!loading && <ArrowRight size={16} />}
            </button>

            <button
              type="button"
              onClick={handleGoogleAuthStart}
              disabled={loading || googleLoading}
              className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors ${
                loading || googleLoading
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600'
              }`}
            >
              <GoogleIcon className="h-4 w-4" />
              {googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
            >
              Abrir la app
            </Link>
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Sin tarjeta. Exporta cuando tú lo autorices.
          </p>
        </div>

        <form
          id="share-signup-form"
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
          noValidate
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Crear cuenta gratis</h3>

          <button
            type="button"
            onClick={handleGoogleAuthStart}
            disabled={loading || googleLoading}
            className={`mt-4 h-11 w-full rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              loading || googleLoading
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600'
            }`}
          >
            <GoogleIcon className="h-4 w-4" />
            {googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}
          </button>

          <div className="relative my-4">
            <div className="h-px w-full bg-slate-200 dark:bg-slate-700" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:bg-slate-900">
              o con correo
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="share-signup-name" className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">
                Nombre
              </label>
              <input
                id="share-signup-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, name: undefined }))
                }}
                placeholder="Tu nombre"
                autoComplete="name"
                disabled={loading || googleLoading}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'share-signup-name-error' : undefined}
                required
                className={`h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                  fieldErrors.name
                    ? 'border-rose-400 text-rose-900 placeholder:text-rose-300 dark:border-rose-500 dark:text-rose-100'
                    : 'border-slate-300 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                }`}
              />
              {fieldErrors.name && (
                <p id="share-signup-name-error" className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="share-signup-email" className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">
                Correo electrónico
              </label>
              <input
                id="share-signup-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, email: undefined }))
                }}
                placeholder="tu@correo.com"
                autoComplete="email"
                disabled={loading || googleLoading}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'share-signup-email-error' : undefined}
                required
                className={`h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                  fieldErrors.email
                    ? 'border-rose-400 text-rose-900 placeholder:text-rose-300 dark:border-rose-500 dark:text-rose-100'
                    : 'border-slate-300 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                }`}
              />
              {fieldErrors.email && (
                <p id="share-signup-email-error" className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="share-signup-password" className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">
                Contraseña
              </label>
              <input
                id="share-signup-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, password: undefined }))
                }}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                minLength={8}
                disabled={loading || googleLoading}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'share-signup-password-error' : undefined}
                required
                className={`h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                  fieldErrors.password
                    ? 'border-rose-400 text-rose-900 placeholder:text-rose-300 dark:border-rose-500 dark:text-rose-100'
                    : 'border-slate-300 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                }`}
              />
              {fieldErrors.password && (
                <p id="share-signup-password-error" className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="share-signup-confirm-password" className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">
                Confirmar contraseña
              </label>
              <input
                id="share-signup-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                }}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                minLength={8}
                disabled={loading || googleLoading}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? 'share-signup-confirm-error' : undefined}
                required
                className={`h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                  fieldErrors.confirmPassword
                    ? 'border-rose-400 text-rose-900 placeholder:text-rose-300 dark:border-rose-500 dark:text-rose-100'
                    : 'border-slate-300 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                }`}
              />
              {fieldErrors.confirmPassword && (
                <p id="share-signup-confirm-error" className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          {formError && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
              loading || googleLoading
                ? 'cursor-not-allowed bg-slate-400'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
          </button>
        </form>
      </div>
    </section>
  )
}
