import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserExtractionRateLimitSnapshot } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const snapshot = await getUserExtractionRateLimitSnapshot(user.id)

    return NextResponse.json({
      limit: snapshot.limit,
      used: snapshot.used,
      remaining: snapshot.remaining,
      resetAt: snapshot.resetAt,
      retryAfterSeconds: snapshot.retryAfterSeconds,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] rate-limit GET error:', message)
    return NextResponse.json({ error: 'No se pudo obtener el estado del límite.' }, { status: 500 })
  }
}
