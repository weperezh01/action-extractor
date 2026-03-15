'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, RefreshCw, Trash2, Workflow, X, Zap } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { DecisionSelection, EdgeType, FlowNodeType, InteractiveTask, TaskEdge } from '../lib/types'
import { useLang } from '@/app/home/hooks/useLang'

// ── Layout constants ──────────────────────────────────────────────────────────
const PW = 164   // process node width
const PH = 52    // process node height
const DS = 84    // decision diamond bounding-box size (DS × DS square)
const H_GAP = 52 // horizontal gap between nodes in same level
const V_GAP = 88 // vertical gap between levels
const NODE_SLOT_H = Math.max(PH, DS) // used for level-Y computation

// ── Minimap constants ─────────────────────────────────────────────────────────
const MM_W = 160
const MM_H = 100
const MM_PAD = 8

// ── Edge visual config ────────────────────────────────────────────────────────
const EDGE_COLOR: Record<EdgeType, string> = {
  and: '#64748b',
  xor: '#f59e0b',
  loop: '#8b5cf6',
}
const EDGE_DASH: Record<EdgeType, string> = {
  and: '',
  xor: '6 3',
  loop: '3 5',
}
const FLOWCHART_COPY = {
  en: {
    projectDuration: 'Project duration',
    criticalTasks: 'Tasks on the critical path',
    slackTasks: 'With slack',
    xorWarning: 'There are decision nodes (XOR) without a selected branch. Use the node editor to choose the branch for the CPM scenario.',
    noCriticalPath: 'No critical path identified. Add sequential (AND) edges to begin.',
    criticalPath: 'Critical path',
    noTasks: 'No tasks to display.',
    processSummary: (tasks: number, edges: number) => `Process · ${tasks} nodes · ${edges} edges`,
    durationSummary: (duration: number, critical: number) =>
      `Duration: ${duration}d · ${critical} critical ${critical === 1 ? 'task' : 'tasks'}`,
    resetView: 'Reset view',
    reset: 'Reiniciar',
    type: 'Type:',
    editNode: 'Edit node',
    nodeType: 'Node type',
    outgoingEdges: (count: number) => `Outgoing edges (${count})`,
    noEdges: 'No edges. Add one below.',
    useForCpm: 'Use this branch for the CPM calculation',
    addOutgoingEdge: '+ Add outgoing edge',
    labelOptional: 'Label (optional)',
    expectedExtraDays: 'Expected extra days (loop)',
    searchTargetTask: 'Search target task...',
    process: 'Process',
    decision: 'Decision',
    sequential: 'Sequential',
    loop: 'Loop',
  },
  es: {
    projectDuration: 'Duración del proyecto',
    criticalTasks: 'Tareas en ruta crítica',
    slackTasks: 'Con holgura',
    xorWarning: 'Hay nodos de decisión (XOR) sin rama seleccionada. Usa el editor de nodo para elegir la rama del escenario CPM.',
    noCriticalPath: 'Sin ruta crítica identificada. Agrega aristas secuenciales (AND) para comenzar.',
    criticalPath: 'Ruta crítica',
    noTasks: 'Sin tareas para mostrar.',
    processSummary: (tasks: number, edges: number) => `Proceso · ${tasks} nodos · ${edges} aristas`,
    durationSummary: (duration: number, critical: number) =>
      `Duración: ${duration}d · ${critical} crítica${critical !== 1 ? 's' : ''}`,
    resetView: 'Restablecer vista',
    reset: 'Reset',
    type: 'Tipo:',
    editNode: 'Editar nodo',
    nodeType: 'Tipo de nodo',
    outgoingEdges: (count: number) => `Aristas salientes (${count})`,
    noEdges: 'Sin aristas. Agrega una abajo.',
    useForCpm: 'Usar esta rama para el cálculo CPM',
    addOutgoingEdge: '+ Agregar arista saliente',
    labelOptional: 'Etiqueta (opcional)',
    expectedExtraDays: 'Días extra esperados (bucle)',
    searchTargetTask: 'Buscar tarea destino...',
    process: 'Proceso',
    decision: 'Decisión',
    sequential: 'Secuencial',
    loop: 'Bucle',
  },
} as const

function getEdgeTypeLabel(edgeType: EdgeType, lang: 'en' | 'es') {
  if (edgeType === 'and') return FLOWCHART_COPY[lang].sequential
  if (edgeType === 'xor') return `${FLOWCHART_COPY[lang].decision} (XOR)`
  return FLOWCHART_COPY[lang].loop
}

// ── VNode: a positioned node in canvas-space (0,0 = canvas center) ────────────
interface VNode {
  id: string
  cx: number
  cy: number
  level: number
  flowNodeType: FlowNodeType
}

// ── Layout algorithm ─────────────────────────────────────────────────────────
function buildLayout(tasks: InteractiveTask[], edges: TaskEdge[]): Map<string, VNode> {
  if (tasks.length === 0) return new Map()

  const taskSet = new Set(tasks.map((t) => t.id))
  const succ = new Map<string, string[]>()
  const inDeg = new Map<string, number>()

  for (const t of tasks) {
    succ.set(t.id, [])
    inDeg.set(t.id, 0)
  }

  for (const e of edges) {
    if (e.edgeType === 'loop') continue // skip back-edges for layout
    if (!taskSet.has(e.fromTaskId) || !taskSet.has(e.toTaskId)) continue
    succ.get(e.fromTaskId)!.push(e.toTaskId)
    inDeg.set(e.toTaskId, (inDeg.get(e.toTaskId) ?? 0) + 1)
  }

  // Level assignment via relaxed BFS (longest path)
  const level = new Map<string, number>()
  const q: string[] = []
  for (const t of tasks) {
    if ((inDeg.get(t.id) ?? 0) === 0) {
      level.set(t.id, 0)
      q.push(t.id)
    }
  }

  let qi = 0
  const visited = new Set<string>()
  while (qi < q.length) {
    const id = q[qi++]
    if (visited.has(id)) continue
    visited.add(id)
    const cur = level.get(id) ?? 0
    for (const s of succ.get(id) ?? []) {
      if ((level.get(s) ?? -1) <= cur) level.set(s, cur + 1)
      if (!visited.has(s)) q.push(s)
    }
  }
  // Any unreached node (cycle participant) → level 0
  for (const t of tasks) if (!level.has(t.id)) level.set(t.id, 0)

  // Group by level and sort within each level
  const groups = new Map<number, InteractiveTask[]>()
  for (const t of tasks) {
    const l = level.get(t.id) ?? 0
    if (!groups.has(l)) groups.set(l, [])
    groups.get(l)!.push(t)
  }
  for (const g of Array.from(groups.values())) {
    g.sort((a: InteractiveTask, b: InteractiveTask) => a.phaseId - b.phaseId || a.itemIndex - b.itemIndex)
  }

  // Compute positions
  const nodes = new Map<string, VNode>()
  for (const [l, g] of Array.from(groups.entries())) {
    const totalW = g.length * PW + (g.length - 1) * H_GAP
    const startX = -totalW / 2
    for (let i = 0; i < g.length; i++) {
      const t = g[i]
      nodes.set(t.id, {
        id: t.id,
        cx: startX + i * (PW + H_GAP) + PW / 2,
        cy: l * (NODE_SLOT_H + V_GAP) + NODE_SLOT_H / 2,
        level: l,
        flowNodeType: t.flowNodeType ?? 'process',
      })
    }
  }
  return nodes
}

