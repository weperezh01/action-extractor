import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createExtractionTaskCommentForUser,
  deleteExtractionTaskCommentByIdForUser,
  findExtractionById,
  findExtractionTaskByIdForUser,
  getExtractionTaskLikeSummaryForUser,
  listExtractionTaskCommentsForUser,
  toggleExtractionTaskLikeForUser,
} from '@/lib/db'
import {
  addGuestTaskComment,
  deleteGuestTaskComment,
  findGuestTaskById,
  getGuestTaskLikeSummary,
  listGuestTaskComments,
  toggleGuestTaskLike,
  type GuestTaskComment,
} from '@/lib/guest-tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function toGuestClientComment(comment: GuestTaskComment, extractionId: string) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    extractionId,
    userId: comment.guestId,
    userName: null,
    userEmail: null,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  }
}

async function buildGuestCommunityPayload(input: {
  guestId: string
  taskId: string
  extractionId: string
}) {
  const [comments, likeSummary] = await Promise.all([
    listGuestTaskComments({ guestId: input.guestId, taskId: input.taskId }),
    getGuestTaskLikeSummary({ guestId: input.guestId, taskId: input.taskId }),
  ])

  return {
    comments: comments.map((c) => toGuestClientComment(c, input.extractionId)),
    likeSummary: {
      taskId: input.taskId,
      extractionId: input.extractionId,
      likesCount: likeSummary.likesCount,
      likedByMe: likeSummary.likedByMe,
    },
  }
}

function toClientComment(
  comment: Awaited<ReturnType<typeof listExtractionTaskCommentsForUser>>[number]
) {
  return {
    id: comment.id,
    taskId: comment.task_id,
    extractionId: comment.extraction_id,
    userId: comment.user_id,
    userName: comment.user_name,
    userEmail: comment.user_email,
    content: comment.content,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  }
}

async function buildCommunityPayload(input: { taskId: string; extractionId: string; userId: string }) {
  const [comments, likeSummary] = await Promise.all([
    listExtractionTaskCommentsForUser(input),
    getExtractionTaskLikeSummaryForUser(input),
  ])

  return {
    comments: comments.map(toClientComment),
    likeSummary: {
      taskId: likeSummary.task_id,
      extractionId: likeSummary.extraction_id,
      likesCount: likeSummary.likes_count,
      likedByMe: likeSummary.liked_by_me,
    },
  }
}

