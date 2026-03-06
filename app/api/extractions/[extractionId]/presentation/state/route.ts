import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionAccessForUser,
  getPresentationState,
  setPresentationState,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function GET(
  req: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const extractionId = parseExtractionId(params.extractionId)
    if (!extractionId) return NextResponse.json({ error: 'Invalid extraction ID' }, { status: 400 })

    const access = await findExtractionAccessForUser({ id: extractionId, userId: user.id })
    if (!access.extraction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!access.role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const state = await getPresentationState({ extractionId, userId: user.id })
    return NextResponse.json({ lastSlideId: state?.lastSlideId ?? null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load presentation state'
    console.error('[ActionExtractor] presentation state GET error:', message)
    return NextResponse.json({ error: 'Failed to load presentation state' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const extractionId = parseExtractionId(params.extractionId)
    if (!extractionId) return NextResponse.json({ error: 'Invalid extraction ID' }, { status: 400 })

    const access = await findExtractionAccessForUser({ id: extractionId, userId: user.id })
    if (!access.extraction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!access.role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const lastSlideId = (body as { lastSlideId?: unknown }).lastSlideId
    if (typeof lastSlideId !== 'string' || !lastSlideId.trim()) {
      return NextResponse.json({ error: 'lastSlideId is required' }, { status: 400 })
    }

    await setPresentationState({
      extractionId,
      userId: user.id,
      lastSlideId: lastSlideId.trim(),
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save presentation state'
    console.error('[ActionExtractor] presentation state POST error:', message)
    return NextResponse.json({ error: 'Failed to save presentation state' }, { status: 500 })
  }
}
