'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Globe,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  RefreshCw,
  Send,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'

type CommunityFeedMode = 'home' | 'explore' | 'extraction'
type CommunityPostVisibility = 'private' | 'circle' | 'followers' | 'public'

interface CommunityPostItem {
  id: string
  content: string
  visibility: CommunityPostVisibility
  source: {
    extractionId: string | null
    taskId: string | null
    label: string | null
  }
  metrics: {
    reactionsCount: number
    commentsCount: number
    viewsCount: number
    reactedByMe: boolean
  }
  author: {
    userId: string
    name: string | null
    email: string | null
    following: boolean
  }
  createdAt: string
}

interface CommunityComment {
  id: string
  postId: string
  userId: string
  userName: string | null
  userEmail: string | null
  content: string
  createdAt: string
}

interface CommunityPanelProps {
  currentExtractionId?: string | null
  onError?: (message: string) => void
  onNotice?: (message: string) => void
  className?: string
}

function parseErrorMessage(payload: unknown, fallback: string) {
  const message = (payload as { error?: unknown })?.error
  return typeof message === 'string' && message.trim() ? message : fallback
}

function formatDate(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Ahora'
    return date.toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: true,
    })
  } catch {
    return 'Ahora'
  }
}

function visibilityLabel(value: CommunityPostVisibility) {
  if (value === 'private') return 'Privado'
  if (value === 'circle') return 'Círculo'
  if (value === 'followers') return 'Followers'
  return 'Público'
}

