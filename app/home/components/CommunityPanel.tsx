'use client'

import Link from 'next/link'
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  ExternalLink,
  Globe,
  Heart,
  ImagePlus,
  Link2,
  Lock,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { LanguageToggle } from '@/app/components/LanguageToggle'

type CommunityFeedMode = 'home' | 'explore' | 'extraction' | 'people'
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

interface UserCard {
  userId: string
  name: string | null
  email: string | null
  postCount: number
  followerCount: number
  followingCount: number
  isFollowing: boolean
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

function formatDate(value: string, locale: string, now: string): string {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return now
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: true,
    }).format(date)
  } catch {
    return now
  }
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
  const t = useTranslations('community')
  const locale = useLocale()

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

  // People tab state
  const [userCards, setUserCards] = useState<UserCard[]>([])
  const [userCardsLoading, setUserCardsLoading] = useState(false)
  const [peopleSearch, setPeopleSearch] = useState('')
  const [peopleMutationId, setPeopleMutationId] = useState<string | null>(null)
  const peopleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canUseExtractionFeed = Boolean(currentExtractionId?.trim())

  const resolveFeedEndpoint = useCallback(() => {
    if (feedMode === 'people') return null
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
        const message = parseErrorMessage(data, t('errors.loadFeed'))
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
      onError?.(t('errors.networkLoadFeed'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [onError, resolveFeedEndpoint, t])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  const loadPeople = useCallback(async (q: string) => {
    setUserCardsLoading(true)
    try {
      const params = new URLSearchParams({ q, limit: '20', offset: '0' })
      const res = await fetch(`/api/community/users?${params.toString()}`, { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as { users?: unknown; error?: unknown } | null
      if (!res.ok) {
        onError?.(parseErrorMessage(data, 'Could not load users.'))
        setUserCards([])
        return
      }
      setUserCards(Array.isArray(data?.users) ? (data.users as UserCard[]) : [])
    } catch {
      onError?.('Network error while loading users.')
      setUserCards([])
    } finally {
      setUserCardsLoading(false)
    }
  }, [onError])

  useEffect(() => {
    if (feedMode !== 'people') return
    if (peopleDebounceRef.current) clearTimeout(peopleDebounceRef.current)
    peopleDebounceRef.current = setTimeout(() => {
      void loadPeople(peopleSearch)
    }, 300)
    return () => {
      if (peopleDebounceRef.current) clearTimeout(peopleDebounceRef.current)
    }
  }, [feedMode, peopleSearch, loadPeople])

  const toggleFollowUser = useCallback(
    async (userCard: UserCard) => {
      if (peopleMutationId) return
      setPeopleMutationId(userCard.userId)
      try {
        const method = userCard.isFollowing ? 'DELETE' : 'POST'
        const res = await fetch(`/api/community/follows/${encodeURIComponent(userCard.userId)}`, { method })
        const data = (await res.json().catch(() => null)) as { followed?: boolean; error?: unknown } | null
        if (!res.ok) {
          onError?.(parseErrorMessage(data, t('errors.follow')))
          return
        }
        const followed = data?.followed === true
        setUserCards((prev) =>
          prev.map((u) =>
            u.userId === userCard.userId
              ? {
                  ...u,
                  isFollowing: followed,
                  followerCount: u.followerCount + (followed ? 1 : -1),
                }
              : u,
          ),
        )
      } catch {
        onError?.(t('errors.networkFollow'))
      } finally {
        setPeopleMutationId(null)
      }
    },
    [onError, peopleMutationId, t],
  )

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
          onError?.(parseErrorMessage(data, t('errors.uploadImage')))
          return
        }

        const attachment = data?.attachment
        const url = typeof attachment?.url === 'string' ? attachment.url.trim() : ''
        if (!url) {
          onError?.(t('errors.invalidUpload'))
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
        onError?.(t('errors.networkUploadImage'))
      } finally {
        setImageUploading(false)
      }
    },
    [imageUploading, onError, t],
  )

  const handleCreatePost = useCallback(async () => {
    const content = postContent.trim()
    if (!content || postSubmitting) return

    const normalizedLinkUrl = attachmentLinkUrl.trim() ? normalizeExternalUrl(attachmentLinkUrl) : null
    if (attachmentLinkUrl.trim() && !normalizedLinkUrl) {
      onError?.(t('errors.invalidLink'))
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
        onError?.(parseErrorMessage(data, t('errors.createPost')))
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
      onNotice?.(t('notices.postPublished'))
    } catch {
      onError?.(t('errors.networkCreatePost'))
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
    t,
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
          onError?.(parseErrorMessage(data, t('errors.reaction')))
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
              : item,
          ),
        )
      } catch {
        onError?.(t('errors.networkReaction'))
      } finally {
        setPostMutationId(null)
      }
    },
    [onError, postMutationId, t],
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
          onError?.(parseErrorMessage(data, t('errors.follow')))
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
              : item,
          ),
        )
      } catch {
        onError?.(t('errors.networkFollow'))
      } finally {
        setPostMutationId(null)
      }
    },
    [onError, postMutationId, t],
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
          onError?.(parseErrorMessage(data, t('errors.loadComments')))
          return
        }
        const comments = Array.isArray(data?.comments) ? data.comments : []
        setCommentsByPostId((prev) => ({ ...prev, [postId]: comments }))
      } catch {
        onError?.(t('errors.networkLoadComments'))
      }
    },
    [onError, t],
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
    [commentsByPostId, loadComments],
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
          onError?.(parseErrorMessage(data, t('errors.createComment')))
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
                : item,
            ),
          )
        }
        setCommentDraftByPostId((prev) => ({ ...prev, [postId]: '' }))
      } catch {
        onError?.(t('errors.networkCreateComment'))
      } finally {
        setCommentMutationPostId(null)
      }
    },
    [commentDraftByPostId, commentMutationPostId, onError, t],
  )

  const handleDeleteComment = useCallback(
    async (postId: string, commentId: string) => {
      if (commentMutationPostId) return
      setCommentMutationPostId(postId)
      try {
        const res = await fetch(
          `/api/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
          { method: 'DELETE' },
        )
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        if (!res.ok) {
          onError?.(parseErrorMessage(data, t('errors.deleteComment')))
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
              : item,
          ),
        )
      } catch {
        onError?.(t('errors.networkDeleteComment'))
      } finally {
        setCommentMutationPostId(null)
      }
    },
    [commentMutationPostId, onError, t],
  )

  const showExtractionHint = useMemo(
    () => feedMode === 'extraction' && !canUseExtractionFeed,
    [canUseExtractionFeed, feedMode],
  )

  const now = t('time.now')

  return (
    <section
      className={`mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        className ?? ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('header.title')}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('header.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => void loadFeed()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? t('header.refreshing') : t('header.refresh')}
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <textarea
          value={postContent}
          onChange={(event) => setPostContent(event.target.value)}
          placeholder={t('composer.placeholder')}
          className="min-h-[84px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
              <Link2 size={11} />
              {t('composer.linkBadge')}
            </span>
            <input
              value={attachmentLinkUrl}
              onChange={(event) => setAttachmentLinkUrl(event.target.value)}
              placeholder={t('composer.linkUrlPlaceholder')}
              className="h-8 min-w-[200px] flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <input
              value={attachmentLinkTitle}
              onChange={(event) => setAttachmentLinkTitle(event.target.value)}
              placeholder={t('composer.linkTitlePlaceholder')}
              className="h-8 min-w-[170px] flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-800">
              <ImagePlus size={12} />
              {imageUploading
                ? t('composer.uploadingImage')
                : imageAttachment
                  ? t('composer.changeImage')
                  : t('composer.attachImage')}
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
                {t('composer.removeImage')}
              </button>
            )}
          </div>
          {imageAttachment && (
            <div className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <img
                src={imageAttachment.thumbnailUrl || imageAttachment.url}
                alt={imageAttachment.title || t('composer.imageAlt')}
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
            <option value="private">{t('visibility.private')}</option>
            <option value="circle">{t('visibility.circle')}</option>
            <option value="followers">{t('visibility.followers')}</option>
            <option value="public">{t('visibility.public')}</option>
          </select>
          <label className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={linkCurrentExtraction}
              onChange={(event) => setLinkCurrentExtraction(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            {t('composer.linkCurrentExtraction')}
          </label>
          <button
            type="button"
            onClick={() => void handleCreatePost()}
            disabled={postSubmitting || imageUploading || !postContent.trim()}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            <Send size={12} />
            {postSubmitting ? t('composer.publishing') : t('composer.publish')}
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
          {t('feed.home')}
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
          {t('feed.explore')}
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
          {t('feed.extraction')}
        </button>
        <button
          type="button"
          onClick={() => setFeedMode('people')}
          className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold ${
            feedMode === 'people'
              ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Search size={12} />
          {t('feed.people')}
        </button>
      </div>

      {showExtractionHint && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('feed.openExtractionHint')}</p>
      )}

      {feedMode === 'people' ? (
        <div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              placeholder={t('people.searchPlaceholder')}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-600"
            />
          </div>
          {userCardsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('feed.peopleLoading')}</p>
          ) : userCards.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('feed.noUsersFound')}</p>
          ) : (
            <ul className="space-y-2">
              {userCards.map((userCard) => {
                const displayName = userCard.name?.trim() || userCard.email || 'User'
                const initials = displayName
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? '')
                  .join('')
                return (
                  <li
                    key={userCard.userId}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <Link
                      href={`/community/${encodeURIComponent(userCard.userId)}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        {initials || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700 hover:underline dark:text-slate-200">
                          {displayName}
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{userCard.postCount} {t('people.posts')}</span>
                          <span>{userCard.followerCount} {t('people.followers')}</span>
                          <span>{userCard.followingCount} {t('people.following')}</span>
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); void toggleFollowUser(userCard) }}
                      disabled={peopleMutationId === userCard.userId}
                      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                        userCard.isFollowing
                          ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {userCard.isFollowing ? <UserMinus size={10} /> : <UserPlus size={10} />}
                      {userCard.isFollowing ? t('people.following_btn') : t('people.follow')}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('feed.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('feed.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((post) => {
            const commentsOpen = openCommentsByPostId[post.id] === true
            const comments = commentsByPostId[post.id] ?? []
            return (
              <li
                key={post.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/community/${encodeURIComponent(post.author.userId)}`}
                      className="block truncate text-xs font-semibold text-slate-700 hover:underline dark:text-slate-200"
                    >
                      {post.author.name?.trim() || post.author.email || t('post.userFallback')}
                    </Link>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(post.createdAt, locale, now)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {post.visibility === 'public' ? (
                        <Globe size={10} />
                      ) : post.visibility === 'private' ? (
                        <Lock size={10} />
                      ) : post.visibility === 'circle' ? (
                        <Users size={10} />
                      ) : (
                        <UserPlus size={10} />
                      )}
                      {post.visibility === 'private'
                        ? t('visibility.private')
                        : post.visibility === 'circle'
                          ? t('visibility.circle')
                          : post.visibility === 'followers'
                            ? t('visibility.followers')
                            : t('visibility.public')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleFollow(post)}
                      disabled={postMutationId === post.id}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {post.author.following ? <UserMinus size={10} /> : <UserPlus size={10} />}
                      {post.author.following ? t('post.following') : t('post.follow')}
                    </button>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{post.content}</p>
                {post.source.extractionId && (
                  <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {t('post.sourceLabel')} {post.source.label || `Extraction ${post.source.extractionId}`}
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
                              alt={attachment.title || t('composer.imageAlt')}
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
                            {attachment.attachmentType === 'link' ? t('attachment.link') : attachment.attachmentType}
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
                    {t('post.views', { count: post.metrics.viewsCount })}
                  </span>
                </div>

                {commentsOpen && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                    <div className="space-y-1.5">
                      {comments.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('comments.none')}</p>
                      ) : (
                        comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-800/40"
                          >
                            <Link
                              href={`/community/${encodeURIComponent(comment.userId)}`}
                              className="text-[11px] font-semibold text-slate-600 hover:underline dark:text-slate-300"
                            >
                              {comment.userName?.trim() || comment.userEmail || t('post.userFallback')}
                            </Link>
                            <p className="text-xs text-slate-700 dark:text-slate-200">{comment.content}</p>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {formatDate(comment.createdAt, locale, now)}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteComment(post.id, comment.id)}
                                disabled={commentMutationPostId === post.id}
                                className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-60 dark:text-rose-300"
                              >
                                {t('comments.delete')}
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
                        placeholder={t('comments.placeholder')}
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateComment(post.id)}
                        disabled={
                          commentMutationPostId === post.id || !(commentDraftByPostId[post.id] ?? '').trim()
                        }
                        className="inline-flex h-8 items-center rounded-md bg-slate-800 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {t('comments.send')}
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
