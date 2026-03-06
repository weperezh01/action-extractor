'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Heart,
  Lock,
  MessageCircle,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  userId: string
  name: string | null
  email: string | null
  postCount: number
  followerCount: number
  followingCount: number
  isFollowing: boolean
  createdAt: string
}

type PostVisibility = 'private' | 'circle' | 'followers' | 'public'

interface PostItem {
  id: string
  content: string
  visibility: PostVisibility
  source: { extractionId: string | null; taskId: string | null; label: string | null }
  metrics: { reactionsCount: number; commentsCount: number; viewsCount: number; reactedByMe: boolean }
  author: { userId: string; name: string | null; email: string | null; following: boolean }
  attachments: Array<{
    id: string
    attachmentType: string
    storageProvider: string
    url: string
    thumbnailUrl: string | null
    title: string | null
    mimeType: string | null
  }>
  createdAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string | null): string {
  const display = name?.trim() || email || '?'
  return display
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function formatDate(value: string, locale: string): string {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      dateStyle: 'medium',
    }).format(date)
  } catch {
    return ''
  }
}

// ── Labels ───────────────────────────────────────────────────────────────────

const LABELS = {
  en: {
    back: 'Back to community',
    posts: 'posts',
    followers: 'followers',
    following: 'following',
    follow: 'Follow',
    unfollow: 'Unfollow',
    memberSince: 'Member since',
    postsTitle: 'Posts',
    loadMore: 'Load more',
    noPostsYet: 'No posts yet.',
    notFound: 'User not found.',
    loading: 'Loading profile…',
    views: 'views',
    visibilityPublic: 'Public',
    visibilityFollowers: 'Followers',
    visibilityCircle: 'Circle',
    visibilityPrivate: 'Private',
    source: 'Source:',
    link: 'link',
  },
  es: {
    back: 'Volver a la comunidad',
    posts: 'publicaciones',
    followers: 'seguidores',
    following: 'siguiendo',
    follow: 'Seguir',
    unfollow: 'Siguiendo',
    memberSince: 'Miembro desde',
    postsTitle: 'Publicaciones',
    loadMore: 'Cargar más',
    noPostsYet: 'Aún no hay publicaciones.',
    notFound: 'Usuario no encontrado.',
    loading: 'Cargando perfil…',
    views: 'vistas',
    visibilityPublic: 'Público',
    visibilityFollowers: 'Seguidores',
    visibilityCircle: 'Círculo',
    visibilityPrivate: 'Privado',
    source: 'Fuente:',
    link: 'enlace',
  },
} as const

