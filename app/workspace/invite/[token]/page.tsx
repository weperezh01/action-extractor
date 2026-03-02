'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Check, Loader2, X } from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'
import { t } from '@/app/home/lib/i18n'

interface InvitationInfo {
  workspaceName: string
  invitedByName: string | null
  email: string
  role: string
  status: string
  expiresAt: string
}

export default function WorkspaceInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params?.token === 'string' ? params.token : ''
  const { lang } = useLang()

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    member: t(lang, 'ws.roleMember'),
    viewer: t(lang, 'ws.roleViewer'),
  }

  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)

  const loadInvitation = useCallback(async () => {
    if (!token) { setError(t(lang, 'ws.invite.invalidToken')); setLoading(false); return }
    try {
      const res = await fetch(`/api/workspaces/invite/${token}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t(lang, 'ws.invite.notFound')); return }
      if (data.invitation.status !== 'pending') {
        setError(t(lang, 'ws.invite.alreadyProcessed'))
        return
      }
      setInfo(data.invitation)
    } catch {
      setError(t(lang, 'ws.invite.loadError'))
    } finally {
      setLoading(false)
    }
  }, [token, lang])

  useEffect(() => { void loadInvitation() }, [loadInvitation])

  const handleAction = async (action: 'accept' | 'decline') => {
    setProcessing(true)
    try {
      const res = await fetch(`/api/workspaces/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action === 'decline' ? 'decline' : 'accept' }),
      })
      const data = await res.json()
      if (res.status === 401) {
        // Not logged in — redirect to login
        const redirectUrl = encodeURIComponent(`/workspace/invite/${token}`)
        router.push(`/login?redirect=${redirectUrl}`)
        return
      }
      if (!res.ok) {
        setError(data.error ?? t(lang, 'ws.invite.processError'))
        return
      }
      setDone(action === 'accept' ? 'accepted' : 'declined')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">⚡ ActionExtractor</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          {error ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
                <X size={24} className="text-rose-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">{t(lang, 'ws.invite.invalidTitle')}</h2>
              <p className="text-slate-500 text-sm mb-6">{error}</p>
              <Link href="/" className="text-indigo-600 hover:underline text-sm">{t(lang, 'ws.invite.backHome')}</Link>
            </div>
          ) : done === 'accepted' ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">{t(lang, 'ws.invite.joinedTitle')}</h2>
              <p className="text-slate-500 text-sm mb-6">
                {t(lang, 'ws.invite.joinedDesc')} <strong>{info?.workspaceName}</strong>.
              </p>
              <Link
                href="/"
                className="inline-block w-full text-center h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 leading-10"
              >
                {t(lang, 'ws.invite.goToApp')}
              </Link>
            </div>
          ) : done === 'declined' ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <X size={24} className="text-slate-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">{t(lang, 'ws.invite.declinedTitle')}</h2>
              <p className="text-slate-500 text-sm mb-6">{t(lang, 'ws.invite.declinedDesc')}</p>
              <Link href="/" className="text-indigo-600 hover:underline text-sm">{t(lang, 'ws.invite.backHome')}</Link>
            </div>
          ) : info ? (
            <>
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold mb-3">
                  {info.workspaceName.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{info.workspaceName}</h2>
                {info.invitedByName && (
                  <p className="text-sm text-slate-500 mt-1">
                    <strong>{info.invitedByName}</strong> {t(lang, 'ws.invite.invitedBy')}
                  </p>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t(lang, 'ws.invite.yourEmail')}</span>
                  <span className="text-sm text-slate-700 dark:text-slate-200">{info.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t(lang, 'ws.invite.assignedRole')}</span>
                  <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    {ROLE_LABELS[info.role] ?? info.role}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t(lang, 'ws.invite.expires')}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {new Date(info.expiresAt).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => void handleAction('decline')}
                  disabled={processing}
                  className="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {t(lang, 'ws.invite.decline')}
                </button>
                <button
                  onClick={() => void handleAction('accept')}
                  disabled={processing}
                  className="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing && <Loader2 size={14} className="animate-spin" />}
                  {t(lang, 'ws.invite.accept')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