async function resolveCommunityAccess(input: {
  extractionId: string
  taskId: string
  actorUserId: string
}) {
  const extraction = await findExtractionById(input.extractionId)
  if (!extraction) {
    return { ok: false as const, status: 404 as const, error: 'No se encontró la extracción solicitada.' }
  }

  const isOwner = extraction.user_id === input.actorUserId
  const isPublic = extraction.share_visibility === 'public'
  if (!isOwner && !isPublic) {
    return { ok: false as const, status: 403 as const, error: 'No tienes acceso a esta extracción.' }
  }

  const task = await findExtractionTaskByIdForUser({
    taskId: input.taskId,
    extractionId: input.extractionId,
    userId: extraction.user_id,
  })
  if (!task) {
    return { ok: false as const, status: 404 as const, error: 'No se encontró el subítem solicitado.' }
  }

  return {
    ok: true as const,
    ownerUserId: extraction.user_id,
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { extractionId: string; taskId: string } }
) {
  try {
    const extractionId = parseId(context.params?.extractionId)
    const taskId = parseId(context.params?.taskId)
    if (!extractionId || !taskId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    // ── Guest mode ──────────────────────────────────────────────────────────
    if (extractionId.startsWith('g-')) {
      const guestId = extractionId.slice(2)
      if (!GUEST_ID_RE.test(guestId)) {
        return NextResponse.json({ error: 'guestId inválido.' }, { status: 400 })
      }
      const task = await findGuestTaskById({ guestId, taskId })
      if (!task) {
        return NextResponse.json({ error: 'No se encontró el subítem solicitado.' }, { status: 404 })
      }
      return NextResponse.json(await buildGuestCommunityPayload({ guestId, taskId, extractionId }))
    }

    // ── Authenticated mode ──────────────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const access = await resolveCommunityAccess({
      extractionId,
      taskId,
      actorUserId: user.id,
    })
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    return NextResponse.json(await buildCommunityPayload({ taskId, extractionId, userId: user.id }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar la comunidad.'
    console.error('[ActionExtractor] task community GET error:', message)
    return NextResponse.json({ error: 'No se pudo cargar la comunidad.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { extractionId: string; taskId: string } }
) {
  try {
    const extractionId = parseId(context.params?.extractionId)
    const taskId = parseId(context.params?.taskId)
    if (!extractionId || !taskId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const action =
      typeof (body as { action?: unknown })?.action === 'string'
        ? (body as { action: string }).action.trim()
        : ''

    // ── Guest mode ──────────────────────────────────────────────────────────
    if (extractionId.startsWith('g-')) {
      const guestId = extractionId.slice(2)
      if (!GUEST_ID_RE.test(guestId)) {
        return NextResponse.json({ error: 'guestId inválido.' }, { status: 400 })
      }

      const task = await findGuestTaskById({ guestId, taskId })
      if (!task) {
        return NextResponse.json({ error: 'No se encontró el subítem solicitado.' }, { status: 404 })
      }

      const guestCommunity = async () =>
        NextResponse.json(await buildGuestCommunityPayload({ guestId, taskId, extractionId }))

      if (action === 'add_comment') {
        const content =
          typeof (body as { content?: unknown }).content === 'string'
            ? (body as { content: string }).content.trim()
            : ''
        if (!content) return NextResponse.json({ error: 'content es requerido.' }, { status: 400 })
        if (content.length > 1500) {
          return NextResponse.json({ error: 'content no puede superar 1500 caracteres.' }, { status: 400 })
        }
        const created = await addGuestTaskComment({ guestId, taskId, content })
        if (!created) return NextResponse.json({ error: 'No se pudo guardar el comentario.' }, { status: 404 })
        return guestCommunity()
      }

      if (action === 'delete_comment') {
        const commentId =
          typeof (body as { commentId?: unknown }).commentId === 'string'
            ? (body as { commentId: string }).commentId.trim()
            : ''
        if (!commentId) return NextResponse.json({ error: 'commentId es requerido.' }, { status: 400 })
        const deleted = await deleteGuestTaskComment({ guestId, taskId, commentId })
        if (!deleted) {
          return NextResponse.json({ error: 'No se encontró el comentario solicitado.' }, { status: 404 })
        }
        return guestCommunity()
      }

      if (action === 'toggle_like') {
        const ok = await toggleGuestTaskLike({ guestId, taskId })
        if (!ok) return NextResponse.json({ error: 'No se pudo actualizar el like.' }, { status: 404 })
        return guestCommunity()
      }

      return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
    }

    // ── Authenticated mode ──────────────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const access = await resolveCommunityAccess({
      extractionId,
      taskId,
      actorUserId: user.id,
    })
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    if (action === 'add_comment') {
      const content =
        typeof (body as { content?: unknown }).content === 'string'
          ? (body as { content: string }).content.trim()
          : ''
      if (!content) {
        return NextResponse.json({ error: 'content es requerido.' }, { status: 400 })
      }
      if (content.length > 1500) {
        return NextResponse.json({ error: 'content no puede superar 1500 caracteres.' }, { status: 400 })
      }

      const created = await createExtractionTaskCommentForUser({
        taskId,
        extractionId,
        userId: user.id,
        content,
      })
      if (!created) {
        return NextResponse.json({ error: 'No se pudo guardar el comentario.' }, { status: 404 })
      }

      return NextResponse.json(await buildCommunityPayload({ taskId, extractionId, userId: user.id }))
    }

    if (action === 'delete_comment') {
      const commentId =
        typeof (body as { commentId?: unknown }).commentId === 'string'
          ? (body as { commentId: string }).commentId.trim()
          : ''
      if (!commentId) {
        return NextResponse.json({ error: 'commentId es requerido.' }, { status: 400 })
      }

      const deleted = await deleteExtractionTaskCommentByIdForUser({
        commentId,
        taskId,
        extractionId,
        userId: user.id,
      })
      if (!deleted) {
        return NextResponse.json({ error: 'No se encontró el comentario solicitado.' }, { status: 404 })
      }

      return NextResponse.json(await buildCommunityPayload({ taskId, extractionId, userId: user.id }))
    }

    if (action === 'toggle_like') {
      const toggled = await toggleExtractionTaskLikeForUser({
        taskId,
        extractionId,
        userId: user.id,
      })
      if (!toggled) {
        return NextResponse.json({ error: 'No se pudo actualizar el like.' }, { status: 404 })
      }

      return NextResponse.json(await buildCommunityPayload({ taskId, extractionId, userId: user.id }))
    }

    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la comunidad.'
    console.error('[ActionExtractor] task community POST error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar la comunidad.' }, { status: 500 })
  }
}
