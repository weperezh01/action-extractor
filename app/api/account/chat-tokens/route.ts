import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getChatTokenSnapshot } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const snapshot = await getChatTokenSnapshot(user.id)
    return NextResponse.json(snapshot)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] chat-tokens GET error:', message)
    return NextResponse.json({ error: 'No se pudo obtener el estado de tokens.' }, { status: 500 })
  }
}