// ── Port helpers ──────────────────────────────────────────────────────────────
function getPort(n: VNode, side: 'top' | 'bottom'): [number, number] {
  const halfH = n.flowNodeType === 'decision' ? DS / 2 : PH / 2
  return [n.cx, side === 'top' ? n.cy - halfH : n.cy + halfH]
}

// ── Build per-edge lateral offsets for parallel edges ─────────────────────────
function buildEdgePairOffsets(edges: TaskEdge[]): Map<string, number> {
  // Group edges by unordered pair (fromTaskId, toTaskId)
  const groups = new Map<string, string[]>()
  for (const e of edges) {
    const key = [e.fromTaskId, e.toTaskId].sort().join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(`${e.fromTaskId}:${e.toTaskId}:${e.edgeType}`)
  }
  const result = new Map<string, number>()
  for (const ids of Array.from(groups.values())) {
    if (ids.length === 1) {
      result.set(ids[0], 0)
    } else {
      const mid = (ids.length - 1) / 2
      ids.forEach((id, i) => result.set(id, (i - mid) * 10))
    }
  }
  return result
}

// ── Edge SVG path ─────────────────────────────────────────────────────────────
function edgePath(src: VNode, tgt: VNode, lateralOffsetPx = 0): string {
  const [sxBase, sy] = getPort(src, 'bottom')
  const [txBase, ty] = getPort(tgt, 'top')
  const sx = sxBase + lateralOffsetPx
  const tx = txBase + lateralOffsetPx

  if (src.level >= tgt.level) {
    // Back-edge (loop): arc going around the right side
    const rx = Math.max(src.cx, tgt.cx) + PW * 0.9
    const my = (sy + ty) / 2
    return `M ${sx} ${sy} C ${sx + 30} ${sy + 24} ${rx} ${sy} ${rx} ${my} S ${rx} ${ty} ${tx} ${ty}`
  }

  const dist = Math.abs(ty - sy)
  const cpStr = Math.min(dist * 0.55, 120)
  return `M ${sx} ${sy} C ${sx} ${sy + cpStr} ${tx} ${ty - cpStr} ${tx} ${ty}`
}

// ── CPM computation ───────────────────────────────────────────────────────────
export interface CpmResult {
  es: number
  ef: number
  ls: number
  lf: number
  slack: number
  critical: boolean
}

export function computeCpm(
  tasks: InteractiveTask[],
  edges: TaskEdge[],
  selections: DecisionSelection[]
): Map<string, CpmResult> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const selMap = new Map(selections.map((s) => [s.decisionTaskId, s.selectedToTaskId]))

  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const t of tasks) {
    preds.set(t.id, [])
    succs.set(t.id, [])
  }

  for (const e of edges) {
    if (e.edgeType === 'loop') continue // loops excluded from CPM
    if (e.edgeType === 'xor') {
      // Only include the selected branch
      if (selMap.get(e.fromTaskId) !== e.toTaskId) continue
    }
    if (!taskMap.has(e.fromTaskId) || !taskMap.has(e.toTaskId)) continue
    preds.get(e.toTaskId)!.push(e.fromTaskId)
    succs.get(e.fromTaskId)!.push(e.toTaskId)
  }

  // Kahn's topological sort
  const inDeg = new Map<string, number>()
  for (const t of tasks) inDeg.set(t.id, preds.get(t.id)!.length)
  const q: string[] = []
  for (const t of tasks) if ((inDeg.get(t.id) ?? 0) === 0) q.push(t.id)
  const topo: string[] = []
  let qi = 0
  while (qi < q.length) {
    const id = q[qi++]
    topo.push(id)
    for (const s of succs.get(id) ?? []) {
      const nd = (inDeg.get(s) ?? 1) - 1
      inDeg.set(s, nd)
      if (nd === 0) q.push(s)
    }
  }

  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  const ls = new Map<string, number>()
  const lf = new Map<string, number>()

  // Forward pass
  for (const id of topo) {
    const dur = taskMap.get(id)?.durationDays ?? 1
    const maxPredEF = preds.get(id)!.reduce((m, p) => Math.max(m, ef.get(p) ?? 0), 0)
    es.set(id, maxPredEF)
    ef.set(id, maxPredEF + dur)
  }

  const projectDuration = topo.reduce((m, id) => Math.max(m, ef.get(id) ?? 0), 0)

  // Backward pass
  for (const id of [...topo].reverse()) {
    const dur = taskMap.get(id)?.durationDays ?? 1
    const succLs = succs.get(id)!
    if (succLs.length === 0) {
      lf.set(id, projectDuration)
    } else {
      lf.set(id, succLs.reduce((m, s) => Math.min(m, ls.get(s) ?? projectDuration), projectDuration))
    }
    ls.set(id, (lf.get(id) ?? projectDuration) - dur)
  }

  const result = new Map<string, CpmResult>()
  for (const t of tasks) {
    const esV = es.get(t.id) ?? 0
    const efV = ef.get(t.id) ?? 0
    const lsV = ls.get(t.id) ?? 0
    const lfV = lf.get(t.id) ?? 0
    const slack = Math.round((lsV - esV) * 1000) / 1000
    result.set(t.id, { es: esV, ef: efV, ls: lsV, lf: lfV, slack, critical: slack <= 0 })
  }
  return result
}

