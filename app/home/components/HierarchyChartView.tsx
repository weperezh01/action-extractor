'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Phase, InteractiveTask } from '@/app/home/lib/types'
import type { PlaybookNode } from '@/lib/playbook-tree'
import { getTaskStatusChipClassName } from '@/lib/task-statuses'

// ── Layout constants ──────────────────────────────────────────────────────────
const LEVEL_Y_GAP = 120  // center-to-center vertical distance between depth levels
const LEAF_X_GAP  = 188  // center-to-center horizontal distance between adjacent leaves
const ROOT_W = 240,  ROOT_H  = 62
const PHASE_W = 196, PHASE_H = 52
const LEAF_W  = 164, LEAF_H  = 52  // leaf height accommodates status chip + dates

// ── Phase color palette ───────────────────────────────────────────────────────
const PHASE_PALETTE = [
  { node: 'bg-indigo-600 text-white',  conn: '#818cf8' },
  { node: 'bg-violet-600 text-white',  conn: '#a78bfa' },
  { node: 'bg-sky-500 text-white',     conn: '#38bdf8' },
  { node: 'bg-emerald-600 text-white', conn: '#34d399' },
  { node: 'bg-amber-500 text-white',   conn: '#fbbf24' },
  { node: 'bg-rose-500 text-white',    conn: '#fb7185' },
  { node: 'bg-teal-600 text-white',    conn: '#2dd4bf' },
  { node: 'bg-orange-500 text-white',  conn: '#fb923c' },
]

const NEUTRAL_CONN = '#94a3b8'   // slate-400 — used for root → phase connectors

function getStatusLabel(status: InteractiveTask['status']) {
  if (status === 'completed') return 'Completada'
  if (status === 'in_progress') return 'En progreso'
  if (status === 'blocked') return 'Bloqueada'
  if (status === 'pending') return 'Pendiente'
  return status
}

// ── Internal types ────────────────────────────────────────────────────────────
interface VNode {
  id: string
  label: string
  parentId: string | null
  depth: number
  x: number        // center-x in canvas coords
  y: number        // center-y in canvas coords
  w: number        // rendered width (for sizing the div)
  h: number        // logical height (used for connector endpoints)
  isRoot?: boolean
  isPhase?: boolean
  phaseIdx: number // -1 for root; index into PHASE_PALETTE otherwise
  nodeRefId?: string // original PlaybookNode.id — for tasksByNodeId lookup
  task?: InteractiveTask
  hasChildren: boolean
}

interface ConnSegment {
  d: string         // SVG path data
  color: string     // stroke color
  strokeW: number   // stroke-width
}

