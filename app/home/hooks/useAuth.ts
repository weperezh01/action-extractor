import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { getAuthCopy, translateAuthServerMessage } from '@/app/home/lib/auth-copy'
import type { Lang } from '@/app/home/lib/i18n'
import type { AuthMode, SessionUser } from '@/app/home/lib/types'

const SESSION_REQUEST_TIMEOUT_MS = 10000
const PENDING_EXTRACTIONS_KEY = 'ae-pending-extractions'

// Best-effort: migrate guest extractions saved in localStorage to the
// authenticated user's account. Called once per authentication event.
async function migrateGuestExtractions() {
  try {
    const raw = localStorage.getItem(PENDING_EXTRACTIONS_KEY)
    if (!raw) return
    const extractions = JSON.parse(raw) as unknown[]
    if (!Array.isArray(extractions) || extractions.length === 0) {
      localStorage.removeItem(PENDING_EXTRACTIONS_KEY)
      return
    }
    // Remove before the fetch so a network error doesn't re-trigger migration
    localStorage.removeItem(PENDING_EXTRACTIONS_KEY)
    await fetch('/api/migrate-guest-extractions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extractions }),
    })
  } catch {
    // fail silently — guest migration is best-effort
  }
}

interface UseAuthParams {
  lang: Lang
  searchParams: ReadonlyURLSearchParams
  resetTokenFromUrl: string | null
  onAuthenticated: () => Promise<void> | void
  onSessionMissing: () => void
  onLogout: () => void
  setGlobalNotice: (value: string | null) => void
  setGlobalError: (value: string | null) => void
  initialAuthMode?: AuthMode
  blockSessionCheck?: boolean
  googleNextPath?: string
  historyBasePath?: string
}

