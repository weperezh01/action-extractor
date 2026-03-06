'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Phase, InteractiveTask, InteractiveTaskStatus } from '@/app/home/lib/types'
import type { PlaybookNode } from '@/lib/playbook-tree'

// ── Layout constants ──────────────────────────────────────────────────────────
const LEVEL_X_GAP = 224  // horizontal gap per depth level
const ROW_Y_GAP   = 58   // vertical gap between leaf rows
const ROOT_W      = 224
const PHASE_W     = 194
const LEAF_W      = 170

// ── Per-phase color palette ───────────────────────────────────────────────────
const PHASE_PALETTE = [
  { node: 'bg-indigo-600 text-white',  edge: '#818cf8' },
  { node: 'bg-violet-600 text-white',  edge: '#a78bfa' },
  { node: 'bg-sky-500 text-white',     edge: '#38bdf8' },
  { node: 'bg-emerald-600 text-white', edge: '#34d399' },
  { node: 'bg-amber-500 text-white',   edge: '#fbbf24' },
  { node: 'bg-rose-500 text-white',    edge: '#fb7185' },
  { node: 'bg-teal-600 text-white',    edge: '#2dd4bf' },
  { node: 'bg-orange-500 text-white',  edge: '#fb923c' },
]

// ── Status chip metadata ──────────────────────────────────────────────────────
const STATUS_META: Record<InteractiveTaskStatus, { label: string; cls: string }> = {
  pending:     { label: 'Pendiente',   cls: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  in_progress: { label: 'En progreso', cls: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300' },
  blocked:     { label: 'Bloqueada',   cls: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300' },
  completed:   { label: 'Completada',  cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300' },
}

// ── Internal visual node type ─────────────────────────────────────────────────
interface VNode {
  id: string
  label: string
  parentId: string | null
  side: 'left' | 'right' | 'center'
  depth: number
  x: number
  y: number
  isRoot?: boolean
  isPhase?: boolean
  phaseIdx: number   // ‑1 for root; index into PHASE_PALETTE otherwise
  task?: InteractiveTask
  hasChildren: boolean
}

function vnodeWidth(v: VNode): number {
  if (v.isRoot) return ROOT_W
  if (v.isPhase) return PHASE_W
  return LEAF_W
}

// ── Layout engine ─────────────────────────────────────────────────────────────
function buildMindMapLayout(
  phases: Phase[],
  tasksByNodeId: Map<string, InteractiveTask>,
  collapsedIds: Set<string>,
  rootLabel: string,
): VNode[] {
  const nodes: VNode[] = []
  let leafCounter = 0

  function leafCount(node: PlaybookNode): number {
    if (collapsedIds.has(node.id) || node.children.length === 0) return 1
    return node.children.reduce((s, c) => s + leafCount(c), 0)
  }

  function phaseLeaves(phase: Phase): number {
    if (collapsedIds.has(`phase-${phase.id}`)) return 1
    if (phase.items.length === 0) return 1
    return phase.items.reduce((s, item) => s + leafCount(item), 0)
  }

  const totalLeaves = phases.reduce((s, p) => s + phaseLeaves(p), 0)
  const startY = -((Math.max(totalLeaves, 1) - 1) * ROW_Y_GAP) / 2

  function addPlaybookNode(
    node: PlaybookNode,
    parentId: string,
    side: 'left' | 'right',
    depth: number,
    phaseIdx: number,
  ): number {
    const task = tasksByNodeId.get(node.id)
    const isCollapsed = collapsedIds.has(node.id)
    const visibleChildren = isCollapsed ? [] : node.children

    let myY: number
    if (visibleChildren.length > 0) {
      const childYs = visibleChildren.map(c =>
        addPlaybookNode(c, node.id, side, depth + 1, phaseIdx)
      )
      myY = (childYs[0] + childYs[childYs.length - 1]) / 2
    } else {
      myY = startY + leafCounter * ROW_Y_GAP
      leafCounter++
    }

    const x = side === 'right' ? depth * LEVEL_X_GAP : -(depth * LEVEL_X_GAP)
    nodes.push({
      id: node.id,
      label: node.text,
      parentId,
      side,
      depth,
      x,
      y: myY,
      phaseIdx,
      task,
      hasChildren: node.children.length > 0,
    })
    return myY
  }

  const phaseYs: number[] = phases.map((phase, pIdx) => {
    const side: 'left' | 'right' = pIdx % 2 === 0 ? 'right' : 'left'
    const phaseId = `phase-${phase.id}`
    const isCollapsed = collapsedIds.has(phaseId)
    const visibleItems = isCollapsed ? [] : phase.items

    let phaseY: number
    if (visibleItems.length > 0) {
      const itemYs = visibleItems.map(item =>
        addPlaybookNode(item, phaseId, side, 2, pIdx)
      )
      phaseY = (itemYs[0] + itemYs[itemYs.length - 1]) / 2
    } else {
      phaseY = startY + leafCounter * ROW_Y_GAP
      leafCounter++
    }

    nodes.push({
      id: phaseId,
      label: phase.title,
      parentId: 'mindmap-root',
      side,
      depth: 1,
      x: side === 'right' ? LEVEL_X_GAP : -LEVEL_X_GAP,
      y: phaseY,
      isPhase: true,
      phaseIdx: pIdx,
      hasChildren: phase.items.length > 0,
    })
    return phaseY
  })

  const rootY =
    phaseYs.length > 0 ? (phaseYs[0] + phaseYs[phaseYs.length - 1]) / 2 : 0

  nodes.push({
    id: 'mindmap-root',
    label: rootLabel,
    parentId: null,
    side: 'center',
    depth: 0,
    x: 0,
    y: rootY,
    isRoot: true,
    phaseIdx: -1,
    hasChildren: phases.length > 0,
  })

  return nodes
}

// ── SVG edge path (cubic bezier) ──────────────────────────────────────────────
function mkEdgePath(parent: VNode, child: VNode): string {
  const pw = vnodeWidth(parent)
  const cw = vnodeWidth(child)

  // Determine which edges to connect based on child side
  let px: number, cx: number
  if (child.side === 'right') {
    px = parent.x + pw / 2
    cx = child.x - cw / 2
  } else {
    // left (or root-to-left-phase)
    px = parent.x - pw / 2
    cx = child.x + cw / 2
  }

  const py = parent.y
  const cy = child.y
  const dx = Math.abs(cx - px) * 0.45
  const sx = cx > px ? 1 : -1

  return `M ${px} ${py} C ${px + dx * sx} ${py}, ${cx - dx * sx} ${cy}, ${cx} ${cy}`
}

// ── Helper ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface MindMapViewProps {
  phases: Phase[]
  tasksByNodeId: Map<string, InteractiveTask>
  objective: string
  sourceDisplayTitle?: string
  onSelectTask: (taskId: string) => void
  onOpenTaskMobile?: (taskId: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MindMapView({
  phases,
  tasksByNodeId,
  objective,
  sourceDisplayTitle,
  onSelectTask,
  onOpenTaskMobile,
}: MindMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // Pan + zoom consolidated in one state for atomic updates
  const [vs, setVs] = useState({ panX: 0, panY: 0, zoom: 0.82 })
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null)

  // Root label — prefer video/source title, fall back to objective
  const rootLabel = useMemo(() => {
    const t = sourceDisplayTitle || objective
    return t.length > 54 ? t.slice(0, 52) + '…' : t
  }, [sourceDisplayTitle, objective])

  // Build layout
  const nodes = useMemo(
    () => buildMindMapLayout(phases, tasksByNodeId, collapsedIds, rootLabel),
    [phases, tasksByNodeId, collapsedIds, rootLabel],
  )

  const nodeMap = useMemo(() => {
    const m = new Map<string, VNode>()
    nodes.forEach(n => m.set(n.id, n))
    return m
  }, [nodes])

  // Build edge list
  const edges = useMemo(
    () =>
      nodes
        .filter(n => n.parentId !== null)
        .map(n => {
          const parent = nodeMap.get(n.parentId!)
          return parent ? { child: n, parent } : null
        })
        .filter(Boolean) as { child: VNode; parent: VNode }[],
    [nodes, nodeMap],
  )

  // ── Pan handlers ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-mmnode]')) return
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setVs(p => ({ ...p, panX: p.panX + dx, panY: p.panY + dy }))
  }, [])

  const stopDrag = useCallback(() => {
    isDragging.current = false
    if (containerRef.current) containerRef.current.style.cursor = 'grab'
  }, [])

  // ── Zoom on wheel (centered on cursor) ──────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cw = rect.width
    const ch = rect.height
    setVs(p => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const nz = Math.min(4, Math.max(0.12, p.zoom * factor))
      // canvas coords under cursor before zoom
      const canX = (mx - cw / 2 - p.panX) / p.zoom
      const canY = (my - ch / 2 - p.panY) / p.zoom
      return {
        panX: mx - cw / 2 - canX * nz,
        panY: my - ch / 2 - canY * nz,
        zoom: nz,
      }
    })
  }, [])

  // ── Node interactions ────────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: VNode) => {
      e.stopPropagation()
      setPopoverNodeId(prev => (prev === node.id ? null : node.id))
      if (node.task) {
        const isMobile =
          typeof window !== 'undefined' && window.innerWidth < 768
        if (isMobile && onOpenTaskMobile) {
          onOpenTaskMobile(node.task.id)
        } else {
          onSelectTask(node.task.id)
        }
      }
    },
    [onSelectTask, onOpenTaskMobile],
  )

  const handleNodeDblClick = useCallback((e: React.MouseEvent, node: VNode) => {
    e.stopPropagation()
    if (!node.hasChildren) return
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      return next
    })
  }, [])

  const resetView = useCallback(() => setVs({ panX: 0, panY: 0, zoom: 0.82 }), [])

  // ── Popover node ─────────────────────────────────────────────────────────────
  const popoverNode = popoverNodeId ? nodeMap.get(popoverNodeId) : undefined

  const { panX, panY, zoom } = vs

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
      style={{ height: 620 }}
    >
      {/* ── Zoom % badge ── */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-slate-200 bg-white/90 px-2 py-1 font-mono text-[10px] text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400">
        {Math.round(zoom * 100)}%
      </div>

      {/* ── Zoom controls ── */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
        <button
          onClick={() => setVs(p => ({ ...p, zoom: Math.min(4, p.zoom * 1.25) }))}
          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          +
        </button>
        <button
          onClick={() => setVs(p => ({ ...p, zoom: Math.max(0.12, p.zoom * 0.8) }))}
          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Reset
        </button>
      </div>

      {/* ── Hint bar ── */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] text-slate-400 backdrop-blur dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500">
        Arrastra · Rueda = zoom · Doble clic para colapsar ramas
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ cursor: 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onWheel={onWheel}
        onClick={() => setPopoverNodeId(null)}
      >
        {/*
          Transform group: the origin (0,0) of our canvas coordinate system
          sits at the visual center of the container after pan.
          Screen position of canvas point (cx, cy):
            screenX = containerW/2 + cx*zoom + panX
            screenY = containerH/2 + cy*zoom + panY
        */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            // translate brings the element's top-left to the center, then
            // we add the user pan on top.
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* ── SVG edges (behind nodes) ── */}
          <svg
            style={{
              position: 'absolute',
              overflow: 'visible',
              left: 0,
              top: 0,
              pointerEvents: 'none',
            }}
          >
            {edges.map(({ child, parent }) => {
              const palette =
                child.phaseIdx >= 0
                  ? PHASE_PALETTE[child.phaseIdx % PHASE_PALETTE.length]
                  : { edge: '#94a3b8' }
              return (
                <path
                  key={`${parent.id}→${child.id}`}
                  d={mkEdgePath(parent, child)}
                  fill="none"
                  stroke={palette.edge}
                  strokeWidth={child.isPhase ? 2.5 : 1.5}
                  strokeOpacity={0.72}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {/* ── Nodes ── */}
          {nodes.map(node => {
            const w = vnodeWidth(node)
            const isCollapsed = collapsedIds.has(node.id)
            const palette =
              node.phaseIdx >= 0
                ? PHASE_PALETTE[node.phaseIdx % PHASE_PALETTE.length]
                : null
            const isSelected = popoverNodeId === node.id

            return (
              <div
                key={node.id}
                data-mmnode="1"
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  transform: 'translate(-50%, -50%)',
                  width: w,
                  zIndex: node.isRoot ? 10 : node.isPhase ? 5 : 2,
                  cursor: 'pointer',
                }}
                onClick={e => handleNodeClick(e, node)}
                onDoubleClick={e => handleNodeDblClick(e, node)}
                onMouseDown={e => e.stopPropagation()}
              >
                {/* ── Root node ── */}
                {node.isRoot && (
                  <div
                    className={`rounded-2xl border-2 border-indigo-400 bg-indigo-600 px-4 py-3 text-center text-[13px] font-bold leading-snug text-white shadow-lg transition-shadow hover:shadow-xl dark:border-indigo-500 ${isSelected ? 'ring-2 ring-white ring-offset-1' : ''}`}
                  >
                    {node.label}
                  </div>
                )}

                {/* ── Phase node ── */}
                {node.isPhase && palette && (
                  <div
                    className={`rounded-xl px-3 py-2 text-center text-[12px] font-bold leading-snug shadow-md transition-shadow hover:shadow-lg ${palette.node} ${isSelected ? 'ring-2 ring-white ring-offset-1' : ''}`}
                  >
                    {node.label}
                    {node.hasChildren && isCollapsed && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                        +
                      </span>
                    )}
                  </div>
                )}

                {/* ── Leaf / item node ── */}
                {!node.isRoot && !node.isPhase && (
                  <div
                    className={`rounded-lg border bg-white px-2.5 py-1.5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 ${
                      node.task
                        ? 'border-indigo-200 dark:border-indigo-700/60'
                        : 'border-slate-200 dark:border-slate-600'
                    } ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-indigo-500' : ''}`}
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-1">
                      {node.task?.checked && (
                        <span className="mt-0.5 flex-shrink-0 text-[10px] text-emerald-500">✓</span>
                      )}
                      <span className="line-clamp-2 text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-200">
                        {node.label}
                      </span>
                      {node.hasChildren && isCollapsed && (
                        <span className="ml-auto mt-0.5 flex-shrink-0 rounded-full bg-slate-100 px-1 text-[9px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          +
                        </span>
                      )}
                    </div>

                    {/* Status + dates */}
                    {node.task && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={`rounded border px-1 py-0.5 text-[9px] font-semibold ${STATUS_META[node.task.status].cls}`}
                        >
                          {STATUS_META[node.task.status].label}
                        </span>
                        {node.task.scheduledStartAt && node.task.scheduledEndAt && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">
                            {fmtDate(node.task.scheduledStartAt)}
                            {' – '}
                            {fmtDate(node.task.scheduledEndAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Popover (fixed top-right, only for task nodes) ── */}
      {popoverNode && popoverNode.task && (
        <div
          className="absolute right-3 top-12 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          onClick={e => e.stopPropagation()}
          data-mmnode="1"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
              {popoverNode.label}
            </p>
            <button
              onClick={() => setPopoverNodeId(null)}
              className="flex-shrink-0 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <X size={13} />
            </button>
          </div>

          {/* Status badge */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_META[popoverNode.task.status].cls}`}
            >
              {STATUS_META[popoverNode.task.status].label}
            </span>
            {popoverNode.task.checked && (
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300">
                ✓ Completada
              </span>
            )}
          </div>

          {/* Dates */}
          {(popoverNode.task.scheduledStartAt || popoverNode.task.scheduledEndAt || popoverNode.task.dueAt) && (
            <div className="mt-2 space-y-0.5">
              {popoverNode.task.scheduledStartAt && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Inicio: </span>
                  {fmtDate(popoverNode.task.scheduledStartAt)}
                </p>
              )}
              {popoverNode.task.scheduledEndAt && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Fin: </span>
                  {fmtDate(popoverNode.task.scheduledEndAt)}
                </p>
              )}
              {!popoverNode.task.scheduledEndAt && popoverNode.task.dueAt && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Vence: </span>
                  {fmtDate(popoverNode.task.dueAt)}
                </p>
              )}
            </div>
          )}

          {/* Phase label */}
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            {popoverNode.task.phaseTitle}
          </p>

          {/* Action button */}
          <button
            onClick={() => {
              if (!popoverNode.task) return
              const isMobile =
                typeof window !== 'undefined' && window.innerWidth < 768
              if (isMobile && onOpenTaskMobile) {
                onOpenTaskMobile(popoverNode.task.id)
              } else {
                onSelectTask(popoverNode.task.id)
              }
              setPopoverNodeId(null)
            }}
            className="mt-2.5 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700/60 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
          >
            Abrir detalles →
          </button>
        </div>
      )}
    </div>
  )
}
