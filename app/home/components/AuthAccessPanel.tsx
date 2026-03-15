import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { getAuthCopy } from '@/app/home/lib/auth-copy'
import type { Lang } from '@/app/home/lib/i18n'
import type { AuthMode } from '@/app/home/lib/types'
import { GoogleIcon } from '@/app/home/components/GoogleIcon'

interface AuthAccessPanelProps {
  lang: Lang
  signInHref?: string
  resetTokenFromUrl: string | null
  resetSuccess: boolean
  resetLoading: boolean
  resetError: string | null
  newPassword: string
  confirmPassword: string
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmitResetPassword: (event: FormEvent<HTMLFormElement>) => void

  authMode: AuthMode
  onAuthModeChange: (mode: AuthMode) => void
  authLoading: boolean
  googleAuthLoading: boolean
  authNotice: string | null
  authError: string | null
  onAuthNoticeChange: (value: string | null) => void
  onAuthErrorChange: (value: string | null) => void
  onGoogleAuthStart: () => void
  onSubmitAuth: (event: FormEvent<HTMLFormElement>) => void

  name: string
  email: string
  password: string
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void

  forgotEmail: string
  forgotLoading: boolean
  forgotError: string | null
  forgotSuccess: boolean
  onForgotEmailChange: (value: string) => void
  onForgotErrorChange: (value: string | null) => void
  onForgotSuccessChange: (value: boolean) => void
  onSubmitForgotPassword: (event: FormEvent<HTMLFormElement>) => void
}

const panelClass =
  'rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_72px_200px_-40px_rgba(139,92,246,0.96)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_44px_120px_-44px_rgba(139,92,246,0.95)]'
const inputClass =
  'h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10 dark:text-zinc-100 dark:placeholder:text-zinc-500'
const feedbackBaseClass =
  'rounded-lg border px-3 py-2 text-sm'

