import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie, deleteSessionForRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  await deleteSessionForRequest(req)
  const response = NextResponse.json({ ok: true })
  clearSessionCookie(response)
  return response
}
