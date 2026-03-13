import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    return NextResponse.json({ user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not load session.'
    console.error('[ActionExtractor] auth/session GET error:', message)
    return NextResponse.json({ user: null, error: 'No se pudo cargar la sesión.' }, { status: 500 })
  }
}
