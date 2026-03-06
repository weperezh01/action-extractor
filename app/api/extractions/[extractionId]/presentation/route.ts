import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionAccessForUser,
  getPresentationDeck,
  savePresentationDeck,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseStoredDeck(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function createDefaultDeck() {
  return {
    version: 1,
    slides: [
      {
        id: randomUUID(),
        title: 'Slide 1',
        background: '#ffffff',
        elements: [],
      },
    ],
  }
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

    const storedDeck = await getPresentationDeck({ extractionId })
    const deck = storedDeck ? parseStoredDeck(storedDeck.deckJson) : null

    return NextResponse.json({ deck })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load presentation deck'
    console.error('[ActionExtractor] presentation GET error:', message)
    return NextResponse.json({ error: 'Failed to load presentation deck' }, { status: 500 })
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

    const canEdit = access.role === 'owner' || access.role === 'editor'
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { action } = body as Record<string, unknown>

    if (action === 'save_deck') {
      const deck = (body as Record<string, unknown>).deck
      if (!deck || typeof deck !== 'object' || Array.isArray(deck)) {
        return NextResponse.json({ error: 'deck must be an object' }, { status: 400 })
      }
      await savePresentationDeck({ extractionId, deckJson: JSON.stringify(deck) })
      return NextResponse.json({ ok: true })
    }

    if (action === 'create_default') {
      const existing = await getPresentationDeck({ extractionId })
      if (existing) {
        const existingDeck = parseStoredDeck(existing.deckJson)
        if (existingDeck) return NextResponse.json({ ok: true, deck: existingDeck })
      }

      const deck = createDefaultDeck()
      await savePresentationDeck({ extractionId, deckJson: JSON.stringify(deck) })
      return NextResponse.json({ ok: true, deck })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save presentation deck'
    console.error('[ActionExtractor] presentation POST error:', message)
    return NextResponse.json({ error: 'Failed to save presentation deck' }, { status: 500 })
  }
}
