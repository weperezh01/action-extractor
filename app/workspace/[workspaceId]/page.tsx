'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  MoreHorizontal,
  Play,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'
import { t } from '@/app/home/lib/i18n'

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  avatar_color: string
  owner_user_id: string
  created_at: string
}

interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
  user_name: string | null
  user_email: string | null
}

interface WorkspaceInvitation {
  id: string
  email: string
  role: WorkspaceRole
  status: string
  expires_at: string
  created_at: string
  invited_by_name?: string | null
}

interface ExtractionItem {
  id: string
  objective: string
  video_title: string | null
  source_label: string | null
  source_type: string
  created_at: string
  thumbnail_url: string | null
}

const AVATAR_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  cyan: 'bg-cyan-500',
  slate: 'bg-slate-500',
}

const ROLE_BADGE_COLORS: Record<WorkspaceRole, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

function canManageMembers(role: WorkspaceRole | null) {
  return role === 'owner' || role === 'admin'
}

export default function WorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = typeof params?.workspaceId === 'string' ? params.workspaceId : ''
  const { lang } = useLang()

  const ROLE_LABELS: Record<WorkspaceRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: t(lang, 'ws.roleMember'),
    viewer: t(lang, 'ws.roleViewer'),
  }

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [myRole, setMyRole] = useState<WorkspaceRole | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [extractions, setExtractions] = useState<ExtractionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'extractions' | 'members' | 'invitations' | 'settings'>('extractions')

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Edit workspace
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editColor, setEditColor] = useState('indigo')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Delete workspace
  const [deletingWs, setDeletingWs] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [wsRes, membersRes, extractionsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}`, { cache: 'no-store' }),
        fetch(`/api/workspaces/${workspaceId}/members`, { cache: 'no-store' }),
        fetch(`/api/workspaces/${workspaceId}/extractions`, { cache: 'no-store' }),
      ])

      if (wsRes.status === 401) { router.replace('/'); return }
      if (wsRes.status === 403) { setError(t(lang, 'ws.noAccess')); setLoading(false); return }
      if (!wsRes.ok) { setError(t(lang, 'ws.loadError')); setLoading(false); return }

      const wsData = await wsRes.json()
      setWorkspace(wsData.workspace)
      setMyRole(wsData.role)
      setEditName(wsData.workspace.name)
      setEditDescription(wsData.workspace.description ?? '')
      setEditColor(wsData.workspace.avatar_color ?? 'indigo')

      if (membersRes.ok) {
        const mData = await membersRes.json()
        setMembers(mData.members ?? [])
      }

      if (extractionsRes.ok) {
        const eData = await extractionsRes.json()
        setExtractions(eData.extractions ?? [])
      }
    } catch {
      setError(t(lang, 'ws.connectionError'))
    } finally {
      setLoading(false)
    }
  }, [workspaceId, router, lang])

  const loadInvitations = useCallback(async () => {
    if (!canManageMembers(myRole)) return
    const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setInvitations(data.invitations ?? [])
    }
  }, [workspaceId, myRole])

  useEffect(() => { void loadAll() }, [loadAll])
  useEffect(() => { if (activeTab === 'invitations') void loadInvitations() }, [activeTab, loadInvitations])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) { setInviteError(data.error ?? t(lang, 'ws.inviteError')); return }
      setInviteSuccess(true)
      setInviteEmail('')
      setTimeout(() => {
        setInviteSuccess(false)
        setShowInviteModal(false)
        void loadInvitations()
      }, 1500)
    } finally {
      setInviting(false)
    }
  }

  const handleChangeRole = async (userId: string, role: WorkspaceRole) => {
    await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    void loadAll()
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(t(lang, 'ws.confirmRemove'))) return
    await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' })
    void loadAll()
  }

  const handleCancelInvitation = async (invId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/invitations/${invId}`, { method: 'DELETE' })
    void loadInvitations()
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, description: editDescription, avatarColor: editColor }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      setWorkspace(data.workspace)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    }
  }

  const handleDeleteWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (deleteConfirm !== workspace?.name) return
    setDeletingWs(true)
    const res = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' })
    if (res.ok) {
      router.replace('/settings')
    } else {
      setDeletingWs(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
        <p className="text-rose-600">{error}</p>
        <Link href="/settings" className="text-sm text-indigo-600 hover:underline">{t(lang, 'ws.backToSettings')}</Link>
      </div>
    )
  }

  if (!workspace) return null

  const avatarBg = AVATAR_COLORS[workspace.avatar_color] ?? AVATAR_COLORS['indigo']
  const initial = workspace.name.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/settings" className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className={`${avatarBg} w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">{workspace.name}</h1>
            {workspace.description && (
              <p className="text-sm text-slate-500 truncate">{workspace.description}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_BADGE_COLORS[myRole ?? 'viewer']}`}>
              {ROLE_LABELS[myRole ?? 'viewer']}
            </span>
            <span className="text-xs text-slate-400">{members.length} {t(lang, 'ws.members')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {(['extractions', 'members', 'invitations', 'settings'] as const).map((tab) => {
            if (tab === 'invitations' && !canManageMembers(myRole)) return null
            if (tab === 'settings' && !canManageMembers(myRole)) return null
            const labels = {
              extractions: t(lang, 'ws.tabExtractions'),
              members: t(lang, 'ws.tabMembers'),
              invitations: t(lang, 'ws.tabInvitations'),
              settings: t(lang, 'ws.tabSettings'),
            }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Extractions tab */}
        {activeTab === 'extractions' && (
          <div>
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4">
              {t(lang, 'ws.extractionsTitle')} ({extractions.length})
            </h2>
            {extractions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                <Play className="mx-auto mb-3 text-slate-300" size={32} />
                <p className="text-slate-500 text-sm">{t(lang, 'ws.noExtractions')}</p>
                <p className="text-slate-400 text-xs mt-1">{t(lang, 'ws.noExtractionsHint')}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {extractions.map((ex) => (
                  <div key={ex.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex gap-3 items-start">
                    {ex.thumbnail_url ? (
                      <img src={ex.thumbnail_url} alt="" className="w-16 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <Play size={14} className="text-indigo-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">
                        {ex.video_title ?? ex.source_label ?? ex.objective}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(ex.created_at).toLocaleDateString('es-ES')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members tab */}
        {activeTab === 'members' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
                {t(lang, 'ws.membersTitle')} ({members.length})
              </h2>
              {canManageMembers(myRole) && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  <UserPlus size={15} /> {t(lang, 'ws.invite')}
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(lang, 'ws.userCol')}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(lang, 'ws.roleCol')}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(lang, 'ws.sinceCol')}</th>
                    {canManageMembers(myRole) && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <tr key={m.user_id}>
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">{m.user_name ?? '—'}</p>
                          <p className="text-xs text-slate-400">{m.user_email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {canManageMembers(myRole) && m.role !== 'owner' ? (
                          <RoleSelector
                            value={m.role}
                            onChange={(role) => void handleChangeRole(m.user_id, role)}
                            roleLabels={ROLE_LABELS}
                          />
                        ) : (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_BADGE_COLORS[m.role]}`}>
                            {ROLE_LABELS[m.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">
                        {new Date(m.joined_at).toLocaleDateString('es-ES')}
                      </td>
                      {canManageMembers(myRole) && (
                        <td className="px-5 py-3 text-right">
                          {m.role !== 'owner' && (
                            <button
                              onClick={() => void handleRemoveMember(m.user_id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                              title={t(lang, 'ws.removeMember')}
                            >
                              <UserMinus size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invitations tab */}
        {activeTab === 'invitations' && canManageMembers(myRole) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
                {t(lang, 'ws.invitationsTitle')} ({invitations.length})
              </h2>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                <Mail size={15} /> {t(lang, 'ws.newInvitation')}
              </button>
            </div>

            {invitations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                <Mail className="mx-auto mb-3 text-slate-300" size={32} />
                <p className="text-slate-500 text-sm">{t(lang, 'ws.noPendingInvitations')}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(lang, 'ws.emailCol')}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(lang, 'ws.roleCol')}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(lang, 'ws.expiresCol')}</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">{inv.email}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_BADGE_COLORS[inv.role]}`}>
                            {ROLE_LABELS[inv.role]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">
                          {new Date(inv.expires_at).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => void handleCancelInvitation(inv.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            title={t(lang, 'ws.cancelInvitation')}
                          >
                            <X size={14} />
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

        {/* Settings tab */}
        {activeTab === 'settings' && canManageMembers(myRole) && (
          <div className="space-y-6">
            {/* General settings */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">{t(lang, 'ws.generalSettings')}</h2>
              <form className="space-y-4" onSubmit={handleSaveSettings}>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{t(lang, 'ws.wsNameLabel')}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    maxLength={80}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{t(lang, 'ws.descriptionLabel')}</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    maxLength={300}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">{t(lang, 'ws.avatarColorLabel')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(AVATAR_COLORS).map(([key, cls]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditColor(key)}
                        className={`w-8 h-8 rounded-full ${cls} transition-all ${editColor === key ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : saveSuccess ? <Check size={14} /> : null}
                  {saving ? t(lang, 'ws.saving') : saveSuccess ? t(lang, 'ws.saved') : t(lang, 'ws.saveChanges')}
                </button>
              </form>
            </section>

            {/* Transfer ownership — owner only */}
            {myRole === 'owner' && (
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">{t(lang, 'ws.transferOwnership')}</h2>
                <p className="text-sm text-slate-500 mb-4">{t(lang, 'ws.transferDesc')}</p>
                <div className="flex flex-col gap-2">
                  {members.filter((m) => m.role !== 'owner').map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.user_name}</p>
                        <p className="text-xs text-slate-400">{m.user_email}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`${t(lang, 'ws.confirmTransfer')} ${m.user_name}?`)) return
                          const res = await fetch(`/api/workspaces/${workspaceId}/transfer`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newOwnerId: m.user_id }),
                          })
                          if (res.ok) void loadAll()
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {t(lang, 'ws.transfer')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Danger zone — owner only */}
            {myRole === 'owner' && (
              <section className="rounded-2xl border border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-6">
                <h2 className="text-base font-semibold text-rose-800 dark:text-rose-300 mb-2">{t(lang, 'ws.dangerZone')}</h2>
                <p className="text-sm text-rose-700 dark:text-rose-400 mb-4">
                  {t(lang, 'ws.dangerDesc')}
                </p>
                <form onSubmit={handleDeleteWorkspace} className="space-y-3">
                  <div>
                    <label className="block text-sm text-rose-700 dark:text-rose-400 mb-1.5">
                      {t(lang, 'ws.typeToConfirm')} <strong>{workspace.name}</strong> {t(lang, 'ws.typeToConfirmSuffix')}
                    </label>
                    <input
                      type="text"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      required
                      className="w-full h-10 rounded-lg border border-rose-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:border-rose-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={deletingWs || deleteConfirm !== workspace.name}
                    className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deletingWs ? t(lang, 'ws.deleting') : t(lang, 'ws.deleteWorkspace')}
                  </button>
                </form>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t(lang, 'ws.inviteMember')}</h3>
              <button onClick={() => { setShowInviteModal(false); setInviteError(null); setInviteSuccess(false) }} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Check size={22} className="text-emerald-600" />
                </div>
                <p className="text-slate-700 dark:text-slate-200 font-medium">{t(lang, 'ws.inviteSent')}</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{t(lang, 'ws.emailLabel')}</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder={t(lang, 'ws.emailPlaceholder')}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">{t(lang, 'ws.roleLabel')}</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="admin">{t(lang, 'ws.adminRole')}</option>
                    <option value="member">{t(lang, 'ws.memberRole')}</option>
                    <option value="viewer">{t(lang, 'ws.viewerRole')}</option>
                  </select>
                </div>
                {inviteError && <p className="text-sm text-rose-600">{inviteError}</p>}
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {inviting && <Loader2 size={14} className="animate-spin" />}
                  {t(lang, 'ws.sendInvitation')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleSelector({
  value,
  onChange,
  roleLabels,
}: {
  value: WorkspaceRole
  onChange: (r: WorkspaceRole) => void
  roleLabels: Record<WorkspaceRole, string>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const options: WorkspaceRole[] = ['admin', 'member', 'viewer']

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_BADGE_COLORS[value]}`}
      >
        {roleLabels[value]}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-[140px] py-1">
          {options.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { onChange(r); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 ${
                r === value ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {r === value && <Check size={11} />}
              {roleLabels[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
