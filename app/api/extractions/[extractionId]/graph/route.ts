import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteTaskEdge,
  findExtractionAccessForUser,
  listDecisionSelections,
  listExtractionTaskEdges,
  listFlowNodePositions,
  updateExtractionTaskFlowNodeType,
  upsertDecisionSelection,
  upsertFlowNodePosition,
  upsertTaskEdge,
} from '@/lib/db/extractions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function GET(
  req: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const extractionId = parseExtractionId(params.extractionId)
  if (!extractionId) return NextResponse.json({ error: 'Invalid extraction ID' }, { status: 400 })

  const access = await findExtractionAccessForUser({ id: extractionId, userId: user.id })
  if (!access.extraction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!access.role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [edges, decisionSelections, nodePositions] = await Promise.all([
    listExtractionTaskEdges(extractionId),
    listDecisionSelections(extractionId),
    listFlowNodePositions(extractionId),
  ])

  return NextResponse.json({
    edges: edges.map((e) => ({
      id: e.id,
      extractionId: e.extraction_id,
      fromTaskId: e.from_task_id,
      toTaskId: e.to_task_id,
      edgeType: e.edge_type,
      label: e.label,
      expectedExtraDays: e.expected_extra_days,
      sortOrder: e.sort_order,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
    decisionSelections: decisionSelections.map((s) => ({
      extractionId: s.extraction_id,
      decisionTaskId: s.decision_task_id,
      selectedToTaskId: s.selected_to_task_id,
    })),
    nodePositions: nodePositions.map((p) => ({
      taskId: p.task_id,
      cx: p.cx,
      cy: p.cy,
    })),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { extractionId: string } }
) {
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

  // ── update_node ───────────────────────────────────────────────────────────
  if (action === 'update_node') {
    const { taskId, flowNodeType } = body as { taskId: unknown; flowNodeType: unknown }
    if (typeof taskId !== 'string' || !taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    }
    if (flowNodeType !== 'process' && flowNodeType !== 'decision') {
      return NextResponse.json({ error: 'flowNodeType must be process or decision' }, { status: 400 })
    }
    await updateExtractionTaskFlowNodeType({ taskId, extractionId, flowNodeType })
    return NextResponse.json({ ok: true })
  }

  // ── upsert_edge ───────────────────────────────────────────────────────────
  if (action === 'upsert_edge') {
    const { fromTaskId, toTaskId, edgeType, label, expectedExtraDays } = body as Record<string, unknown>
    if (typeof fromTaskId !== 'string' || !fromTaskId) {
      return NextResponse.json({ error: 'fromTaskId required' }, { status: 400 })
    }
    if (typeof toTaskId !== 'string' || !toTaskId) {
      return NextResponse.json({ error: 'toTaskId required' }, { status: 400 })
    }
    if (edgeType !== 'and' && edgeType !== 'xor' && edgeType !== 'loop') {
      return NextResponse.json({ error: 'edgeType must be and, xor, or loop' }, { status: 400 })
    }
    if (fromTaskId === toTaskId) {
      return NextResponse.json({ error: 'Self-loops are not allowed' }, { status: 400 })
    }
    const edge = await upsertTaskEdge({
      extractionId,
      fromTaskId,
      toTaskId,
      edgeType,
      label: typeof label === 'string' && label.trim() ? label.trim() : null,
      expectedExtraDays: typeof expectedExtraDays === 'number' ? expectedExtraDays : null,
    })
    return NextResponse.json({
      ok: true,
      edge: {
        id: edge.id,
        extractionId: edge.extraction_id,
        fromTaskId: edge.from_task_id,
        toTaskId: edge.to_task_id,
        edgeType: edge.edge_type,
        label: edge.label,
        expectedExtraDays: edge.expected_extra_days,
        sortOrder: edge.sort_order,
        createdAt: edge.created_at,
        updatedAt: edge.updated_at,
      },
    })
  }

  // ── delete_edge ───────────────────────────────────────────────────────────
  if (action === 'delete_edge') {
    const { fromTaskId, toTaskId, edgeType } = body as Record<string, unknown>
    if (typeof fromTaskId !== 'string' || !fromTaskId) {
      return NextResponse.json({ error: 'fromTaskId required' }, { status: 400 })
    }
    if (typeof toTaskId !== 'string' || !toTaskId) {
      return NextResponse.json({ error: 'toTaskId required' }, { status: 400 })
    }
    if (edgeType !== 'and' && edgeType !== 'xor' && edgeType !== 'loop') {
      return NextResponse.json({ error: 'edgeType must be and, xor, or loop' }, { status: 400 })
    }
    await deleteTaskEdge({ extractionId, fromTaskId, toTaskId, edgeType })
    return NextResponse.json({ ok: true })
  }

  // ── select_branch ─────────────────────────────────────────────────────────
  if (action === 'select_branch') {
    const { decisionTaskId, selectedToTaskId } = body as Record<string, unknown>
    if (typeof decisionTaskId !== 'string' || !decisionTaskId) {
      return NextResponse.json({ error: 'decisionTaskId required' }, { status: 400 })
    }
    if (typeof selectedToTaskId !== 'string' || !selectedToTaskId) {
      return NextResponse.json({ error: 'selectedToTaskId required' }, { status: 400 })
    }
    await upsertDecisionSelection({ extractionId, decisionTaskId, selectedToTaskId })
    return NextResponse.json({ ok: true })
  }

  // ── update_node_position ─────────────────────────────────────────────────
  if (action === 'update_node_position') {
    const { taskId, cx, cy } = body as { taskId: unknown; cx: unknown; cy: unknown }
    if (typeof taskId !== 'string' || !taskId)
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    if (typeof cx !== 'number' || typeof cy !== 'number' || !isFinite(cx) || !isFinite(cy))
      return NextResponse.json({ error: 'cx and cy must be finite numbers' }, { status: 400 })
    await upsertFlowNodePosition({ taskId, extractionId, cx, cy })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