// ── Layout builder ────────────────────────────────────────────────────────────
function buildHierarchyLayout(
  phases: Phase[],
  tasksByNodeId: Map<string, InteractiveTask>,
  collapsedIds: Set<string>,
  rootLabel: string,
): { nodes: VNode[]; connections: ConnSegment[] } {
  const nodes: VNode[] = []
  let leafCounter = 0

  // Returns center-x assigned to this subtree.
  function addPlaybookNode(
    node: PlaybookNode,
    parentId: string,
    depth: number,
    phaseId: number,
    phaseIdx: number,
  ): number {
    const vnId = `p${phaseId}-${node.id}`
    const task = tasksByNodeId.get(node.id)
    const isCollapsed = collapsedIds.has(vnId)
    const visibleChildren = isCollapsed ? [] : node.children

    let cx: number
    if (visibleChildren.length > 0) {
      const childXs = visibleChildren.map(c =>
        addPlaybookNode(c, vnId, depth + 1, phaseId, phaseIdx),
      )
      cx = (childXs[0] + childXs[childXs.length - 1]) / 2
    } else {
      cx = leafCounter * LEAF_X_GAP
      leafCounter++
    }

    nodes.push({
      id: vnId,
      label: node.text,
      parentId,
      depth,
      x: cx,
      y: depth * LEVEL_Y_GAP,
      w: LEAF_W,
      h: LEAF_H,
      phaseIdx,
      nodeRefId: node.id,
      task,
      hasChildren: node.children.length > 0,
    })
    return cx
  }

  const phaseXs: number[] = phases.map((phase, pIdx) => {
    const phaseId = `phase-${phase.id}`
    const isCollapsed = collapsedIds.has(phaseId)
    const visibleItems = isCollapsed ? [] : phase.items

    let px: number
    if (visibleItems.length > 0) {
      const itemXs = visibleItems.map(item =>
        addPlaybookNode(item, phaseId, 2, phase.id, pIdx),
      )
      px = (itemXs[0] + itemXs[itemXs.length - 1]) / 2
    } else {
      px = leafCounter * LEAF_X_GAP
      leafCounter++
    }

    nodes.push({
      id: phaseId,
      label: phase.title,
      parentId: 'hier-root',
      depth: 1,
      x: px,
      y: LEVEL_Y_GAP,
      w: PHASE_W,
      h: PHASE_H,
      isPhase: true,
      phaseIdx: pIdx,
      hasChildren: phase.items.length > 0,
    })
    return px
  })

  const rootX =
    phaseXs.length > 0 ? (phaseXs[0] + phaseXs[phaseXs.length - 1]) / 2 : 0

  nodes.push({
    id: 'hier-root',
    label: rootLabel,
    parentId: null,
    depth: 0,
    x: rootX,
    y: 0,
    w: ROOT_W,
    h: ROOT_H,
    isRoot: true,
    phaseIdx: -1,
    hasChildren: phases.length > 0,
  })

  // Center the layout: shift so root sits at (0, 0) and the tree is vertically centered.
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0)
  const xOff = rootX
  const yOff = (maxDepth * LEVEL_Y_GAP) / 2
  nodes.forEach(n => {
    n.x -= xOff
    n.y -= yOff
  })

  // ── Build org-chart connector paths ─────────────────────────────────────────
  const nodeMap = new Map<string, VNode>()
  nodes.forEach(n => nodeMap.set(n.id, n))

  // Group children by parentId
  const childrenByParent = new Map<string, VNode[]>()
  for (const node of nodes) {
    if (node.parentId !== null) {
      const arr = childrenByParent.get(node.parentId) ?? []
      arr.push(node)
      childrenByParent.set(node.parentId, arr)
    }
  }

  const connections: ConnSegment[] = []

  childrenByParent.forEach((children, parentId) => {
    const parent = nodeMap.get(parentId)
    if (!parent) return

    // Sort by x so the bus is drawn left-to-right
    const sorted = [...children].sort((a, b) => a.x - b.x)

    const parentBot = parent.y + parent.h / 2
    const firstChildTop = sorted[0].y - sorted[0].h / 2
    // Bus midpoint: 40% of the vertical gap between parent bottom and child top
    const midY = parentBot + (firstChildTop - parentBot) * 0.4

    const color = parent.isRoot
      ? NEUTRAL_CONN
      : PHASE_PALETTE[parent.phaseIdx % PHASE_PALETTE.length].conn
    const strokeW = parent.isRoot ? 2 : 1.5

    if (sorted.length === 1) {
      const c = sorted[0]
      connections.push({
        d: `M ${parent.x} ${parentBot} V ${midY} H ${c.x} V ${c.y - c.h / 2}`,
        color,
        strokeW,
      })
    } else {
      // 1. Parent vertical drop to bus level
      connections.push({
        d: `M ${parent.x} ${parentBot} V ${midY}`,
        color,
        strokeW,
      })
      // 2. Horizontal bus spanning all children
      connections.push({
        d: `M ${sorted[0].x} ${midY} H ${sorted[sorted.length - 1].x}`,
        color,
        strokeW,
      })
      // 3. Individual child drops
      for (const c of sorted) {
        const childColor = c.isPhase
          ? NEUTRAL_CONN
          : PHASE_PALETTE[c.phaseIdx % PHASE_PALETTE.length].conn
        connections.push({
          d: `M ${c.x} ${midY} V ${c.y - c.h / 2}`,
          color: parent.isRoot ? NEUTRAL_CONN : childColor,
          strokeW: 1.5,
        })
      }
    }
  })

  return { nodes, connections }
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface HierarchyChartViewProps {
  phases: Phase[]
  tasksByNodeId: Map<string, InteractiveTask>
  objective: string
  sourceDisplayTitle?: string
  onSelectTask: (taskId: string) => void
  onOpenTaskMobile?: (taskId: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export function HierarchyChartView({
  phases,
  tasksByNodeId,
  objective,
  sourceDisplayTitle,
  onSelectTask,
  onOpenTaskMobile,
}: HierarchyChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  const [vs, setVs] = useState({ panX: 0, panY: 0, zoom: 0.78 })
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null)

  // Root label: prefer source title, fallback to objective
  const rootLabel = useMemo(() => {
    const t = sourceDisplayTitle || objective
    return t.length > 54 ? t.slice(0, 52) + '…' : t
  }, [sourceDisplayTitle, objective])

  // Build layout (recomputes when collapsed state or data changes)
  const { nodes, connections } = useMemo(
    () => buildHierarchyLayout(phases, tasksByNodeId, collapsedIds, rootLabel),
    [phases, tasksByNodeId, collapsedIds, rootLabel],
  )

  const nodeMap = useMemo(() => {
    const m = new Map<string, VNode>()
    nodes.forEach(n => m.set(n.id, n))
    return m
  }, [nodes])

  // ── Pan handlers ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-hcnode]')) return
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

  // ── Wheel zoom (centered on cursor) ─────────────────────────────────────────
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
      const nz = Math.min(4, Math.max(0.1, p.zoom * factor))
      // Keep the canvas point under the cursor fixed
      const canX = (mx - cw / 2 - p.panX) / p.zoom
      const canY = (my - ch / 2 - p.panY) / p.zoom
      return { panX: mx - cw / 2 - canX * nz, panY: my - ch / 2 - canY * nz, zoom: nz }
    })
  }, [])

  // ── Node click: toggle popover + call parent callback ───────────────────────
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: VNode) => {
      e.stopPropagation()
      setPopoverNodeId(prev => (prev === node.id ? null : node.id))
      if (node.task) {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
        if (isMobile && onOpenTaskMobile) {
          onOpenTaskMobile(node.task.id)
        } else {
          onSelectTask(node.task.id)
        }
      }
    },
    [onSelectTask, onOpenTaskMobile],
  )

  // ── Double-click: collapse / expand subtree ──────────────────────────────────
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

  const resetView = useCallback(() => setVs({ panX: 0, panY: 0, zoom: 0.78 }), [])

  const popoverNode = popoverNodeId ? nodeMap.get(popoverNodeId) : undefined
  const { panX, panY, zoom } = vs

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
      style={{ height: 640 }}
    >
      {/* ── Zoom badge ── */}
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
          onClick={() => setVs(p => ({ ...p, zoom: Math.max(0.1, p.zoom * 0.8) }))}
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
          Transform group: canvas (0,0) → center of container.
          Screen position of canvas point (cx, cy):
            screenX = containerW/2 + cx*zoom + panX
            screenY = containerH/2 + cy*zoom + panY
        */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* ── SVG connectors (behind nodes) ── */}
          <svg
            style={{
              position: 'absolute',
              overflow: 'visible',
              left: 0,
              top: 0,
              pointerEvents: 'none',
            }}
          >
            {connections.map((seg, i) => (
              <path
                key={i}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth={seg.strokeW}
                strokeOpacity={0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {/* ── Nodes ── */}
          {nodes.map(node => {
            const isCollapsed = collapsedIds.has(node.id)
            const isSelected = popoverNodeId === node.id
            const palette =
              node.phaseIdx >= 0
                ? PHASE_PALETTE[node.phaseIdx % PHASE_PALETTE.length]
                : null

            return (
              <div
                key={node.id}
                data-hcnode="1"
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  transform: 'translate(-50%, -50%)',
                  width: node.w,
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
                    className={`rounded-2xl border-2 border-indigo-400 bg-indigo-600 px-4 py-3 text-center text-[13px] font-bold leading-snug text-white shadow-lg transition-shadow hover:shadow-xl dark:border-indigo-500 ${
                      isSelected ? 'ring-2 ring-white ring-offset-1' : ''
                    }`}
                  >
                    {node.label}
                  </div>
                )}

                {/* ── Phase node ── */}
                {node.isPhase && palette && (
                  <div
                    className={`rounded-xl px-3 py-2 text-center text-[12px] font-bold leading-snug shadow-md transition-shadow hover:shadow-lg ${palette.node} ${
                      isSelected ? 'ring-2 ring-white ring-offset-1' : ''
                    }`}
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
                    } ${
                      isSelected
                        ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-indigo-500'
                        : ''
                    }`}
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-1">
                      {node.task?.checked && (
                        <span className="mt-0.5 flex-shrink-0 text-[10px] text-emerald-500">
                          ✓
                        </span>
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

                    {/* Status chip + dates */}
                    {node.task && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={`rounded border px-1 py-0.5 text-[9px] font-semibold ${getTaskStatusChipClassName(node.task.status)}`}
                        >
                          {getStatusLabel(node.task.status)}
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

      {/* ── Popover (fixed top-right, shown only for task nodes) ── */}
      {popoverNode && popoverNode.task && (
        <div
          className="absolute right-3 top-12 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          onClick={e => e.stopPropagation()}
          data-hcnode="1"
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

          {/* Status */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getTaskStatusChipClassName(popoverNode.task.status)}`}
            >
              {getStatusLabel(popoverNode.task.status)}
            </span>
            {popoverNode.task.checked && (
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300">
                ✓ Completada
              </span>
            )}
          </div>

          {/* Dates */}
          {(popoverNode.task.scheduledStartAt ||
            popoverNode.task.scheduledEndAt ||
            popoverNode.task.dueAt) && (
            <div className="mt-2 space-y-0.5">
              {popoverNode.task.scheduledStartAt && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Inicio:{' '}
                  </span>
                  {fmtDate(popoverNode.task.scheduledStartAt)}
                </p>
              )}
              {popoverNode.task.scheduledEndAt && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Fin:{' '}
                  </span>
                  {fmtDate(popoverNode.task.scheduledEndAt)}
                </p>
              )}
              {!popoverNode.task.scheduledEndAt && popoverNode.task.dueAt && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Vence:{' '}
                  </span>
                  {fmtDate(popoverNode.task.dueAt)}
                </p>
              )}
            </div>
          )}

          {/* Phase label */}
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            {popoverNode.task.phaseTitle}
          </p>

          {/* CTA button */}
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