export function AuthAccessPanel({
  lang,
  signInHref = '/app',
  resetTokenFromUrl,
  resetSuccess,
  resetLoading,
  resetError,
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmitResetPassword,

  authMode,
  onAuthModeChange,
  authLoading,
  googleAuthLoading,
  authNotice,
  authError,
  onAuthNoticeChange,
  onAuthErrorChange,
  onGoogleAuthStart,
  onSubmitAuth,

  name,
  email,
  password,
  onNameChange,
  onEmailChange,
  onPasswordChange,

  forgotEmail,
  forgotLoading,
  forgotError,
  forgotSuccess,
  onForgotEmailChange,
  onForgotErrorChange,
  onForgotSuccessChange,
  onSubmitForgotPassword,
}: AuthAccessPanelProps) {
  const copy = getAuthCopy(lang)

  if (resetTokenFromUrl) {
    return (
      <section className="mx-auto max-w-md space-y-5">
        {resetSuccess ? (
          <div className={`${panelClass} text-center`}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-500/10 text-emerald-600 dark:border-emerald-700/60 dark:text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {copy.resetSuccessTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {copy.resetSuccessBody}
            </p>
            <a
              href={signInHref}
              className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_34px_78px_-18px_rgba(124,58,237,1)] transition-colors duration-200 hover:bg-violet-700 dark:shadow-[0_26px_56px_-22px_rgba(139,92,246,0.98)]"
            >
              {copy.signInCta}
            </a>
          </div>
        ) : (
          <div className={panelClass}>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {copy.newPasswordTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {copy.newPasswordBody}
            </p>

            <form onSubmit={onSubmitResetPassword} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-600 dark:text-zinc-300">
                  {copy.newPasswordLabel}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => onNewPasswordChange(event.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                  placeholder={copy.passwordMin}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-600 dark:text-zinc-300">
                  {copy.confirmPasswordLabel}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                  placeholder={copy.repeatPassword}
                />
              </div>

              {resetError && (
                <div className={`${feedbackBaseClass} border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300`}>
                  {resetError}
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="h-11 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-[0_34px_78px_-18px_rgba(124,58,237,1)] transition-colors duration-200 hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:shadow-[0_26px_56px_-22px_rgba(139,92,246,0.98)]"
              >
                {resetLoading ? copy.resetSaving : copy.resetSubmit}
              </button>
            </form>
          </div>
        )}
      </section>
    )
  }

  if (authMode === 'forgot') {
    return (
      <section className="mx-auto max-w-md space-y-5">
        {forgotSuccess ? (
          <div className={`${panelClass} text-center`}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-300/60 bg-violet-500/10 text-violet-600 dark:border-violet-700/60 dark:text-violet-400">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {copy.forgotSuccessTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {copy.forgotSuccessBody}
            </p>
            <button
              type="button"
              onClick={() => {
                onAuthModeChange('login')
                onForgotSuccessChange(false)
                onForgotEmailChange('')
              }}
              className="mt-5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              {copy.backToSignIn}
            </button>
          </div>
        ) : (
          <div className={panelClass}>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {copy.forgotTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {copy.forgotBody}
            </p>

            <form onSubmit={onSubmitForgotPassword} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-600 dark:text-zinc-300">
                  {copy.emailLabel}
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => onForgotEmailChange(event.target.value)}
                  required
                  className={inputClass}
                  placeholder={copy.emailPlaceholder}
                />
              </div>

              {forgotError && (
                <div className={`${feedbackBaseClass} border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300`}>
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="h-11 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-[0_34px_78px_-18px_rgba(124,58,237,1)] transition-colors duration-200 hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:shadow-[0_26px_56px_-22px_rgba(139,92,246,0.98)]"
              >
                {forgotLoading ? copy.forgotSending : copy.forgotSendLink}
              </button>

              <button
                type="button"
                onClick={() => {
                  onAuthModeChange('login')
                  onForgotErrorChange(null)
                }}
                className="w-full text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              >
                {copy.backToSignIn}
              </button>
            </form>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          {authMode === 'register' ? copy.panelRegisterTitle : copy.panelLoginTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {copy.panelSubtitle}
        </p>
      </div>

      <div className={panelClass}>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 p-1 dark:border-white/10">
          <button
            type="button"
            onClick={() => {
              onAuthModeChange('login')
              onAuthErrorChange(null)
            }}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors duration-200 ${
              authMode === 'login'
                ? 'bg-violet-600 text-white shadow-[0_28px_62px_-16px_rgba(124,58,237,0.94)] dark:shadow-[0_24px_52px_-20px_rgba(139,92,246,0.96)]'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5'
            }`}
          >
            {copy.loginTab}
          </button>
          <button
            type="button"
            onClick={() => {
              onAuthModeChange('register')
              onAuthNoticeChange(null)
              onAuthErrorChange(null)
            }}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors duration-200 ${
              authMode === 'register'
                ? 'bg-violet-600 text-white shadow-[0_28px_62px_-16px_rgba(124,58,237,0.94)] dark:shadow-[0_24px_52px_-20px_rgba(139,92,246,0.96)]'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5'
            }`}
          >
            {copy.registerTab}
          </button>
        </div>

        <form onSubmit={onSubmitAuth} className="mt-5 space-y-4">
          <button
            type="button"
            onClick={onGoogleAuthStart}
            disabled={authLoading || googleAuthLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-transparent text-sm font-semibold text-zinc-800 shadow-[0_30px_66px_-22px_rgba(148,163,184,0.88)] transition-colors duration-200 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/5 dark:shadow-[0_24px_48px_-24px_rgba(148,163,184,0.75)]"
          >
            <GoogleIcon className="h-4 w-4" />
            {googleAuthLoading
              ? copy.googleConnecting
              : authMode === 'register'
                ? copy.googleCreate
                : copy.googleContinue}
          </button>

          <div className="relative py-1">
            <div className="h-px w-full bg-zinc-200 dark:bg-white/10" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
              {copy.orWithEmail}
            </span>
          </div>

          {authMode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm text-zinc-600 dark:text-zinc-300">
                {copy.nameLabel}
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                required
                className={inputClass}
                placeholder={copy.namePlaceholder}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm text-zinc-600 dark:text-zinc-300">
              {copy.emailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
              className={inputClass}
              placeholder={copy.emailPlaceholder}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-600 dark:text-zinc-300">
              {copy.passwordLabel}
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
              minLength={8}
              className={inputClass}
              placeholder={copy.passwordMin}
            />
          </div>

          {authNotice && (
            <div className={`${feedbackBaseClass} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300`}>
              {authNotice}
            </div>
          )}

          {authError && (
            <div className={`${feedbackBaseClass} border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300`}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="h-11 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-[0_34px_78px_-18px_rgba(124,58,237,1)] transition-colors duration-200 hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:shadow-[0_26px_56px_-22px_rgba(139,92,246,0.98)]"
          >
            {authLoading
              ? copy.authProcessing
              : authMode === 'login'
                ? copy.loginSubmit
                : copy.registerSubmit}
          </button>

          {authMode === 'login' && (
            <button
              type="button"
              onClick={() => {
                onAuthModeChange('forgot')
                onAuthErrorChange(null)
                onAuthNoticeChange(null)
              }}
              className="w-full text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              {copy.forgotPassword}
            </button>
          )}
        </form>
      </div>
    </section>
  )
}
