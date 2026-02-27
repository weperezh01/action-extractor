import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createCommunityPostForUser,
  findExtractionAccessForUser,
  findExtractionTaskByIdForUser,
  type CommunityPostAttachmentStorageProvider,
  type CommunityPostAttachmentType,
  type CommunityPostVisibility,
  type DbCommunityPost,
} from '@/lib/db'
import {
  buildCommunityActionRateLimitMessage,
  consumeUserCommunityActionRateLimit,
} from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CONTENT_LENGTH = 4000
const MAX_ATTACHMENTS = 8

interface ParsedAttachment {
  attachmentType: CommunityPostAttachmentType
  storageProvider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnailUrl: string | null
  title: string | null
  mimeType: string | null
  metadataJson: string
}

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseVisibility(raw: unknown): CommunityPostVisibility | null {
  if (raw === 'private' || raw === 'circle' || raw === 'followers' || raw === 'public') {
    return raw
  }
  return null
}

function parseAttachmentType(raw: unknown): CommunityPostAttachmentType {
  if (raw === 'image' || raw === 'audio' || raw === 'video' || raw === 'file') return raw
  return 'link'
}

function parseAttachmentStorageProvider(raw: unknown): CommunityPostAttachmentStorageProvider {
  return raw === 'cloudinary' ? 'cloudinary' : 'external'
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? {})
  } catch {
    return '{}'
  }
}

function parseAttachments(raw: unknown): { ok: true; attachments: ParsedAttachment[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] }
  if (!Array.isArray(raw)) return { ok: false, error: 'attachments debe ser una lista.' }
  if (raw.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `attachments no puede superar ${MAX_ATTACHMENTS} elementos.` }
  }

  const parsed: ParsedAttachment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Cada attachment debe ser un objeto válido.' }
    }

    const url = parseId((item as { url?: unknown }).url)
    if (!url) {
      return { ok: false, error: 'Cada attachment requiere url.' }
    }

    const thumbnailRaw = (item as { thumbnailUrl?: unknown }).thumbnailUrl
    const titleRaw = (item as { title?: unknown }).title
    const mimeRaw = (item as { mimeType?: unknown }).mimeType

    parsed.push({
      attachmentType: parseAttachmentType((item as { attachmentType?: unknown }).attachmentType),
      storageProvider: parseAttachmentStorageProvider((item as { storageProvider?: unknown }).storageProvider),
      url,
      thumbnailUrl: typeof thumbnailRaw === 'string' && thumbnailRaw.trim() ? thumbnailRaw.trim() : null,
      title: typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : null,
      mimeType: typeof mimeRaw === 'string' && mimeRaw.trim() ? mimeRaw.trim() : null,
      metadataJson: safeJsonStringify((item as { metadata?: unknown }).metadata),
    })
  }

  return { ok: true, attachments: parsed }
}

function toClientPost(post: DbCommunityPost) {
  return {
    id: post.id,
    content: post.content,
    visibility: post.visibility,
    metadataJson: post.metadata_json,
    source: {
      extractionId: post.source_extraction_id,
      taskId: post.source_task_id,
      label: post.source_label,
    },
    metrics: {
      reactionsCount: post.reactions_count,
      commentsCount: post.comments_count,
      viewsCount: post.views_count,
      reactedByMe: post.reacted_by_me,
    },
    author: {
      userId: post.user_id,
      name: post.user_name,
      email: post.user_email,
      following: post.following_author,
    },
    attachments: post.attachments.map((attachment) => ({
      id: attachment.id,
      attachmentType: attachment.attachment_type,
      storageProvider: attachment.storage_provider,
      url: attachment.url,
      thumbnailUrl: attachment.thumbnail_url,
      title: attachment.title,
      mimeType: attachment.mime_type,
      metadataJson: attachment.metadata_json,
      createdAt: attachment.created_at,
      updatedAt: attachment.updated_at,
    })),
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const rateLimit = await consumeUserCommunityActionRateLimit(user.id, 'post')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: buildCommunityActionRateLimitMessage('post', rateLimit.limit),
          rateLimit: {
            limit: rateLimit.limit,
            used: rateLimit.used,
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': rateLimit.resetAt,
          },
        }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const content =
      typeof (body as { content?: unknown }).content === 'string'
        ? (body as { content: string }).content.trim()
        : ''
    if (!content) {
      return NextResponse.json({ error: 'content es requerido.' }, { status: 400 })
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `content no puede superar ${MAX_CONTENT_LENGTH} caracteres.` },
        { status: 400 }
      )
    }

    const rawVisibility = (body as { visibility?: unknown }).visibility
    const visibility =
      rawVisibility === undefined ? 'followers' : parseVisibility(rawVisibility)
    if (!visibility) {
      return NextResponse.json(
        { error: 'visibility inválido. Usa private, circle, followers o public.' },
        { status: 400 }
      )
    }

    const extractionId = parseId((body as { extractionId?: unknown }).extractionId)
    const taskId = parseId((body as { taskId?: unknown }).taskId)
    const sourceLabelRaw = (body as { sourceLabel?: unknown }).sourceLabel
    const sourceLabel =
      typeof sourceLabelRaw === 'string' && sourceLabelRaw.trim()
        ? sourceLabelRaw.trim().slice(0, 180)
        : null

    if (taskId && !extractionId) {
      return NextResponse.json(
        { error: 'taskId requiere extractionId para enlazar el post.' },
        { status: 400 }
      )
    }

    if (visibility === 'circle' && !extractionId) {
      return NextResponse.json(
        { error: 'visibility=circle requiere extractionId para definir el círculo.' },
        { status: 400 }
      )
    }

    if (extractionId) {
      const access = await findExtractionAccessForUser({
        id: extractionId,
        userId: user.id,
      })
      if (!access.extraction) {
        return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
      }
      if (!access.role) {
        return NextResponse.json(
          { error: 'No tienes acceso a la extracción indicada para enlazar el post.' },
          { status: 403 }
        )
      }
    }

    if (taskId) {
      const task = await findExtractionTaskByIdForUser({
        taskId,
        extractionId,
      })
      if (!task) {
        return NextResponse.json({ error: 'No se encontró la tarea indicada.' }, { status: 404 })
      }
    }

    const parsedAttachments = parseAttachments((body as { attachments?: unknown }).attachments)
    if (!parsedAttachments.ok) {
      return NextResponse.json({ error: parsedAttachments.error }, { status: 400 })
    }

    const created = await createCommunityPostForUser({
      userId: user.id,
      content,
      visibility,
      metadataJson: safeJsonStringify((body as { metadata?: unknown }).metadata),
      source:
        extractionId || taskId || sourceLabel
          ? {
              extractionId: extractionId || null,
              taskId: taskId || null,
              sourceLabel,
            }
          : null,
      attachments: parsedAttachments.attachments,
    })

    if (!created) {
      return NextResponse.json({ error: 'No se pudo crear el post.' }, { status: 500 })
    }

    return NextResponse.json(
      {
        post: toClientPost(created),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el post.'
    console.error('[ActionExtractor] community posts POST error:', message)
    return NextResponse.json({ error: 'No se pudo crear el post.' }, { status: 500 })
  }
}
