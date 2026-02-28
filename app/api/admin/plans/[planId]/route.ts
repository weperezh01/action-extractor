import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { updatePlan, deletePlan } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { planId } = params
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })

  const input: Parameters<typeof updatePlan>[1] = {}

  if (typeof body.name === 'string') input.name = body.name
  if (typeof body.displayName === 'string') input.displayName = body.displayName
  if (typeof body.priceMonthlyUsd === 'number') input.priceMonthlyUsd = body.priceMonthlyUsd
  if ('stripePriceId' in body) input.stripePriceId = body.stripePriceId as string | null
  if (typeof body.extractionsPerHour === 'number') input.extractionsPerHour = body.extractionsPerHour
  if (typeof body.featuresJson === 'string') {
    try { JSON.parse(body.featuresJson) } catch {
      return NextResponse.json({ error: 'featuresJson no es JSON válido.' }, { status: 400 })
    }
    input.featuresJson = body.featuresJson
  }
  if (typeof body.isActive === 'boolean') input.isActive = body.isActive
  if (typeof body.displayOrder === 'number') input.displayOrder = body.displayOrder

  const plan = await updatePlan(planId, input)
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado.' }, { status: 404 })

  return NextResponse.json({ plan })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { planId } = params

  // Protect seed plans from deletion
  if (['plan_free', 'plan_pro', 'plan_business'].includes(planId)) {
    return NextResponse.json(
      { error: 'Los planes predeterminados (Free, Pro, Business) no se pueden eliminar.' },
      { status: 400 }
    )
  }

  await deletePlan(planId)
  return NextResponse.json({ ok: true })
}
