import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { searchCommunityUsers } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') ?? ''
    const limit = clamp(Number(searchParams.get('limit') ?? '20'), 1, 50)
    const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

    const users = await searchCommunityUsers({
      currentUserId: user.id,
      q,
      limit,
      offset,
    })

    return NextResponse.json({ users })
  } catch (error: unknown) {
    console.error('[GET /api/community/users]', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