// ── CpmView sub-component ─────────────────────────────────────────────────────
interface CpmViewProps {
  tasks: InteractiveTask[]
  cpmMap: Map<string, CpmResult>
  criticalIds: Set<string>
  projectDuration: number
  hasUnselectedDecisions: boolean
}

export function CpmView({ tasks, cpmMap, criticalIds, projectDuration, hasUnselectedDecisions }: CpmViewProps) {
  const { lang } = useLang()
  const ui = FLOWCHART_COPY[lang]
  const criticalTasks = tasks.filter((t) => criticalIds.has(t.id))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      {/* Stats */}
      <div className="mb-3 flex flex-wrap gap-6">
        <div>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{projectDuration}d</div>
          <div className="text-[11px] text-slate-500">{ui.projectDuration}</div>
        </div>
        <div>
          <div className="text-xl font-bold text-rose-600">{criticalIds.size}</div>
          <div className="text-[11px] text-slate-500">{ui.criticalTasks}</div>
        </div>
        <div>
          <div className="text-xl font-bold text-slate-400">{tasks.length - criticalIds.size}</div>
          <div className="text-[11px] text-slate-500">{ui.slackTasks}</div>
        </div>
      </div>

      {hasUnselectedDecisions && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          ⚠ {ui.xorWarning}
        </div>
      )}

      {/* Critical path tasks */}
      {criticalTasks.length === 0 ? (
        <p className="text-[11px] italic text-slate-400">
          {ui.noCriticalPath}
        </p>
      ) : (
        <div className="space-y-1">
          <p className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{ui.criticalPath}</p>
          {criticalTasks.map((t) => {
            const cpm = cpmMap.get(t.id)!
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-900/20"
              >
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-rose-500" />
                <span className="text-[10px] font-semibold text-rose-400">F{t.phaseId}</span>
                <span className="flex-1 truncate text-[11px] text-rose-700 dark:text-rose-300">{t.itemText}</span>
                <span className="font-mono text-[10px] text-rose-500">
                  {cpm.es}→{cpm.ef}
                </span>
                <span className="text-[10px] font-semibold text-rose-500">{t.durationDays}d</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main FlowchartView ────────────────────────────────────────────────────────
interface Props {
  interactiveTasks: InteractiveTask[]
  extractionId: string
  canEdit: boolean
  onSelectTask?: (taskId: string) => void
  onOpenTaskMobile?: (taskId: string) => void
}

interface PanState {
  panX: number
  panY: number
  zoom: number
}

const INIT_PAN: PanState = { panX: 0, panY: 0, zoom: 0.82 }

interface NodeDragState {
  taskId: string
  startClientX: number
  startClientY: number
  startCx: number
  startCy: number
  hasMoved: boolean
}

interface ConnDragState { fromTaskId: string; fromPortX: number; fromPortY: number }

export function FlowchartView({ interactiveTasks, extractionId, canEdit, onSelectTask, onOpenTaskMobile }: Props) {
  const { lang } = useLang()
  const ui = FLOWCHART_COPY[lang]
  const [edges, setEdges] = useState<TaskEdge[]>([])
  const [selections, setSelections] = useState<DecisionSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vs, setVs] = useState<PanState>(INIT_PAN)
  const [showCpm, setShowCpm] = useState(false)

  // Node type local overrides (optimistic after edit)
  const [localTypes, setLocalTypes] = useState<Map<string, FlowNodeType>>(
    () => new Map(interactiveTasks.map((t) => [t.id, t.flowNodeType ?? 'process']))
  )

  // Custom node positions (loaded from DB, updated on drag)
  const [localPositions, setLocalPositions] = useState<Map<string, { cx: number; cy: number }>>(new Map())

  // Currently dragged node id (for cursor feedback)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)

  // Node editor state
  const [editTask, setEditTask] = useState<InteractiveTask | null>(null)
  const [editNodeType, setEditNodeType] = useState<FlowNodeType>('process')
  const [editEdges, setEditEdges] = useState<TaskEdge[]>([])
  const [editSearch, setEditSearch] = useState('')
  const [addEdgeType, setAddEdgeType] = useState<EdgeType>('and')
  const [addEdgeLabel, setAddEdgeLabel] = useState('')
  const [addEdgeExtraDays, setAddEdgeExtraDays] = useState<number | ''>('')

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const nodeDragRef = useRef<NodeDragState | null>(null)
  const positionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didMoveRef = useRef(false)
  const vsRef = useRef(vs)
  useEffect(() => { vsRef.current = vs }, [vs])
  const edgesRef = useRef(edges)
  useEffect(() => { edgesRef.current = edges }, [edges])

  // ── Drag-to-connect state/refs ────────────────────────────────────────────
  const connDragRef = useRef<ConnDragState | null>(null)
  const connTargetIdRef = useRef<string | null>(null)
  const lastClientPosRef = useRef({ x: 0, y: 0 })
  const [connPreviewCursor, setConnPreviewCursor] = useState<{ x: number; y: number } | null>(null)
  const [pendingEdge, setPendingEdge] = useState<{
    fromTaskId: string; toTaskId: string; x: number; y: number
  } | null>(null)

  // Fetch graph data (edges + node positions)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/extractions/${extractionId}/graph`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setEdges(data.edges ?? [])
        setSelections(data.decisionSelections ?? [])
        const posMap = new Map<string, { cx: number; cy: number }>()
        for (const p of (data.nodePositions ?? []) as { taskId: string; cx: number; cy: number }[]) {
          posMap.set(p.taskId, { cx: p.cx, cy: p.cy })
        }
        setLocalPositions(posMap)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [extractionId])

  // Tasks with local type overrides
  const tasks = useMemo(
    () =>
      interactiveTasks.map((t) => ({
        ...t,
        flowNodeType: localTypes.get(t.id) ?? t.flowNodeType ?? ('process' as FlowNodeType),
      })),
    [interactiveTasks, localTypes]
  )

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  // Auto-layout (no custom positions)
  const layout = useMemo(() => buildLayout(tasks, edges), [tasks, edges])

  // Effective layout: auto-layout merged with persisted/dragged positions
  const effectiveLayout = useMemo(() => {
    if (localPositions.size === 0) return layout
    const merged = new Map(layout)
    for (const [id, pos] of Array.from(localPositions)) {
      const base = merged.get(id)
      if (base) merged.set(id, { ...base, cx: pos.cx, cy: pos.cy })
    }
    return merged
  }, [layout, localPositions])

  // Ref so event handlers always see current effective layout without stale closure
  const effectiveLayoutRef = useRef(effectiveLayout)
  useEffect(() => { effectiveLayoutRef.current = effectiveLayout }, [effectiveLayout])

  // Parallel edge offsets
  const edgePairOffsets = useMemo(() => buildEdgePairOffsets(edges), [edges])

  const cpmMap = useMemo(() => computeCpm(tasks, edges, selections), [tasks, edges, selections])

  const projectDuration = useMemo(
    () => Array.from(cpmMap.values()).reduce((m, c) => Math.max(m, c.ef), 0),
    [cpmMap]
  )

  const criticalIds = useMemo(
    () => new Set(Array.from(cpmMap.entries()).filter(([, v]) => v.critical).map(([id]) => id)),
    [cpmMap]
  )

  // Decision nodes that have XOR outgoing edges but no selection
  const hasUnselectedDecisions = useMemo(() => {
    const selSet = new Set(selections.map((s) => s.decisionTaskId))
    return tasks.some(
      (t) =>
        (localTypes.get(t.id) ?? t.flowNodeType) === 'decision' &&
        edges.some((e) => e.fromTaskId === t.id && e.edgeType === 'xor') &&
        !selSet.has(t.id)
    )
  }, [tasks, edges, selections, localTypes])

  // ── Dynamic canvas height ────────────────────────────────────────────────────
  const canvasHeight = useMemo(() => {
    const MIN_H = 420
    const MAX_H = 820
    const MARGIN = 90
    if (layout.size === 0) return MIN_H
    let maxY = 0
    for (const node of Array.from(layout.values())) {
      const hh = node.flowNodeType === 'decision' ? DS / 2 : PH / 2
      maxY = Math.max(maxY, node.cy + hh)
    }
    const needed = Math.round(2 * (maxY * INIT_PAN.zoom + MARGIN))
    return Math.min(MAX_H, Math.max(MIN_H, needed))
  }, [layout])

  // ── Minimap bounds ────────────────────────────────────────────────────────────
  const mmBounds = useMemo(() => {
    if (effectiveLayout.size === 0) return { minX: -200, maxX: 200, minY: -50, maxY: 150 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const node of Array.from(effectiveLayout.values())) {
      const hw = node.flowNodeType === 'decision' ? DS / 2 : PW / 2
      const hh = node.flowNodeType === 'decision' ? DS / 2 : PH / 2
      minX = Math.min(minX, node.cx - hw)
      maxX = Math.max(maxX, node.cx + hw)
      minY = Math.min(minY, node.cy - hh)
      maxY = Math.max(maxY, node.cy + hh)
    }
    return { minX, maxX, minY, maxY }
  }, [effectiveLayout])

  const mmContentW = mmBounds.maxX - mmBounds.minX
  const mmContentH = mmBounds.maxY - mmBounds.minY
  const mmAvailW = MM_W - MM_PAD * 2
  const mmAvailH = MM_H - MM_PAD * 2
  const mmScale = Math.min(mmAvailW / Math.max(mmContentW, 1), mmAvailH / Math.max(mmContentH, 1))

  function canvasToMm(cx: number, cy: number): [number, number] {
    return [
      MM_PAD + (cx - mmBounds.minX) * mmScale,
      MM_PAD + (cy - mmBounds.minY) * mmScale,
    ]
  }

  // ── Pan/zoom ────────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cw = rect.width
    const ch = rect.height
    setVs((prev) => {
      const nz = Math.max(0.12, Math.min(4, prev.zoom * factor))
      const canX = (mx - cw / 2 - prev.panX) / prev.zoom
      const canY = (my - ch / 2 - prev.panY) / prev.zoom
      return { panX: mx - cw / 2 - canX * nz, panY: my - ch / 2 - canY * nz, zoom: nz }
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('[data-fcnode]')) return
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: vsRef.current.panX, py: vsRef.current.panY }
    didMoveRef.current = false
  }, [])

  // Debounced position save
  function schedulePositionSave(taskId: string, cx: number, cy: number) {
    if (positionSaveTimerRef.current) clearTimeout(positionSaveTimerRef.current)
    positionSaveTimerRef.current = setTimeout(() => {
      fetch(`/api/extractions/${extractionId}/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_node_position', taskId, cx, cy }),
      }).catch(console.error)
    }, 400)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastClientPosRef.current = { x: e.clientX, y: e.clientY }
    // Node drag has priority over canvas pan
    const nd = nodeDragRef.current
    if (nd) {
      const dxC = e.clientX - nd.startClientX
      const dyC = e.clientY - nd.startClientY
      if (Math.abs(dxC) + Math.abs(dyC) > 3) {
        nd.hasMoved = true
        didMoveRef.current = true
        setDraggingNodeId(nd.taskId)
      }
      if (nd.hasMoved) {
        const dxCanvas = dxC / vsRef.current.zoom
        const dyCanvas = dyC / vsRef.current.zoom
        const newCx = nd.startCx + dxCanvas
        const newCy = nd.startCy + dyCanvas
        setLocalPositions((prev) => {
          const next = new Map(prev)
          next.set(nd.taskId, { cx: newCx, cy: newCy })
          return next
        })
        schedulePositionSave(nd.taskId, newCx, newCy)
      }
      return
    }

    // Canvas pan
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.sx
    const dy = e.clientY - drag.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) didMoveRef.current = true
    setVs((prev) => ({ ...prev, panX: drag.px + dx, panY: drag.py + dy }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractionId])

  const handleMouseUp = useCallback(() => {
    nodeDragRef.current = null
    dragRef.current = null
    setDraggingNodeId(null)
  }, [])

  // ── Minimap click → re-center viewport ────────────────────────────────────────
  const handleMinimapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mmX = e.clientX - rect.left
    const mmY = e.clientY - rect.top
    // Convert minimap coords → canvas coords
    const canvasX = (mmX - MM_PAD) / mmScale + mmBounds.minX
    const canvasY = (mmY - MM_PAD) / mmScale + mmBounds.minY
    setVs((prev) => ({
      ...prev,
      panX: -canvasX * prev.zoom,
      panY: -canvasY * prev.zoom,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mmBounds, mmScale])

  // ── Node editor ─────────────────────────────────────────────────────────────
  const openEditor = useCallback(
    (task: InteractiveTask) => {
      if (didMoveRef.current) return
      if (!canEdit) return
      setEditTask(task)
      setEditNodeType(localTypes.get(task.id) ?? task.flowNodeType ?? 'process')
      setEditEdges(edgesRef.current.filter((e) => e.fromTaskId === task.id))
      setEditSearch('')
      setAddEdgeType('and')
      setAddEdgeLabel('')
      setAddEdgeExtraDays('')
    },
    [canEdit, localTypes]
  )

  async function saveNodeType(taskId: string, ft: FlowNodeType) {
    setLocalTypes((prev) => new Map(prev).set(taskId, ft))
    setEditNodeType(ft)
    await fetch(`/api/extractions/${extractionId}/graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_node', taskId, flowNodeType: ft }),
    })
  }

  async function addEdge(toTaskId: string) {
    if (!editTask || saving) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        action: 'upsert_edge',
        fromTaskId: editTask.id,
        toTaskId,
        edgeType: addEdgeType,
      }
      if (addEdgeLabel.trim()) body.label = addEdgeLabel.trim()
      if (addEdgeType === 'loop' && addEdgeExtraDays !== '') body.expectedExtraDays = Number(addEdgeExtraDays)

      const res = await fetch(`/api/extractions/${extractionId}/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        const newEdge: TaskEdge = data.edge
        setEdges((prev) => {
          const filtered = prev.filter(
            (e) => !(e.fromTaskId === newEdge.fromTaskId && e.toTaskId === newEdge.toTaskId && e.edgeType === newEdge.edgeType)
          )
          return [...filtered, newEdge]
        })
        setEditEdges((prev) => {
          const filtered = prev.filter(
            (e) => !(e.fromTaskId === newEdge.fromTaskId && e.toTaskId === newEdge.toTaskId && e.edgeType === newEdge.edgeType)
          )
          return [...filtered, newEdge]
        })
        setAddEdgeLabel('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function removeEdge(edge: TaskEdge) {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/extractions/${extractionId}/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_edge',
          fromTaskId: edge.fromTaskId,
          toTaskId: edge.toTaskId,
          edgeType: edge.edgeType,
        }),
      })
      if (res.ok) {
        setEdges((prev) =>
          prev.filter(
            (e) => !(e.fromTaskId === edge.fromTaskId && e.toTaskId === edge.toTaskId && e.edgeType === edge.edgeType)
          )
        )
        setEditEdges((prev) =>
          prev.filter(
            (e) => !(e.fromTaskId === edge.fromTaskId && e.toTaskId === edge.toTaskId && e.edgeType === edge.edgeType)
          )
        )
      }
    } finally {
      setSaving(false)
    }
  }

  async function selectBranch(decisionTaskId: string, toTaskId: string) {
    const res = await fetch(`/api/extractions/${extractionId}/graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select_branch', decisionTaskId, selectedToTaskId: toTaskId }),
    })
    if (res.ok) {
      setSelections((prev) => [
        ...prev.filter((s) => s.decisionTaskId !== decisionTaskId),
        { extractionId, decisionTaskId, selectedToTaskId: toTaskId },
      ])
    }
  }

  async function createEdgeDirect(fromTaskId: string, toTaskId: string, edgeType: EdgeType) {
    setPendingEdge(null)
    const res = await fetch(`/api/extractions/${extractionId}/graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_edge', fromTaskId, toTaskId, edgeType }),
    })
    if (res.ok) {
      const data = await res.json()
      const newEdge: TaskEdge = data.edge
      setEdges((prev) => {
        const filtered = prev.filter(
          (e) => !(e.fromTaskId === newEdge.fromTaskId && e.toTaskId === newEdge.toTaskId && e.edgeType === newEdge.edgeType)
        )
        return [...filtered, newEdge]
      })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={24} />
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-slate-400">
        {ui.noTasks}
      </div>
    )
  }

  // Minimap viewport rect in minimap coordinates
  const containerW = containerRef.current?.clientWidth ?? 600
  const containerH = canvasHeight
  // Canvas visible area top-left in canvas coords
  const vpLeft = (-vs.panX / vs.zoom)
  const vpTop = (-vs.panY / vs.zoom)
  const vpW = containerW / vs.zoom
  const vpH = containerH / vs.zoom
  const [mmVpX, mmVpY] = canvasToMm(vpLeft, vpTop)
  const mmVpW = vpW * mmScale
  const mmVpH = vpH * mmScale

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Workflow size={14} className="text-indigo-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {ui.processSummary(tasks.length, edges.length)}
          </span>
        </div>

        {showCpm && (
          <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 dark:bg-rose-900/20">
            <Zap size={11} className="text-rose-500" />
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              {ui.durationSummary(projectDuration, criticalIds.size)}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowCpm((p) => !p)}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
            showCpm
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Zap size={11} />
          CPM
        </button>

        <button
          type="button"
          onClick={() => setVs(INIT_PAN)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          title={ui.resetView}
        >
          <RefreshCw size={10} />
          {ui.reset}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {(['and', 'xor', 'loop'] as EdgeType[]).map((et) => (
          <div key={et} className="flex items-center gap-1.5">
            <svg width="24" height="10">
              <line
                x1="0"
                y1="5"
                x2="20"
                y2="5"
                stroke={EDGE_COLOR[et]}
                strokeWidth="1.5"
                strokeDasharray={EDGE_DASH[et] || undefined}
              />
              <polygon points="20,2 24,5 20,8" fill={EDGE_COLOR[et]} />
            </svg>
            <span className="text-[10px] text-slate-400">{getEdgeTypeLabel(et, lang)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-5 rounded border border-slate-300 dark:border-slate-600" />
          <span className="text-[10px] text-slate-400">{ui.process}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14">
            <polygon points="7,0 14,7 7,14 0,7" fill="none" stroke={EDGE_COLOR.xor} strokeWidth="1.5" />
          </svg>
          <span className="text-[10px] text-slate-400">{ui.decision}</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
        style={{ height: canvasHeight }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {effectiveLayout.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Sin layout disponible.
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transformOrigin: '0 0',
            transform: `translate(${vs.panX}px, ${vs.panY}px) scale(${vs.zoom})`,
            cursor: connPreviewCursor ? 'crosshair' : nodeDragRef.current ? 'grabbing' : dragRef.current ? 'grabbing' : 'grab',
          }}
        >
          {/* SVG edges — origin at canvas (0,0), overflow visible */}
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <defs>
              {(['and', 'xor', 'loop'] as EdgeType[]).map((et) => (
                <React.Fragment key={et}>
                  <marker
                    id={`arr-${et}`}
                    markerWidth="12"
                    markerHeight="9"
                    refX="11"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <polygon points="0 0, 12 4.5, 0 9" fill={EDGE_COLOR[et]} />
                  </marker>
                  <marker
                    id={`arr-crit-${et}`}
                    markerWidth="12"
                    markerHeight="9"
                    refX="11"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <polygon points="0 0, 12 4.5, 0 9" fill="#ef4444" />
                  </marker>
                </React.Fragment>
              ))}
              <marker id="arr-preview" markerWidth="12" markerHeight="9" refX="11" refY="4.5"
                orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 12 4.5, 0 9" fill="#6366f1" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const src = effectiveLayout.get(edge.fromTaskId)
              const tgt = effectiveLayout.get(edge.toTaskId)
              if (!src || !tgt) return null

              const isCrit =
                showCpm &&
                edge.edgeType === 'and' &&
                criticalIds.has(edge.fromTaskId) &&
                criticalIds.has(edge.toTaskId)

              const stroke = isCrit ? '#ef4444' : EDGE_COLOR[edge.edgeType]
              const markerId = isCrit ? `arr-crit-${edge.edgeType}` : `arr-${edge.edgeType}`
              const offsetKey = `${edge.fromTaskId}:${edge.toTaskId}:${edge.edgeType}`
              const lateralOffset = edgePairOffsets.get(offsetKey) ?? 0
              const d = edgePath(src, tgt, lateralOffset)

              // Midpoint for label
              const [sx, sy] = getPort(src, 'bottom')
              const [tx, ty] = getPort(tgt, 'top')
              const lx = (sx + tx) / 2 + lateralOffset
              const ly = (sy + ty) / 2

              return (
                <g key={`${edge.fromTaskId}-${edge.toTaskId}-${edge.edgeType}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isCrit ? 2 : 1.5}
                    strokeDasharray={EDGE_DASH[edge.edgeType] || undefined}
                    markerEnd={`url(#${markerId})`}
                  />
                  {edge.label && (
                    <text
                      x={lx}
                      y={ly - 4}
                      textAnchor="middle"
                      fontSize="9"
                      fill={stroke}
                      fontFamily="system-ui, sans-serif"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Connection drag preview path */}
            {connDragRef.current && connPreviewCursor && (() => {
              const src = effectiveLayout.get(connDragRef.current!.fromTaskId)
              if (!src) return null
              const [sx, sy] = getPort(src, 'bottom')
              const { x: tx, y: ty } = connPreviewCursor
              const dist = Math.abs(ty - sy)
              const cp = Math.min(dist * 0.55, 120)
              const isValid = connTargetIdRef.current !== null
              return (
                <path
                  d={`M ${sx} ${sy} C ${sx} ${sy + cp} ${tx} ${ty - cp} ${tx} ${ty}`}
                  fill="none"
                  stroke={isValid ? '#6366f1' : '#94a3b8'}
                  strokeWidth={isValid ? 2 : 1.5}
                  strokeDasharray="6 3"
                  markerEnd="url(#arr-preview)"
                />
              )
            })()}
          </svg>

          {/* HTML nodes */}
          {tasks.map((task) => {
            const node = effectiveLayout.get(task.id)
            if (!node) return null

            const isCrit = showCpm && criticalIds.has(task.id)
            const cpm = showCpm ? cpmMap.get(task.id) : undefined
            const isDecision = node.flowNodeType === 'decision'
            const hs = DS / 2
            const isDragging = draggingNodeId === task.id
            const isConnTarget = connPreviewCursor !== null && connTargetIdRef.current === task.id

            const nodeEnter = () => {
              if (connDragRef.current && task.id !== connDragRef.current.fromTaskId) {
                connTargetIdRef.current = task.id
              }
            }
            const nodeLeave = () => {
              connTargetIdRef.current = null
            }

            return isDecision ? (
              // Diamond node
              <div
                key={task.id}
                data-fcnode={task.id}
                className="group"
                style={{
                  position: 'absolute',
                  left: node.cx - hs,
                  top: node.cy - hs,
                  width: DS,
                  height: DS,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canEdit ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  userSelect: 'none',
                }}
                onMouseEnter={nodeEnter}
                onMouseLeave={nodeLeave}
                onClick={() => {
                  if (didMoveRef.current) return
                  onSelectTask?.(task.id)
                }}
                onDoubleClick={() => openEditor(task)}
                onMouseDown={(e: React.MouseEvent) => {
                  if (!canEdit || e.button !== 0) return
                  e.stopPropagation()
                  const node = effectiveLayoutRef.current.get(task.id)
                  if (!node) return
                  didMoveRef.current = false
                  nodeDragRef.current = {
                    taskId: task.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startCx: node.cx,
                    startCy: node.cy,
                    hasMoved: false,
                  }
                }}
              >
                {/* Rotated square background */}
                <div
                  style={{
                    position: 'absolute',
                    width: `${DS / Math.SQRT2}px`,
                    height: `${DS / Math.SQRT2}px`,
                    transform: 'rotate(45deg)',
                    borderRadius: 4,
                    border: `2px solid ${isConnTarget ? '#6366f1' : isCrit ? '#ef4444' : EDGE_COLOR.xor}`,
                    background: isCrit ? '#fff1f2' : '#fffbeb',
                  }}
                  className="dark:!bg-yellow-900/30"
                />
                {/* Text overlay */}
                <div
                  style={{ position: 'relative', zIndex: 1, maxWidth: DS - 16, textAlign: 'center' }}
                >
                  <div className="text-[10px] font-medium leading-tight text-amber-700 line-clamp-2 dark:text-amber-300">
                    {task.itemText}
                  </div>
                  {cpm && (
                    <div className="mt-0.5 text-[8px] text-slate-400 dark:text-slate-500">
                      {cpm.es}→{cpm.ef}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div
                    style={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }}
                    className="text-[8px] font-bold text-amber-400 opacity-60"
                  >
                    ✎
                  </div>
                )}
                {/* Port handle — always rendered, visible on group-hover, hidden during drag */}
                {canEdit && !connPreviewCursor && (
                  <div
                    data-fcport="out"
                    className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                    style={{
                      position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#6366f1', border: '2px solid white',
                      cursor: 'crosshair', zIndex: 20,
                      boxShadow: '0 0 0 3px rgba(99,102,241,0.25)',
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      const fromTaskId = task.id
                      const n = effectiveLayoutRef.current.get(fromTaskId)
                      if (!n) return
                      const [px, py] = getPort(n, 'bottom')
                      connDragRef.current = { fromTaskId, fromPortX: px, fromPortY: py }
                      // Set initial preview position
                      const updatePreview = (clientX: number, clientY: number) => {
                        const r = containerRef.current?.getBoundingClientRect()
                        if (!r) return
                        const cx = (clientX - r.left - r.width / 2 - vsRef.current.panX) / vsRef.current.zoom
                        const cy = (clientY - r.top - r.height / 2 - vsRef.current.panY) / vsRef.current.zoom
                        setConnPreviewCursor({ x: cx, y: cy })
                      }
                      updatePreview(e.clientX, e.clientY)
                      // Native window listeners so drag works even outside the canvas
                      const onMove = (we: MouseEvent) => {
                        lastClientPosRef.current = { x: we.clientX, y: we.clientY }
                        updatePreview(we.clientX, we.clientY)
                      }
                      const onUp = (we: MouseEvent) => {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                        connDragRef.current = null
                        setConnPreviewCursor(null)
                        const targetId = connTargetIdRef.current
                        connTargetIdRef.current = null
                        if (targetId && targetId !== fromTaskId) {
                          setPendingEdge({ fromTaskId, toTaskId: targetId, x: we.clientX, y: we.clientY })
                        }
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                  />
                )}
              </div>
            ) : (
              // Process node
              <div
                key={task.id}
                data-fcnode={task.id}
                style={{
                  position: 'absolute',
                  left: node.cx - PW / 2,
                  top: node.cy - PH / 2,
                  width: PW,
                  height: PH,
                  cursor: canEdit ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  userSelect: 'none',
                  outline: isConnTarget ? '2px solid #6366f1' : undefined,
                  outlineOffset: isConnTarget ? '2px' : undefined,
                }}
                className={`group flex flex-col justify-center rounded-lg border px-2.5 py-1.5 shadow-sm ${
                  isCrit
                    ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                    : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800'
                }`}
                onMouseEnter={nodeEnter}
                onMouseLeave={nodeLeave}
                onClick={() => {
                  if (didMoveRef.current) return
                  onSelectTask?.(task.id)
                }}
                onDoubleClick={() => openEditor(task)}
                onMouseDown={(e: React.MouseEvent) => {
                  if (!canEdit || e.button !== 0) return
                  e.stopPropagation()
                  const node = effectiveLayoutRef.current.get(task.id)
                  if (!node) return
                  didMoveRef.current = false
                  nodeDragRef.current = {
                    taskId: task.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startCx: node.cx,
                    startCy: node.cy,
                    hasMoved: false,
                  }
                }}
              >
                <div
                  className={`mb-0.5 text-[9px] font-bold uppercase tracking-wide ${isCrit ? 'text-red-400' : 'text-indigo-400'}`}
                >
                  F{task.phaseId}
                </div>
                <div className="text-[11px] font-medium leading-tight text-slate-700 line-clamp-2 dark:text-slate-200">
                  {task.itemText}
                </div>
                {cpm && (
                  <div className="mt-0.5 flex gap-2 text-[9px] text-slate-400">
                    <span>
                      {cpm.es}→{cpm.ef}
                    </span>
                    {cpm.slack > 0 && (
                      <span className="text-green-500">+{cpm.slack}d</span>
                    )}
                  </div>
                )}
                {/* Port handle — always rendered, visible on group-hover, hidden during drag */}
                {canEdit && !connPreviewCursor && (
                  <div
                    data-fcport="out"
                    className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                    style={{
                      position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#6366f1', border: '2px solid white',
                      cursor: 'crosshair', zIndex: 20,
                      boxShadow: '0 0 0 3px rgba(99,102,241,0.25)',
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      const fromTaskId = task.id
                      const n = effectiveLayoutRef.current.get(fromTaskId)
                      if (!n) return
                      const [px, py] = getPort(n, 'bottom')
                      connDragRef.current = { fromTaskId, fromPortX: px, fromPortY: py }
                      const updatePreview = (clientX: number, clientY: number) => {
                        const r = containerRef.current?.getBoundingClientRect()
                        if (!r) return
                        const cx = (clientX - r.left - r.width / 2 - vsRef.current.panX) / vsRef.current.zoom
                        const cy = (clientY - r.top - r.height / 2 - vsRef.current.panY) / vsRef.current.zoom
                        setConnPreviewCursor({ x: cx, y: cy })
                      }
                      updatePreview(e.clientX, e.clientY)
                      const onMove = (we: MouseEvent) => {
                        lastClientPosRef.current = { x: we.clientX, y: we.clientY }
                        updatePreview(we.clientX, we.clientY)
                      }
                      const onUp = (we: MouseEvent) => {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                        connDragRef.current = null
                        setConnPreviewCursor(null)
                        const targetId = connTargetIdRef.current
                        connTargetIdRef.current = null
                        if (targetId && targetId !== fromTaskId) {
                          setPendingEdge({ fromTaskId, toTaskId: targetId, x: we.clientX, y: we.clientY })
                        }
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Minimap */}
        {effectiveLayout.size > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              width: MM_W,
              height: MM_H,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.88)',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              zIndex: 10,
            }}
            className="dark:!bg-slate-900/88 dark:!border-slate-700"
          >
            <svg
              width={MM_W}
              height={MM_H}
              style={{ cursor: 'crosshair', display: 'block' }}
              onClick={handleMinimapClick}
            >
              {/* Node rects */}
              {Array.from(effectiveLayout.values()).map((node) => {
                const [mx, my] = canvasToMm(node.cx, node.cy)
                const isDecision = node.flowNodeType === 'decision'
                const hw = (isDecision ? DS / 2 : PW / 2) * mmScale
                const hh = (isDecision ? DS / 2 : PH / 2) * mmScale
                return (
                  <rect
                    key={node.id}
                    x={mx - hw}
                    y={my - hh}
                    width={hw * 2}
                    height={hh * 2}
                    rx={1}
                    fill={isDecision ? '#fef3c7' : '#e0e7ff'}
                    stroke={isDecision ? '#f59e0b' : '#6366f1'}
                    strokeWidth={0.5}
                  />
                )
              })}
              {/* Viewport indicator */}
              <rect
                x={mmVpX}
                y={mmVpY}
                width={Math.max(4, mmVpW)}
                height={Math.max(4, mmVpH)}
                rx={2}
                fill="rgba(99,102,241,0.08)"
                stroke="#6366f1"
                strokeWidth={1}
              />
            </svg>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
        {canEdit
          ? 'Hover sobre un nodo → punto violeta → arrastrarlo a otro nodo para conectar · Doble-clic para editar · Rueda para zoom'
          : 'Rueda para zoom · Arrastrar para mover'}
      </p>

      {/* CPM panel */}
      {showCpm && (
        <CpmView
          tasks={tasks}
          cpmMap={cpmMap}
          criticalIds={criticalIds}
          projectDuration={projectDuration}
          hasUnselectedDecisions={hasUnselectedDecisions}
        />
      )}

      {/* Edge type popover portal (drag-to-connect) */}
      {pendingEdge && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50" onClick={() => setPendingEdge(null)}>
          <div
            style={{ position: 'fixed', left: pendingEdge.x, top: pendingEdge.y,
                     transform: 'translate(-50%, 8px)', zIndex: 60 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <span className="mr-1 text-[10px] text-slate-400">{ui.type}</span>
              {(['and', 'xor', 'loop'] as EdgeType[]).map((et) => (
                <button
                  key={et}
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-80"
                  style={{ background: EDGE_COLOR[et], color: '#fff' }}
                  onClick={() => createEdgeDirect(pendingEdge.fromTaskId, pendingEdge.toTaskId, et)}
                >
                  {et === 'and' ? ui.sequential : et === 'xor' ? ui.decision : ui.loop}
                </button>
              ))}
              <button
                type="button"
                className="ml-1 text-slate-300 hover:text-slate-500"
                onClick={() => setPendingEdge(null)}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Node editor portal */}
      {editTask &&
        typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
              onClick={() => setEditTask(null)}
            />
            <div className="relative z-10 max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
                    {ui.editNode}
                  </p>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-2 dark:text-slate-100">
                    {editTask.itemText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTask(null)}
                  className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Node type toggle */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {ui.nodeType}
                </label>
                <div className="flex gap-2">
                  {(['process', 'decision'] as FlowNodeType[]).map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => saveNodeType(editTask.id, ft)}
                      className={`flex-1 rounded-lg border py-2 text-[11px] font-semibold transition-colors ${
                        editNodeType === ft
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {ft === 'process' ? `▭ ${ui.process}` : `◇ ${ui.decision}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Existing outgoing edges */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {ui.outgoingEdges(editEdges.length)}
                </label>
                {editEdges.length === 0 ? (
                  <p className="text-[11px] italic text-slate-400">{ui.noEdges}</p>
                ) : (
                  <div className="space-y-1">
                    {editEdges.map((edge) => {
                      const target = taskMap.get(edge.toTaskId)
                      const isSel = selections.some(
                        (s) => s.decisionTaskId === editTask.id && s.selectedToTaskId === edge.toTaskId
                      )
                      return (
                        <div
                          key={`${edge.toTaskId}-${edge.edgeType}`}
                          className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800"
                        >
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                            style={{
                              color: EDGE_COLOR[edge.edgeType],
                              background: `${EDGE_COLOR[edge.edgeType]}22`,
                            }}
                          >
                            {edge.edgeType}
                          </span>
                          <span className="flex-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
                            → {target?.itemText ?? edge.toTaskId}
                          </span>
                          {edge.label && (
                            <span className="text-[10px] text-slate-400">"{edge.label}"</span>
                          )}
                          {edge.edgeType === 'xor' && (
                            <button
                              type="button"
                              onClick={() => selectBranch(editTask.id, edge.toTaskId)}
                              title={ui.useForCpm}
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                isSel
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'text-slate-400 hover:text-amber-500'
                              }`}
                            >
                              {isSel ? '✓ CPM' : 'CPM?'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeEdge(edge)}
                            disabled={saving}
                            className="text-slate-300 hover:text-rose-500 disabled:opacity-40 dark:text-slate-600 dark:hover:text-rose-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Add edge */}
              <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {ui.addOutgoingEdge}
                </p>

                <div className="flex gap-2">
                  {(['and', 'xor', 'loop'] as EdgeType[]).map((et) => (
                    <button
                      key={et}
                      type="button"
                      onClick={() => setAddEdgeType(et)}
                      className="flex-1 rounded-lg border py-1 text-[10px] font-bold uppercase transition-colors"
                      style={
                        addEdgeType === et
                          ? { background: EDGE_COLOR[et], borderColor: EDGE_COLOR[et], color: '#fff' }
                          : { color: EDGE_COLOR[et], borderColor: `${EDGE_COLOR[et]}55` }
                      }
                    >
                      {et}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder={ui.labelOptional}
                  value={addEdgeLabel}
                  onChange={(e) => setAddEdgeLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                {addEdgeType === 'loop' && (
                  <input
                    type="number"
                    min={0}
                    placeholder={ui.expectedExtraDays}
                    value={addEdgeExtraDays}
                    onChange={(e) =>
                      setAddEdgeExtraDays(e.target.value !== '' ? Number(e.target.value) : '')
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                )}

                <input
                  type="text"
                  placeholder={ui.searchTargetTask}
                  value={editSearch}
                  onChange={(e) => setEditSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                <div className="max-h-36 space-y-0.5 overflow-y-auto">
                  {tasks
                    .filter(
                      (t) =>
                        t.id !== editTask.id &&
                        (!editSearch.trim() ||
                          t.itemText.toLowerCase().includes(editSearch.toLowerCase().trim()))
                    )
                    .slice(0, 20)
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => addEdge(t.id)}
                        disabled={saving}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                      >
                        <Plus size={10} className="flex-shrink-0 text-indigo-500" />
                        <span className="text-[10px] font-semibold text-indigo-400">F{t.phaseId}</span>
                        <span className="truncate text-[11px] text-slate-600 dark:text-slate-300">
                          {t.itemText}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {saving && (
                <div className="flex items-center justify-center gap-1 text-[11px] text-indigo-500">
                  <Loader2 size={12} className="animate-spin" />
                  Guardando…
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
