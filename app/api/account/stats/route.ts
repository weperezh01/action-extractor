import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserDashboardStats, getUserStorageInfo } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const [stats, storage] = await Promise.all([
    getUserDashboardStats(user.id),
    getUserStorageInfo(user.id),
  ])

  return NextResponse.json({ ...stats, storage })
}
