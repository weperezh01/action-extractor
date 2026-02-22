import { useCallback, useEffect, useState } from 'react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import type { AuthMode, SessionUser } from '@/app/home/lib/types'

const SESSION_REQUEST_TIMEOUT_MS = 10000

interface UseAuthParams {
  searchParams: ReadonlyURLSearchParams
  resetTokenFromUrl: string | null
  onAuthenticated: () => Promise<void> | void
  onSessionMissing: () => void
  onLogout: () => void
  setGlobalNotice: (value: string | null) => void
  setGlobalError: (value: string | null) => void
}

export function useAuth({
  searchParams,
  resetTokenFromUrl,
  onAuthenticated,
  onSessionMissing,
  onLogout,
  setGlobalNotice,
  setGlobalError,
}: UseAuthParams) {
  const [sessionLoading, setSessionLoading] = useState(true)
  const [user, setUser] = useState<SessionUser | null>(null)

  const [authMode, setAuthMode] = useState<AuthMode>('login')
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

  const loadSession = useCallback(async () => {
    setSessionLoading(true)
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
      setSessionLoading(false)
    }
  }, [onAuthenticated, onSessionMissing])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    const verificationStatus = searchParams.get('email_verification')
    if (!verificationStatus) return

    setAuthMode('login')
    if (verificationStatus === 'success') {
      setAuthError(null)
      setAuthNotice('Correo verificado correctamente. Ya puedes iniciar sesión.')
    } else if (verificationStatus === 'expired') {
      setAuthNotice(null)
      setAuthError('El enlace de verificación expiró. Regístrate nuevamente para recibir otro correo.')
    } else if (verificationStatus === 'invalid') {
      setAuthNotice(null)
      setAuthError('El enlace de verificación no es válido o ya fue utilizado.')
    } else {
      setAuthNotice(null)
      setAuthError('No se pudo verificar tu correo. Intenta nuevamente.')
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams])

  useEffect(() => {
    const authStatus = searchParams.get('auth')
    if (!authStatus) return

    setAuthMode('login')
    setAuthNotice(null)
    setAuthError(null)

    if (authStatus === 'google_success') {
      setAuthNotice('Sesión iniciada con Google correctamente.')
      setGlobalNotice('Sesión iniciada con Google.')
      void onAuthenticated()
    } else if (authStatus === 'google_blocked') {
      setAuthError('Tu cuenta está bloqueada temporalmente. Contacta al administrador.')
    } else if (authStatus === 'google_not_configured') {
      setAuthError('Google OAuth no está configurado en el servidor.')
    } else if (authStatus === 'google_cancelled') {
      setAuthError('Autorización con Google cancelada.')
    } else if (authStatus === 'google_invalid_state') {
      setAuthError('No se pudo validar la sesión de Google. Intenta nuevamente.')
    } else if (authStatus === 'google_error') {
      setAuthError('No se pudo iniciar sesión con Google. Intenta nuevamente.')
    } else {
      return
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/')
    }
  }, [onAuthenticated, searchParams, setGlobalNotice])

  const handleGoogleAuthStart = useCallback(() => {
    if (authLoading || googleAuthLoading) return

    setAuthError(null)
    setAuthNotice(null)
    setGoogleAuthLoading(true)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ next: '/' })
      window.location.href = `/api/auth/google/start?${params.toString()}`
    }
  }, [authLoading, googleAuthLoading])

  const handleAuthSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
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
          setAuthError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo completar la operación.'
          )
          return
        }

        if (authMode === 'register') {
          const registerMessage =
            typeof data?.message === 'string' && data.message.trim()
              ? data.message
              : 'Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.'
          setAuthMode('login')
          setPassword('')
          setAuthError(null)
          setAuthNotice(registerMessage)
          setGlobalError(null)
          return
        }

        if (!data?.user) {
          setAuthError('Respuesta inválida del servidor. Intenta de nuevo.')
          return
        }

        setUser(data.user as SessionUser)
        setPassword('')
        setAuthError(null)
        setAuthNotice(null)
        setGlobalError(null)
        await onAuthenticated()
      } catch {
        setAuthError('Error de conexión. Intenta de nuevo.')
      } finally {
        setAuthLoading(false)
      }
    },
    [authLoading, authMode, email, name, onAuthenticated, password, setGlobalError]
  )

  const handleForgotPassword = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
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
          typeof data?.error === 'string'
            ? data.error
            : 'Error al enviar el correo. Intenta de nuevo.'
        )
        return
      }
      setForgotSuccess(true)
    } catch {
      setForgotError('Error de conexión. Intenta de nuevo.')
    } finally {
      setForgotLoading(false)
    }
  }, [forgotEmail, forgotLoading])

  const handleResetPassword = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (resetLoading) return
      if (newPassword !== confirmPassword) {
        setResetError('Las contraseñas no coinciden.')
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
          setResetError(data.error ?? 'No se pudo restablecer la contraseña.')
          return
        }
        setResetSuccess(true)
      } catch {
        setResetError('Error de conexión. Intenta de nuevo.')
      } finally {
        setResetLoading(false)
      }
    },
    [confirmPassword, newPassword, resetLoading, resetTokenFromUrl]
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
