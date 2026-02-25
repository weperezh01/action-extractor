import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionAccessForUser,
  findExtractionTaskByIdForUser,
} from '@/lib/db'
import { findGuestTaskById } from '@/lib/guest-tasks'
import { subscribeTaskCommunityRefreshEvent } from '@/lib/task-community-realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function formatSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

async function resolveCommunityAccess(input: {
  extractionId: string
  taskId: string
  actorUserId: string
}) {
  const access = await findExtractionAccessForUser({
    id: input.extractionId,
    userId: input.actorUserId,
  })
  const extraction = access.extraction
  if (!extraction) {
    return { ok: false as const, status: 404 as const, error: 'No se encontró la extracción solicitada.' }
  }

  const isPublicLinkVisibility =
    extraction.share_visibility === 'public' || extraction.share_visibility === 'unlisted'
  const hasCircleAccess = access.role !== null
  if (!hasCircleAccess && !isPublicLinkVisibility) {
    return { ok: false as const, status: 403 as const, error: 'No tienes acceso a esta extracción.' }
  }

  const task = await findExtractionTaskByIdForUser({
    taskId: input.taskId,
    extractionId: input.extractionId,
  })
  if (!task) {
    return { ok: false as const, status: 404 as const, error: 'No se encontró el subítem solicitado.' }
  }

  return {
    ok: true as const,
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

    if (extractionId.startsWith('g-')) {
      const guestId = extractionId.slice(2)
      if (!GUEST_ID_RE.test(guestId)) {
        return NextResponse.json({ error: 'guestId inválido.' }, { status: 400 })
      }
      const task = await findGuestTaskById({ guestId, taskId })
      if (!task) {
        return NextResponse.json({ error: 'No se encontró el subítem solicitado.' }, { status: 404 })
      }
    } else {
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
    }

    let cleanup = () => {}

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        let closed = false
        let heartbeatId: ReturnType<typeof setInterval> | null = null
        let unsubscribe = () => {}

        const send = (event: string, payload: unknown) => {
          if (closed) return
          try {
            controller.enqueue(encoder.encode(formatSseEvent(event, payload)))
          } catch {
            close()
          }
        }

        const close = () => {
          if (closed) return
          closed = true
          if (heartbeatId) {
            clearInterval(heartbeatId)
            heartbeatId = null
          }
          unsubscribe()
          req.signal.removeEventListener('abort', close)
          try {
            controller.close()
          } catch {
            // noop: stream may already be closed
          }
        }

        cleanup = close

        unsubscribe = subscribeTaskCommunityRefreshEvent(
          { extractionId, taskId },
          (event) => {
            send('community_refresh', event)
          }
        )

        send('community_ready', {
          extractionId,
          taskId,
          at: new Date().toISOString(),
        })

        heartbeatId = setInterval(() => {
          send('ping', { at: new Date().toISOString() })
        }, 20000)

        req.signal.addEventListener('abort', close)
      },
      cancel() {
        cleanup()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo abrir el stream de comunidad.'
    console.error('[ActionExtractor] task community stream GET error:', message)
    return NextResponse.json({ error: 'No se pudo abrir el stream de comunidad.' }, { status: 500 })
  }
}