export function useAuth({
  lang,
  searchParams,
  resetTokenFromUrl,
  onAuthenticated,
  onSessionMissing,
  onLogout,
  setGlobalNotice,
  setGlobalError,
  initialAuthMode = 'login',
  blockSessionCheck = true,
  googleNextPath = '/app',
  historyBasePath = '/app',
}: UseAuthParams) {
  const [sessionLoading, setSessionLoading] = useState(blockSessionCheck)
  const [user, setUser] = useState<SessionUser | null>(null)

  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    const requestedMode = searchParams.get('mode')
    if (requestedMode === 'register') return 'register'
    if (requestedMode === 'forgot') return 'forgot'
    return initialAuthMode
  })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Ensure guest extraction migration only runs once per component lifetime
  const migrationAttemptedRef = useRef(false)

  const triggerMigration = useCallback(() => {
    if (migrationAttemptedRef.current) return
    migrationAttemptedRef.current = true
    void migrateGuestExtractions()
  }, [])

  const loadSession = useCallback(async () => {
    if (blockSessionCheck) setSessionLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), SESSION_REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch('/api/auth/session', {
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = await res.json().catch(() => null)

      if (res.ok && data.user) {
        setUser(data.user as SessionUser)
        triggerMigration()
        // Do not block the main app shell while history loads.
        void Promise.resolve(onAuthenticated()).catch(() => {
          // noop: auth shell should remain usable even if secondary data fails
        })
      } else {
        setUser(null)
        onSessionMissing()
      }
    } catch {
      setUser(null)
      onSessionMissing()
    } finally {
      clearTimeout(timeoutId)
      if (blockSessionCheck) setSessionLoading(false)
    }
  }, [blockSessionCheck, onAuthenticated, onSessionMissing, triggerMigration])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    const copy = getAuthCopy(lang)
    const verificationStatus = searchParams.get('email_verification')
    if (!verificationStatus) return

    setAuthMode('login')
    if (verificationStatus === 'success') {
      setAuthError(null)
      setAuthNotice(copy.messages.emailVerifiedSuccess)
    } else if (verificationStatus === 'expired') {
      setAuthNotice(null)
      setAuthError(copy.messages.emailVerifiedExpired)
    } else if (verificationStatus === 'invalid') {
      setAuthNotice(null)
      setAuthError(copy.messages.emailVerifiedInvalid)
    } else {
      setAuthNotice(null)
      setAuthError(copy.messages.emailVerifiedUnknown)
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', historyBasePath)
    }
  }, [historyBasePath, lang, searchParams])

  useEffect(() => {
    const copy = getAuthCopy(lang)
    const authStatus = searchParams.get('auth')
    if (!authStatus) return

    setAuthMode('login')
    setAuthNotice(null)
    setAuthError(null)

    if (authStatus === 'google_success') {
      setAuthNotice(copy.messages.googleSuccess)
      setGlobalNotice(copy.messages.googleSuccessGlobal)
      triggerMigration()
      void onAuthenticated()
    } else if (authStatus === 'google_blocked') {
      setAuthError(copy.messages.googleBlocked)
    } else if (authStatus === 'google_not_configured') {
      setAuthError(copy.messages.googleNotConfigured)
    } else if (authStatus === 'google_cancelled') {
      setAuthError(copy.messages.googleCancelled)
    } else if (authStatus === 'google_invalid_state') {
      setAuthError(copy.messages.googleInvalidState)
    } else if (authStatus === 'google_error') {
      setAuthError(copy.messages.googleError)
    } else {
      return
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', historyBasePath)
    }
  }, [historyBasePath, lang, onAuthenticated, searchParams, setGlobalNotice, triggerMigration])

  const handleGoogleAuthStart = useCallback(() => {
    if (authLoading || googleAuthLoading) return

    setAuthError(null)
    setAuthNotice(null)
    setGoogleAuthLoading(true)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ next: googleNextPath })
      window.location.href = `/api/auth/google/start?${params.toString()}`
    }
  }, [authLoading, googleAuthLoading, googleNextPath])

  const handleAuthSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      const copy = getAuthCopy(lang)
      event.preventDefault()
      if (authLoading) return

      setAuthLoading(true)
      setAuthError(null)
      setAuthNotice(null)

      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload: Record<string, string> = {
        email,
        password,
      }

      if (authMode === 'register') {
        payload.name = name
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = (await res.json().catch(() => null)) as
          | {
              user?: SessionUser
              error?: string
              message?: string
              requiresEmailVerification?: boolean
            }
          | null
        if (!res.ok) {
          const translatedError = translateAuthServerMessage(lang, data?.error)
          setAuthError(
            typeof translatedError === 'string' && translatedError.trim()
              ? translatedError
              : copy.messages.genericOperationError
          )
          return
        }

        if (authMode === 'register') {
          const registerMessage =
            translateAuthServerMessage(lang, data?.message) ?? copy.messages.registerSuccess
          setAuthMode('login')
          setPassword('')
          setAuthError(null)
          setAuthNotice(registerMessage)
          setGlobalError(null)
          return
        }

        if (!data?.user) {
          setAuthError(copy.messages.invalidServerResponse)
          return
        }

        setUser(data.user as SessionUser)
        setPassword('')
        setAuthError(null)
        setAuthNotice(null)
        setGlobalError(null)
        triggerMigration()
        await onAuthenticated()
      } catch {
        setAuthError(copy.messages.connectionRetry)
      } finally {
        setAuthLoading(false)
      }
    },
    [authLoading, authMode, email, lang, name, onAuthenticated, password, setGlobalError, triggerMigration]
  )

  const handleForgotPassword = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      const copy = getAuthCopy(lang)
      event.preventDefault()
      if (forgotLoading) return
      setForgotLoading(true)
      setForgotError(null)
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotEmail }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setForgotError(
            translateAuthServerMessage(lang, data?.error) ?? copy.messages.forgotEmailError
          )
          return
        }
        setForgotSuccess(true)
      } catch {
        setForgotError(copy.messages.connectionRetry)
      } finally {
        setForgotLoading(false)
      }
    },
    [forgotEmail, forgotLoading, lang]
  )

  const handleResetPassword = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      const copy = getAuthCopy(lang)
      event.preventDefault()
      if (resetLoading) return
      if (newPassword !== confirmPassword) {
        setResetError(copy.messages.passwordsMismatch)
        return
      }
      setResetLoading(true)
      setResetError(null)
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetTokenFromUrl, password: newPassword }),
        })
        const data = await res.json()
        if (!res.ok) {
          setResetError(
            translateAuthServerMessage(lang, data?.error) ?? copy.messages.resetPasswordError
          )
          return
        }
        setResetSuccess(true)
      } catch {
        setResetError(copy.messages.connectionRetry)
      } finally {
        setResetLoading(false)
      }
    },
    [confirmPassword, lang, newPassword, resetLoading, resetTokenFromUrl]
  )

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setGlobalError(null)
      setGlobalNotice(null)
      onLogout()
    }
  }, [onLogout, setGlobalError, setGlobalNotice])

  return {
    sessionLoading,
    user,
    setUser,
    loadSession,

    authMode,
    setAuthMode,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    authLoading,
    googleAuthLoading,
    authError,
    setAuthError,
    authNotice,
    setAuthNotice,

    forgotEmail,
    setForgotEmail,
    forgotLoading,
    forgotError,
    setForgotError,
    forgotSuccess,
    setForgotSuccess,

    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    resetLoading,
    resetError,
    resetSuccess,

    handleGoogleAuthStart,
    handleAuthSubmit,
    handleForgotPassword,
    handleResetPassword,
    handleLogout,
  }
}