const PAGE_LIMIT = 20

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommunityUserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { lang } = useLang()
  const lx = LABELS[lang === 'es' ? 'es' : 'en']

  const targetUserId = typeof params.userId === 'string' ? params.userId : ''

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [status, setStatus] = useState<'loading' | 'notfound' | 'error' | 'ready'>('loading')
  const [posts, setPosts] = useState<PostItem[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [followMutating, setFollowMutating] = useState(false)

  // ── Load profile ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!targetUserId) return
    void (async () => {
      setStatus('loading')
      try {
        const res = await fetch(`/api/community/users/${encodeURIComponent(targetUserId)}`, {
          cache: 'no-store',
        })
        if (res.status === 401) {
          router.replace('/')
          return
        }
        if (res.status === 404) {
          setStatus('notfound')
          return
        }
        if (!res.ok) {
          setStatus('error')
          return
        }
        const data = (await res.json()) as { profile?: UserProfile; isOwnProfile?: boolean }
        if (!data.profile) {
          setStatus('notfound')
          return
        }
        setProfile(data.profile)
        setIsOwnProfile(data.isOwnProfile === true)
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    })()
  }, [targetUserId, router])

  // ── Load posts ────────────────────────────────────────────────────────────

  const loadPosts = useCallback(
    async (nextOffset: number) => {
      if (!targetUserId) return
      setPostsLoading(true)
      try {
        const params = new URLSearchParams({ limit: String(PAGE_LIMIT), offset: String(nextOffset) })
        const res = await fetch(
          `/api/community/users/${encodeURIComponent(targetUserId)}/posts?${params.toString()}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const data = (await res.json()) as { posts?: PostItem[]; hasMore?: boolean }
        const incoming = Array.isArray(data.posts) ? data.posts : []
        setPosts((prev) => (nextOffset === 0 ? incoming : [...prev, ...incoming]))
        setHasMore(data.hasMore === true)
        setOffset(nextOffset + incoming.length)
      } catch {
        // ignore
      } finally {
        setPostsLoading(false)
      }
    },
    [targetUserId]
  )

  useEffect(() => {
    if (status === 'ready') {
      void loadPosts(0)
    }
  }, [status, loadPosts])

  // ── Follow / Unfollow ─────────────────────────────────────────────────────

  const handleFollow = useCallback(async () => {
    if (!profile || followMutating) return
    setFollowMutating(true)
    try {
      const method = profile.isFollowing ? 'DELETE' : 'POST'
      const res = await fetch(`/api/community/follows/${encodeURIComponent(profile.userId)}`, { method })
      if (!res.ok) return
      const data = (await res.json()) as { followed?: boolean }
      const followed = data.followed === true
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: followed,
              followerCount: prev.followerCount + (followed ? 1 : -1),
            }
          : prev
      )
    } catch {
      // ignore
    } finally {
      setFollowMutating(false)
    }
  }, [profile, followMutating])

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">{lx.loading}</p>
      </div>
    )
  }

  if (status === 'notfound' || status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">{lx.notFound}</p>
        <Link
          href="/app"
          className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {lx.back}
        </Link>
      </div>
    )
  }

  if (!profile) return null

  const displayName = profile.name?.trim() || profile.email || 'User'
  const initials = getInitials(profile.name, profile.email)
  const locale = lang === 'es' ? 'es' : 'en'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Back link */}
        <Link
          href="/app"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={14} />
          {lx.back}
        </Link>

        {/* Profile card */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 text-2xl font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              {initials}
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{displayName}</h1>
              {profile.createdAt && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {lx.memberSince} {formatDate(profile.createdAt, locale)}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{profile.postCount}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{lx.posts}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{profile.followerCount}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{lx.followers}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{profile.followingCount}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{lx.following}</p>
              </div>
            </div>

            {/* Follow button — hidden for own profile */}
            {!isOwnProfile && (
              <button
                type="button"
                onClick={() => void handleFollow()}
                disabled={followMutating}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  profile.isFollowing
                    ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50'
                    : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50'
                }`}
              >
                {profile.isFollowing ? <UserMinus size={14} /> : <UserPlus size={14} />}
                {profile.isFollowing ? lx.unfollow : lx.follow}
              </button>
            )}
          </div>
        </div>

        {/* Posts section */}
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {lx.postsTitle}
          </h2>

          {posts.length === 0 && !postsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{lx.noPostsYet}</p>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(post.createdAt, locale)}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {post.visibility === 'public' ? (
                        <Globe size={9} />
                      ) : post.visibility === 'private' ? (
                        <Lock size={9} />
                      ) : (
                        <Users size={9} />
                      )}
                      {post.visibility === 'public'
                        ? lx.visibilityPublic
                        : post.visibility === 'followers'
                          ? lx.visibilityFollowers
                          : post.visibility === 'circle'
                            ? lx.visibilityCircle
                            : lx.visibilityPrivate}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{post.content}</p>

                  {post.source.extractionId && (
                    <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {lx.source} {post.source.label || `Extraction ${post.source.extractionId}`}
                    </p>
                  )}

                  {post.attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {post.attachments.map((a) => {
                        if (a.attachmentType === 'image') {
                          return (
                            <a
                              key={a.id}
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
                            >
                              <img
                                src={a.thumbnailUrl || a.url}
                                alt={a.title || ''}
                                className="max-h-64 w-full object-cover"
                              />
                            </a>
                          )
                        }
                        return (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <ExternalLink size={11} />
                            <span className="min-w-0 flex-1 truncate">{a.title?.trim() || a.url}</span>
                          </a>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold ${
                        post.metrics.reactedByMe
                          ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <Heart size={12} />
                      {post.metrics.reactionsCount}
                    </span>
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <MessageCircle size={12} />
                      {post.metrics.commentsCount}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
                      {post.metrics.viewsCount} {lx.views}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {postsLoading && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{lx.loading}</p>
          )}

          {hasMore && !postsLoading && (
            <button
              type="button"
              onClick={() => void loadPosts(offset)}
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {lx.loadMore}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