export function CommunityPanel({
  currentExtractionId = null,
  onError,
  onNotice,
  className,
}: CommunityPanelProps) {
  const [feedMode, setFeedMode] = useState<CommunityFeedMode>('home')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CommunityPostItem[]>([])
  const [postContent, setPostContent] = useState('')
  const [postVisibility, setPostVisibility] = useState<CommunityPostVisibility>('followers')
  const [linkCurrentExtraction, setLinkCurrentExtraction] = useState(true)
  const [postSubmitting, setPostSubmitting] = useState(false)
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, CommunityComment[]>>({})
  const [openCommentsByPostId, setOpenCommentsByPostId] = useState<Record<string, boolean>>({})
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({})
  const [commentMutationPostId, setCommentMutationPostId] = useState<string | null>(null)
  const [postMutationId, setPostMutationId] = useState<string | null>(null)

  const canUseExtractionFeed = Boolean(currentExtractionId?.trim())

  const resolveFeedEndpoint = useCallback(() => {
    if (feedMode === 'explore') return '/api/community/feed/explore?limit=24'
    if (feedMode === 'extraction') {
      if (!canUseExtractionFeed) return null
      return `/api/community/feed/extractions/${encodeURIComponent(currentExtractionId ?? '')}?limit=24`
    }
    return '/api/community/feed/home?limit=24'
  }, [canUseExtractionFeed, currentExtractionId, feedMode])

  const loadFeed = useCallback(async () => {
    const endpoint = resolveFeedEndpoint()
    if (!endpoint) {
      setItems([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as { items?: unknown; error?: unknown } | null
      if (!res.ok) {
        const message = parseErrorMessage(data, 'No se pudo cargar el feed de comunidad.')
        onError?.(message)
        setItems([])
        return
      }

      const nextItems = Array.isArray(data?.items) ? (data?.items as CommunityPostItem[]) : []
      setItems(nextItems)
    } catch {
      onError?.('Error de conexión cargando feed de comunidad.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [onError, resolveFeedEndpoint])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  const handleCreatePost = useCallback(async () => {
    const content = postContent.trim()
    if (!content || postSubmitting) return

    setPostSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        content,
        visibility: postVisibility,
      }
      if (linkCurrentExtraction && currentExtractionId?.trim()) {
        body.extractionId = currentExtractionId.trim()
      }

      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as
        | { post?: CommunityPostItem; error?: unknown }
        | null

      if (!res.ok) {
        onError?.(parseErrorMessage(data, 'No se pudo publicar el post.'))
        return
      }

      const created = data?.post
      if (created) {
        setItems((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
      }
      setPostContent('')
      onNotice?.('Post publicado en comunidad.')
    } catch {
      onError?.('Error de conexión al publicar el post.')
    } finally {
      setPostSubmitting(false)
    }
  }, [currentExtractionId, linkCurrentExtraction, onError, onNotice, postContent, postSubmitting, postVisibility])

  const toggleReaction = useCallback(
    async (postId: string) => {
      if (postMutationId) return
      setPostMutationId(postId)
      try {
        const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reactionType: 'like' }),
        })
        const data = (await res.json().catch(() => null)) as
          | { reactionsCount?: number; reactedByMe?: boolean; error?: unknown }
          | null
        if (!res.ok) {
          onError?.(parseErrorMessage(data, 'No se pudo actualizar la reacción.'))
          return
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  metrics: {
                    ...item.metrics,
                    reactionsCount:
                      typeof data?.reactionsCount === 'number' ? data.reactionsCount : item.metrics.reactionsCount,
                    reactedByMe:
                      typeof data?.reactedByMe === 'boolean' ? data.reactedByMe : item.metrics.reactedByMe,
                  },
                }
              : item
          )
        )
      } catch {
        onError?.('Error de conexión al reaccionar.')
      } finally {
        setPostMutationId(null)
      }
    },
    [onError, postMutationId]
  )

  const toggleFollow = useCallback(
    async (post: CommunityPostItem) => {
      if (postMutationId) return
      setPostMutationId(post.id)
      try {
        const method = post.author.following ? 'DELETE' : 'POST'
        const res = await fetch(`/api/community/follows/${encodeURIComponent(post.author.userId)}`, {
          method,
        })
        const data = (await res.json().catch(() => null)) as { followed?: boolean; error?: unknown } | null
        if (!res.ok) {
          onError?.(parseErrorMessage(data, 'No se pudo actualizar follow.'))
          return
        }

        const followed = data?.followed === true
        setItems((prev) =>
          prev.map((item) =>
            item.author.userId === post.author.userId
              ? {
                  ...item,
                  author: {
                    ...item.author,
                    following: followed,
                  },
                }
              : item
          )
        )
      } catch {
        onError?.('Error de conexión al actualizar follow.')
      } finally {
        setPostMutationId(null)
      }
    },
    [onError, postMutationId]
  )

  const loadComments = useCallback(
    async (postId: string) => {
      try {
        const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments?limit=100`, {
          cache: 'no-store',
        })
        const data = (await res.json().catch(() => null)) as
          | { comments?: CommunityComment[]; error?: unknown }
          | null
        if (!res.ok) {
          onError?.(parseErrorMessage(data, 'No se pudieron cargar comentarios.'))
          return
        }
        const comments = Array.isArray(data?.comments) ? data.comments : []
        setCommentsByPostId((prev) => ({ ...prev, [postId]: comments }))
      } catch {
        onError?.('Error de conexión cargando comentarios.')
      }
    },
    [onError]
  )

  const toggleComments = useCallback(
    (postId: string) => {
      setOpenCommentsByPostId((prev) => {
        const nextOpen = !prev[postId]
        if (nextOpen && !commentsByPostId[postId]) {
          void loadComments(postId)
        }
        return { ...prev, [postId]: nextOpen }
      })
    },
    [commentsByPostId, loadComments]
  )

  const handleCreateComment = useCallback(
    async (postId: string) => {
      const draft = (commentDraftByPostId[postId] ?? '').trim()
      if (!draft || commentMutationPostId) return

      setCommentMutationPostId(postId)
      try {
        const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: draft }),
        })
        const data = (await res.json().catch(() => null)) as
          | { comment?: CommunityComment; error?: unknown }
          | null
        if (!res.ok) {
          onError?.(parseErrorMessage(data, 'No se pudo publicar el comentario.'))
          return
        }
        const created = data?.comment
        if (created) {
          setCommentsByPostId((prev) => ({
            ...prev,
            [postId]: [...(prev[postId] ?? []), created],
          }))
          setItems((prev) =>
            prev.map((item) =>
              item.id === postId
                ? {
                    ...item,
                    metrics: {
                      ...item.metrics,
                      commentsCount: item.metrics.commentsCount + 1,
                    },
                  }
                : item
            )
          )
        }
        setCommentDraftByPostId((prev) => ({ ...prev, [postId]: '' }))
      } catch {
        onError?.('Error de conexión al publicar comentario.')
      } finally {
        setCommentMutationPostId(null)
      }
    },
    [commentDraftByPostId, commentMutationPostId, onError]
  )

  const handleDeleteComment = useCallback(
    async (postId: string, commentId: string) => {
      if (commentMutationPostId) return
      setCommentMutationPostId(postId)
      try {
        const res = await fetch(
          `/api/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
          { method: 'DELETE' }
        )
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        if (!res.ok) {
          onError?.(parseErrorMessage(data, 'No se pudo eliminar el comentario.'))
          return
        }
        setCommentsByPostId((prev) => ({
          ...prev,
          [postId]: (prev[postId] ?? []).filter((item) => item.id !== commentId),
        }))
        setItems((prev) =>
          prev.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  metrics: {
                    ...item.metrics,
                    commentsCount: Math.max(0, item.metrics.commentsCount - 1),
                  },
                }
              : item
          )
        )
      } catch {
        onError?.('Error de conexión eliminando comentario.')
      } finally {
        setCommentMutationPostId(null)
      }
    },
    [commentMutationPostId, onError]
  )

  const showExtractionHint = useMemo(
    () => feedMode === 'extraction' && !canUseExtractionFeed,
    [canUseExtractionFeed, feedMode]
  )

  return (
    <section
      className={`mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        className ?? ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Comunidad
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Publica avances, sigue autores y conversa sobre resultados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadFeed()}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <textarea
          value={postContent}
          onChange={(event) => setPostContent(event.target.value)}
          placeholder="Comparte qué avanzaste hoy, qué aprendiste o qué necesitas."
          className="min-h-[84px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={postVisibility}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === 'private' || raw === 'circle' || raw === 'followers' || raw === 'public') {
                setPostVisibility(raw)
              }
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="private">Privado</option>
            <option value="circle">Círculo</option>
            <option value="followers">Followers</option>
            <option value="public">Público</option>
          </select>
          <label className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={linkCurrentExtraction}
              onChange={(event) => setLinkCurrentExtraction(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            Vincular extracción actual
          </label>
          <button
            type="button"
            onClick={() => void handleCreatePost()}
            disabled={postSubmitting || !postContent.trim()}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            <Send size={12} />
            {postSubmitting ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFeedMode('home')}
          className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold ${
            feedMode === 'home'
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Users size={12} />
          Home
        </button>
        <button
          type="button"
          onClick={() => setFeedMode('explore')}
          className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold ${
            feedMode === 'explore'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Globe size={12} />
          Explore
        </button>
        <button
          type="button"
          onClick={() => setFeedMode('extraction')}
          className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold ${
            feedMode === 'extraction'
              ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Link2 size={12} />
          Extracción
        </button>
      </div>

      {showExtractionHint && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Abre una extracción para ver su feed comunitario.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando posts...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Aún no hay publicaciones en este feed.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((post) => {
            const commentsOpen = openCommentsByPostId[post.id] === true
            const comments = commentsByPostId[post.id] ?? []
            const followLabel = post.author.following ? 'Siguiendo' : 'Seguir'
            return (
              <li
                key={post.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {post.author.name?.trim() || post.author.email || 'Usuario'}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(post.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {post.visibility === 'public' ? <Globe size={10} /> : post.visibility === 'private' ? <Lock size={10} /> : post.visibility === 'circle' ? <Users size={10} /> : <UserPlus size={10} />}
                      {visibilityLabel(post.visibility)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleFollow(post)}
                      disabled={postMutationId === post.id}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {post.author.following ? <UserMinus size={10} /> : <UserPlus size={10} />}
                      {followLabel}
                    </button>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{post.content}</p>
                {post.source.extractionId && (
                  <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    Fuente: {post.source.label || `Extraction ${post.source.extractionId}`}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleReaction(post.id)}
                    disabled={postMutationId === post.id}
                    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors ${
                      post.metrics.reactedByMe
                        ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Heart size={12} />
                    {post.metrics.reactionsCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleComments(post.id)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <MessageCircle size={12} />
                    {post.metrics.commentsCount}
                  </button>
                  <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
                    {post.metrics.viewsCount} vistas
                  </span>
                </div>

                {commentsOpen && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                    <div className="space-y-1.5">
                      {comments.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Sin comentarios todavía.</p>
                      ) : (
                        comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-800/40"
                          >
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              {comment.userName?.trim() || comment.userEmail || 'Usuario'}
                            </p>
                            <p className="text-xs text-slate-700 dark:text-slate-200">{comment.content}</p>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {formatDate(comment.createdAt)}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteComment(post.id, comment.id)}
                                disabled={commentMutationPostId === post.id}
                                className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-60 dark:text-rose-300"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        value={commentDraftByPostId[post.id] ?? ''}
                        onChange={(event) =>
                          setCommentDraftByPostId((prev) => ({ ...prev, [post.id]: event.target.value }))
                        }
                        placeholder="Escribe un comentario..."
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateComment(post.id)}
                        disabled={commentMutationPostId === post.id || !(commentDraftByPostId[post.id] ?? '').trim()}
                        className="inline-flex h-8 items-center rounded-md bg-slate-800 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        Comentar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
