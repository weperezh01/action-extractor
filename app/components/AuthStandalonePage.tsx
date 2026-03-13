'use client'

import Link from 'next/link'
import { useCallback, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { NotesAideLogo } from '@/app/components/NotesAideLogo'
import { AuthAccessPanel } from '@/app/home/components/AuthAccessPanel'
import { useAuth } from '@/app/home/hooks/useAuth'
import { useLang } from '@/app/home/hooks/useLang'
import type { AuthMode } from '@/app/home/lib/types'

interface AuthStandalonePageProps {
  initialAuthMode: Extract<AuthMode, 'login' | 'register'>
}

export function AuthStandalonePage({ initialAuthMode }: AuthStandalonePageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang } = useLang()
  const resetTokenFromUrl = searchParams.get('token')
  const authBasePath = initialAuthMode === 'register' ? '/register' : '/login'

  const handleAuthenticated = useCallback(() => {
    router.replace('/app')
  }, [router])

  const handleSessionMissing = useCallback(() => {
    // Public auth page: missing session is expected.
  }, [])

  const noopNotice = useCallback((_value: string | null) => {
    // No global notice bus on the standalone auth page.
  }, [])

  const {
    user,
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
  } = useAuth({
    searchParams,
    resetTokenFromUrl,
    onAuthenticated: handleAuthenticated,
    onSessionMissing: handleSessionMissing,
    onLogout: handleSessionMissing,
    setGlobalNotice: noopNotice,
    setGlobalError: noopNotice,
    initialAuthMode,
    blockSessionCheck: false,
    googleNextPath: authBasePath,
    historyBasePath: authBasePath,
  })

  useEffect(() => {
    if (!user) return
    router.replace('/app')
  }, [router, user])

  const handleAuthModeChange = useCallback(
    (mode: AuthMode) => {
      if (mode === 'login') {
        router.replace('/login')
        return
      }
      if (mode === 'register') {
        router.replace('/register')
        return
      }
      setAuthMode(mode)
    },
    [router, setAuthMode]
  )

  const title =
    initialAuthMode === 'register'
      ? lang === 'es'
        ? 'Crea tu cuenta'
        : 'Create your account'
      : lang === 'es'
        ? 'Inicia sesión'
        : 'Sign in'
  const subtitle =
    initialAuthMode === 'register'
      ? lang === 'es'
        ? 'Accede más rápido sin cargar todo el extractor antes de autenticarte.'
        : 'Access your account faster without loading the full extractor first.'
      : lang === 'es'
        ? 'Accede más rápido sin cargar todo el extractor antes de autenticarte.'
        : 'Sign in faster without loading the full extractor first.'

  return (
    <main className="min-h-[calc(100vh-140px)] bg-slate-50 px-6 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <section className="max-w-xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft size={16} />
            {lang === 'es' ? 'Volver a la landing' : 'Back to landing'}
          </Link>

          <div className="mt-8">
            <NotesAideLogo
              className="h-14 w-[230px] text-slate-900 dark:text-slate-100"
              title="Notes Aide"
            />
          </div>

          <h1 className="mt-8 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
        </section>

        <section className="w-full max-w-md">
          <AuthAccessPanel
            signInHref="/login"
            resetTokenFromUrl={resetTokenFromUrl}
            resetSuccess={resetSuccess}
            resetLoading={resetLoading}
            resetError={resetError}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmitResetPassword={handleResetPassword}
            authMode={authMode}
            onAuthModeChange={handleAuthModeChange}
            authLoading={authLoading}
            googleAuthLoading={googleAuthLoading}
            authNotice={authNotice}
            authError={authError}
            onAuthNoticeChange={setAuthNotice}
            onAuthErrorChange={setAuthError}
            onGoogleAuthStart={handleGoogleAuthStart}
            onSubmitAuth={handleAuthSubmit}
            name={name}
            email={email}
            password={password}
            onNameChange={setName}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            forgotEmail={forgotEmail}
            forgotLoading={forgotLoading}
            forgotError={forgotError}
            forgotSuccess={forgotSuccess}
            onForgotEmailChange={setForgotEmail}
            onForgotErrorChange={setForgotError}
            onForgotSuccessChange={setForgotSuccess}
            onSubmitForgotPassword={handleForgotPassword}
          />
        </section>
      </div>
    </main>
  )
}
