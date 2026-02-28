import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { listPlans, createPlan } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const plans = await listPlans()
  return NextResponse.json({ plans })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as {
    name?: unknown
    displayName?: unknown
    priceMonthlyUsd?: unknown
    stripePriceId?: unknown
    extractionsPerHour?: unknown
    featuresJson?: unknown
    isActive?: unknown
    displayOrder?: unknown
  } | null

  if (!body) return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const priceMonthlyUsd = Number(body.priceMonthlyUsd ?? 0)
  const extractionsPerHour = Number(body.extractionsPerHour ?? 12)
  const displayOrder = Number(body.displayOrder ?? 0)
  const stripePriceId = typeof body.stripePriceId === 'string' ? body.stripePriceId.trim() : null
  const featuresJson = typeof body.featuresJson === 'string' ? body.featuresJson : '{}'
  const isActive = body.isActive !== false

  if (!name || !displayName) {
    return NextResponse.json({ error: 'name y displayName son requeridos.' }, { status: 400 })
  }
  if (!Number.isFinite(priceMonthlyUsd) || priceMonthlyUsd < 0) {
    return NextResponse.json({ error: 'Precio inválido.' }, { status: 400 })
  }
  if (!Number.isFinite(extractionsPerHour) || extractionsPerHour < 1) {
    return NextResponse.json({ error: 'extractionsPerHour debe ser ≥ 1.' }, { status: 400 })
  }

  // Validate featuresJson
  try { JSON.parse(featuresJson) } catch {
    return NextResponse.json({ error: 'featuresJson no es JSON válido.' }, { status: 400 })
  }

  const plan = await createPlan({
    name,
    displayName,
    priceMonthlyUsd,
    stripePriceId: stripePriceId || null,
    extractionsPerHour,
    featuresJson,
    isActive,
    displayOrder,
  })

  return NextResponse.json({ plan }, { status: 201 })
}
