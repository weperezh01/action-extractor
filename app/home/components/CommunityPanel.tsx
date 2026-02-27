'use client'

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  Globe,
  Heart,
  ImagePlus,
  Link2,
  Lock,
  MessageCircle,
  RefreshCw,
  Send,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

type CommunityFeedMode = 'home' | 'explore' | 'extraction'
type CommunityPostVisibility = 'private' | 'circle' | 'followers' | 'public'
type CommunityPostAttachmentType = 'link' | 'image' | 'audio' | 'video' | 'file'
type CommunityPostAttachmentStorageProvider = 'external' | 'cloudinary'

interface CommunityPostAttachmentItem {
  id: string
  attachmentType: CommunityPostAttachmentType
  storageProvider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnailUrl: string | null
  title: string | null
  mimeType: string | null
  metadataJson: string
  createdAt: string
  updatedAt: string
}

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
  attachments: CommunityPostAttachmentItem[]
  createdAt: string
}

interface ComposerImageAttachment {
  storageProvider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnailUrl: string | null
  title: string | null
  mimeType: string | null
  metadata: Record<string, unknown>
}

interface ComposerAttachmentPayload {
  attachmentType: CommunityPostAttachmentType
  storageProvider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnailUrl?: string | null
  title?: string | null
  mimeType?: string | null
  metadata?: Record<string, unknown>
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

function normalizeExternalUrl(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function normalizeAttachments(raw: unknown): CommunityPostAttachmentItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is CommunityPostAttachmentItem => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.url === 'string'
  })
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
  const [attachmentLinkUrl, setAttachmentLinkUrl] = useState('')
  const [attachmentLinkTitle, setAttachmentLinkTitle] = useState('')
  const [imageAttachment, setImageAttachment] = useState<ComposerImageAttachment | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
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

      const nextItems = Array.isArray(data?.items)
        ? (data.items as CommunityPostItem[]).map((item) => ({
            ...item,
            attachments: normalizeAttachments((item as { attachments?: unknown }).attachments),
          }))
        : []
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

  const handleImageAttachmentChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (imageUploading) {
        event.target.value = ''
        return
      }

      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      setImageUploading(true)
      try {
        const formData = new FormData()
        formData.set('file', file)

        const res = await fetch('/api/community/uploads/image', {
          method: 'POST',
          body: formData,
        })

        const data = (await res.json().catch(() => null)) as
          | {
              attachment?: {
                storageProvider?: unknown
                url?: unknown
                thumbnailUrl?: unknown
                title?: unknown
                mimeType?: unknown
                metadata?: unknown
              }
              error?: unknown
            }
          | null

        if (!res.ok) {
          onError?.(parseErrorMessage(data, 'No se pudo subir la imagen.'))
          return
        }

        const attachment = data?.attachment
        const url = typeof attachment?.url === 'string' ? attachment.url.trim() : ''
        if (!url) {
          onError?.('La subida devolvió una imagen inválida.')
          return
        }

        const metadata =
          attachment?.metadata && typeof attachment.metadata === 'object' && !Array.isArray(attachment.metadata)
            ? (attachment.metadata as Record<string, unknown>)
            : {}

        setImageAttachment({
          storageProvider: attachment?.storageProvider === 'cloudinary' ? 'cloudinary' : 'external',
          url,
          thumbnailUrl:
            typeof attachment?.thumbnailUrl === 'string' && attachment.thumbnailUrl.trim()
              ? attachment.thumbnailUrl.trim()
              : null,
          title: typeof attachment?.title === 'string' && attachment.title.trim() ? attachment.title.trim() : null,
          mimeType:
            typeof attachment?.mimeType === 'string' && attachment.mimeType.trim()
              ? attachment.mimeType.trim()
              : null,
          metadata,
        })
      } catch {
        onError?.('Error de conexión subiendo imagen.')
      } finally {
        setImageUploading(false)
      }
    },
    [imageUploading, onError]
  )

  const handleCreatePost = useCallback(async () => {
    const content = postContent.trim()
    if (!content || postSubmitting) return

    const normalizedLinkUrl = attachmentLinkUrl.trim()
      ? normalizeExternalUrl(attachmentLinkUrl)
      : null
    if (attachmentLinkUrl.trim() && !normalizedLinkUrl) {
      onError?.('El link del adjunto debe ser una URL válida (http o https).')
      return
    }

    setPostSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        content,
        visibility: postVisibility,
      }
      if (linkCurrentExtraction && currentExtractionId?.trim()) {
        body.extractionId = currentExtractionId.trim()
      }

      const attachments: ComposerAttachmentPayload[] = []
      if (imageAttachment) {
        attachments.push({
          attachmentType: 'image',
          storageProvider: imageAttachment.storageProvider,
          url: imageAttachment.url,
          thumbnailUrl: imageAttachment.thumbnailUrl,
          title: imageAttachment.title,
          mimeType: imageAttachment.mimeType,
          metadata: imageAttachment.metadata,
        })
      }

      if (normalizedLinkUrl) {
        attachments.push({
          attachmentType: 'link',
          storageProvider: 'external',
          url: normalizedLinkUrl,
          title: attachmentLinkTitle.trim() ? attachmentLinkTitle.trim() : null,
          metadata: {},
        })
      }

      if (attachments.length > 0) {
        body.attachments = attachments
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
        const normalized = {
          ...created,
          attachments: normalizeAttachments((created as { attachments?: unknown }).attachments),
        } satisfies CommunityPostItem
        setItems((prev) => [normalized, ...prev.filter((item) => item.id !== created.id)])
      }
      setPostContent('')
      setAttachmentLinkUrl('')
      setAttachmentLinkTitle('')
      setImageAttachment(null)
      onNotice?.('Post publicado en comunidad.')
    } catch {
      onError?.('Error de conexión al publicar el post.')
    } finally {
      setPostSubmitting(false)
    }
  }, [
    attachmentLinkTitle,
    attachmentLinkUrl,
    currentExtractionId,
    imageAttachment,
    linkCurrentExtraction,
    onError,
    onNotice,
    postContent,
    postSubmitting,
    postVisibility,
  ])

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
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
              <Link2 size={11} />
              Link
            </span>
            <input
              value={attachmentLinkUrl}
              onChange={(event) => setAttachmentLinkUrl(event.target.value)}
              placeholder="https://sitio.com/recurso"
              className="h-8 min-w-[200px] flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <input
              value={attachmentLinkTitle}
              onChange={(event) => setAttachmentLinkTitle(event.target.value)}
              placeholder="Título del link (opcional)"
              className="h-8 min-w-[170px] flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-800">
              <ImagePlus size={12} />
              {imageUploading ? 'Subiendo imagen...' : imageAttachment ? 'Cambiar imagen' : 'Adjuntar imagen'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageAttachmentChange}
                disabled={imageUploading || postSubmitting}
                className="hidden"
              />
            </label>
            {imageAttachment && (
              <button
                type="button"
                onClick={() => setImageAttachment(null)}
                disabled={postSubmitting || imageUploading}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={11} />
                Quitar imagen
              </button>
            )}
          </div>
          {imageAttachment && (
            <div className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <img
                src={imageAttachment.thumbnailUrl || imageAttachment.url}
                alt={imageAttachment.title || 'Adjunto de imagen'}
                className="max-h-52 w-full object-cover"
              />
            </div>
          )}
        </div>
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
            disabled={postSubmitting || imageUploading || !postContent.trim()}
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
                {post.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {post.attachments.map((attachment) => {
                      if (attachment.attachmentType === 'image') {
                        return (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-md border border-slate-200 bg-white transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                          >
                            <img
                              src={attachment.thumbnailUrl || attachment.url}
                              alt={attachment.title || 'Adjunto de imagen'}
                              className="max-h-64 w-full object-cover"
                            />
                            {attachment.title && (
                              <p className="truncate px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                                {attachment.title}
                              </p>
                            )}
                          </a>
                        )
                      }

                      const label = attachment.title?.trim() || attachment.url
                      return (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <span className="inline-flex h-5 items-center gap-1 rounded-md bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <ExternalLink size={10} />
                            {attachment.attachmentType === 'link' ? 'Link' : attachment.attachmentType}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
                            {label}
                          </span>
                        </a>
                      )
                    })}
                  </div>
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
