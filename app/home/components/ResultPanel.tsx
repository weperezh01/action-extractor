import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlignLeft,
  AlertTriangle,
  Bell,
  Eye,
  EyeOff,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  GanttChart,
  GitBranch,
  GripVertical,
  ImageIcon,
  KanbanSquare,
  LayoutList,
  Link2,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Network,
  Music2,
  Pencil,
  PenLine,
  Presentation,
  Play,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Star,
  ThumbsUp,
  Trash2,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  EXTRACTION_MODE_OPTIONS,
  getExtractionModeLabel,
  normalizeExtractionMode,
  type ExtractionMode,
} from '@/lib/extraction-modes'
import {
  addChildNode,
  addSiblingNode,
  buildNewNode,
  countNodes,
  deleteNode,
  findNode,
  flattenItemsAsText,
  flattenPhaseNodes,
  normalizePlaybookPhases,
  updateNodeText,
} from '@/lib/playbook-tree'
import dynamic from 'next/dynamic'

const FlowchartView = dynamic(
  () => import('./FlowchartView').then((m) => ({ default: m.FlowchartView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Cargando diagrama...
      </div>
    ),
  }
)
const MindMapView = dynamic(
  () => import('./MindMapView').then((m) => ({ default: m.MindMapView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Cargando mapa mental...
      </div>
    ),
  }
)
const HierarchyChartView = dynamic(
  () => import('./HierarchyChartView').then((m) => ({ default: m.HierarchyChartView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Cargando jerarquía...
      </div>
    ),
  }
)
const PresentationView = dynamic(
  () => import('./PresentationView').then((m) => ({ default: m.PresentationView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Cargando presentación...
      </div>
    ),
  }
)
import type {
  ExtractionAccessRole,
  ExtractionAdditionalSource,
  ExtractionMember,
  ExtractResult,
  InteractiveTaskAttachment,
  InteractiveTaskComment,
  InteractiveTaskLikeSummary,
  InteractiveTask,
  InteractiveTaskEventType,
  InteractiveTaskStatus,
  Phase,
  ShareVisibility,
  SourceType,
} from '@/app/home/lib/types'
import type { FolderItem } from '@/app/home/components/FolderDock'
import {
  isShareVisibilityShareable,
  getShareVisibilityLabel,
} from '@/app/home/lib/share-visibility'
import {
  buildOrderedTaskStatusValues,
  isBuiltInTaskStatus,
  MAX_TASK_STATUS_LENGTH,
  getTaskStatusChipClassName as getSharedTaskStatusChipClassName,
  normalizeTaskStatusInput,
} from '@/lib/task-statuses'
import {
  serializeTaskNumericFormula,
  type TaskNumericFormula,
  type TaskNumericFormulaOperation,
} from '@/lib/task-numeric-formulas'
import {
  buildTaskSpreadsheetExcelHtml,
  buildTaskSpreadsheetRows,
  taskSpreadsheetRowToCells,
  type TaskSpreadsheetRow,
} from '@/lib/task-spreadsheet'

interface ResultPanelProps {
  result: ExtractResult
  viewerUserId?: string | null
  url: string
  extractionMode: ExtractionMode
  activePhase: number | null
  onTogglePhase: (id: number) => void

  isExportingPdf: boolean
  shareLoading: boolean
  shareCopied: boolean
  shareVisibility: ShareVisibility
  shareVisibilityLoading: boolean
  isProcessing: boolean

  notionConfigured: boolean
  notionConnected: boolean
  notionWorkspaceName: string | null
  notionLoading: boolean
  notionExportLoading: boolean

  trelloConfigured: boolean
  trelloConnected: boolean
  trelloUsername: string | null
  trelloLoading: boolean
  trelloExportLoading: boolean

  todoistConfigured: boolean
  todoistConnected: boolean
  todoistUserLabel: string | null
  todoistLoading: boolean
  todoistExportLoading: boolean

  googleDocsConfigured: boolean
  googleDocsConnected: boolean
  googleDocsUserEmail: string | null
  googleDocsLoading: boolean
  googleDocsExportLoading: boolean
  googleSheetsExportLoading?: boolean

  onDownloadPdf: () => void | Promise<void>
  onCopyShareLink: () => void | Promise<void>
  onCopyMarkdown: () => void | Promise<void>
  onShareVisibilityChange: (visibility: ShareVisibility) => void | Promise<void>
  onSavePhases: (phases: Phase[]) => Promise<boolean>
  onSaveMeta: (meta: { title: string; thumbnailUrl: string | null; objective: string }) => Promise<boolean>
  onReExtractMode: (mode: ExtractionMode) => void
  onAnalyzeSources?: (input: { sourceIds: string[]; targetMode: 'update_current' | 'create_new' }) => Promise<boolean>

  onExportToNotion: () => void | Promise<void>
  onConnectNotion: () => void | Promise<void>

  onExportToTrello: () => void | Promise<void>
  onConnectTrello: () => void | Promise<void>

  onExportToTodoist: () => void | Promise<void>
  onConnectTodoist: () => void | Promise<void>

  onExportToGoogleDocs: () => void | Promise<void>
  onConnectGoogleDocs: () => void | Promise<void>
  onExportToGoogleSheets?: () => void | Promise<void>

  isBookClosed?: boolean
  bookFolderLabel?: string | null
  onClose?: () => void
  folders?: FolderItem[]
  onAssignFolder?: (extractionId: string, folderId: string | null) => void | Promise<void>
  accessRole?: ExtractionAccessRole
  members?: ExtractionMember[]
  membersLoading?: boolean
  memberMutationLoading?: boolean
  onAddMember?: (input: { email: string; role: 'editor' | 'viewer' }) => Promise<boolean>
  onRemoveMember?: (memberUserId: string) => Promise<boolean>
  onOpenPlaybookReference?: (playbookIdentifier: string) => void
  onFocusItemForChat?: (context: { path: string; text: string; phaseTitle: string }) => void
  onStarResult?: (starred: boolean) => void
  allTags?: import('@/app/home/lib/types').ExtractionTag[]
  onAddTag?: (name: string, color: string) => Promise<void>
  onRemoveTag?: (tagId: string) => Promise<void>
}

type PlaybookCloseStage = 'idle' | 'folding' | 'cover'
type PlaybookCoverMotion = 'opening' | 'closing'
type PlaybookPageTurnStage = 'idle' | 'primed' | 'turning'
const PLAYBOOK_COVER_OPEN_MS = 860
const PLAYBOOK_COVER_CLOSE_MS = 1380
const PLAYBOOK_PAGE_TURN_MS = 1760

interface PlaybookPageTurnSnapshot {
  sourceSectionLabel: string
  sourceDisplayTitle: string
  objective: string
  phases: Phase[]
  savedTime: string
  difficulty: string
  modeLabel: string
}

interface UploadedAdditionalSourceFile {
  sourceType: 'pdf' | 'docx' | 'text'
  text: string
  charCount: number
  sourceLabel: string
  sourceFileName: string
  sourceFileSizeBytes: number | null
  sourceFileMimeType: string | null
  sourceFileUrl: string | null
}

type TaskDetailTab = 'gestion' | 'actividad' | 'evidencias' | 'comunidad'

interface TaskStatusOption {
  value: InteractiveTaskStatus
  label: string
  chipClassName: string
}

const TASK_NUMERIC_FORMULA_OPERATIONS: TaskNumericFormulaOperation[] = [
  'sum',
  'subtract',
  'multiply',
  'divide',
]

interface TaskCollectionResponsePayload {
  tasks?: unknown
  taskStatusCatalog?: unknown
  error?: unknown
}

const TASK_SPREADSHEET_COLUMN_KEYS: Array<{
  key: keyof TaskSpreadsheetRow
  labelKey: string
  align?: 'left' | 'center' | 'right'
}> = [
  { key: 'phase', labelKey: 'playbook.sheet.phase' },
  { key: 'position', labelKey: 'playbook.sheet.position' },
  { key: 'item', labelKey: 'playbook.sheet.item' },
  { key: 'status', labelKey: 'playbook.sheet.status' },
  { key: 'checked', labelKey: 'playbook.sheet.completed', align: 'center' },
  { key: 'numericValue', labelKey: 'playbook.sheet.numericValue', align: 'right' },
  { key: 'manualNumericValue', labelKey: 'playbook.sheet.manualNumericValue', align: 'right' },
  { key: 'formula', labelKey: 'playbook.sheet.formula' },
  { key: 'scheduledStartAt', labelKey: 'playbook.sheet.scheduledStart' },
  { key: 'scheduledEndAt', labelKey: 'playbook.sheet.scheduledEnd' },
  { key: 'dueAt', labelKey: 'playbook.sheet.dueAt' },
  { key: 'completedAt', labelKey: 'playbook.sheet.completedAt' },
  { key: 'durationDays', labelKey: 'playbook.sheet.durationDays', align: 'right' },
  { key: 'predecessors', labelKey: 'playbook.sheet.predecessors' },
  { key: 'nodeType', labelKey: 'playbook.sheet.nodeType' },
  { key: 'depth', labelKey: 'playbook.sheet.depth', align: 'right' },
]

function getTaskStatusLabel(status: InteractiveTaskStatus, t: (key: string) => string) {
  switch (status) {
    case 'in_progress':
      return t('playbook.status.inProgress')
    case 'blocked':
      return t('playbook.status.blocked')
    case 'completed':
      return t('playbook.status.completed')
    case 'pending':
      return t('playbook.status.pending')
    default:
      return normalizeTaskStatusInput(status) || t('playbook.status.pending')
  }
}

function getTaskNumericFormulaOperationLabel(
  operation: TaskNumericFormulaOperation,
  t: (key: string) => string
) {
  switch (operation) {
    case 'subtract':
      return t('playbook.task.numericFormulaOperationSubtract')
    case 'multiply':
      return t('playbook.task.numericFormulaOperationMultiply')
    case 'divide':
      return t('playbook.task.numericFormulaOperationDivide')
    case 'sum':
    default:
      return t('playbook.task.numericFormulaOperationSum')
  }
}

function getTaskStatusChipClassName(status: InteractiveTaskStatus) {
  return getSharedTaskStatusChipClassName(status)
}

function getTaskStatusHeaderClassName(status: InteractiveTaskStatus) {
  if (status === 'pending') return 'text-slate-500 dark:text-slate-400'
  if (status === 'in_progress') return 'text-sky-600 dark:text-sky-400'
  if (status === 'blocked') return 'text-rose-600 dark:text-rose-400'
  if (status === 'completed') return 'text-emerald-600 dark:text-emerald-400'
  return 'text-violet-600 dark:text-violet-300'
}

function renderTaskStatusIcon(status: InteractiveTaskStatus, size: number) {
  if (status === 'completed') return <CheckCircle2 size={size} />
  if (status === 'in_progress') return <Zap size={size} />
  if (status === 'blocked') return <AlertTriangle size={size} />
  if (status === 'pending') return <Clock size={size} />
  return <Workflow size={size} />
}

function resolveTaskStatusValueFromDraft(
  draft: string,
  options: TaskStatusOption[]
): InteractiveTaskStatus | null {
  const normalizedDraft = normalizeTaskStatusInput(draft).slice(0, MAX_TASK_STATUS_LENGTH)
  if (!normalizedDraft) return null

  const normalizedDraftKey = normalizedDraft.toLocaleLowerCase()
  const existing =
    options.find((option) => option.value.toLocaleLowerCase() === normalizedDraftKey) ??
    options.find((option) => option.label.toLocaleLowerCase() === normalizedDraftKey)

  return existing?.value ?? normalizedDraft
}

function parseTaskStatusCatalogPayload(raw: unknown) {
  if (!Array.isArray(raw)) return []

  const catalog: string[] = []
  const seen = new Set<string>()

  for (const value of raw) {
    const normalized = normalizeTaskStatusInput(value).slice(0, MAX_TASK_STATUS_LENGTH)
    if (!normalized || isBuiltInTaskStatus(normalized)) continue

    const identity = normalized.toLocaleLowerCase()
    if (seen.has(identity)) continue

    seen.add(identity)
    catalog.push(normalized)
  }

  return catalog
}

function formatTaskNumericValueDraft(value: number | null) {
  if (value === null || !Number.isFinite(value)) return ''
  return String(value)
}

function parseTaskNumericValueDraft(raw: string): { ok: true; value: number | null } | { ok: false } {
  const normalized = raw.trim().replace(/,/g, '.')
  if (!normalized) {
    return { ok: true, value: null }
  }

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) {
    return { ok: false }
  }

  return { ok: true, value: parsed }
}

function createDefaultTaskNumericFormulaDraft(): TaskNumericFormula {
  return {
    operation: 'sum',
    sourceTaskIds: [],
  }
}

function sanitizeSpreadsheetFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return normalized || 'action-extractor-sheet'
}

function downloadTextBlob(content: string, mimeType: string, fileName: string) {
  if (typeof window === 'undefined') return

  const blob = new Blob([content], { type: mimeType })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function getTaskStatusIdentityKey(status: string) {
  return normalizeTaskStatusInput(status).toLocaleLowerCase()
}

function replaceTaskStatusInCatalog(catalog: string[], status: string, nextStatus: string) {
  const statusKey = getTaskStatusIdentityKey(status)
  return parseTaskStatusCatalogPayload(
    catalog.map((catalogStatus) =>
      getTaskStatusIdentityKey(catalogStatus) === statusKey ? nextStatus : catalogStatus
    )
  )
}

function removeTaskStatusFromCatalog(catalog: string[], status: string) {
  const statusKey = getTaskStatusIdentityKey(status)
  return catalog.filter((catalogStatus) => getTaskStatusIdentityKey(catalogStatus) !== statusKey)
}

function moveTaskStatusInCatalog(catalog: string[], status: string, direction: 'up' | 'down') {
  const nextCatalog = [...catalog]
  const statusKey = getTaskStatusIdentityKey(status)
  const currentIndex = nextCatalog.findIndex(
    (catalogStatus) => getTaskStatusIdentityKey(catalogStatus) === statusKey
  )
  if (currentIndex === -1) return nextCatalog

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= nextCatalog.length) return nextCatalog

  const [movedStatus] = nextCatalog.splice(currentIndex, 1)
  nextCatalog.splice(targetIndex, 0, movedStatus)
  return nextCatalog
}

function getTaskEventTypeLabel(eventType: InteractiveTaskEventType, t: (key: string) => string) {
  switch (eventType) {
    case 'pending_action':
      return t('playbook.eventType.pendingAction')
    case 'blocker':
      return t('playbook.eventType.blocker')
    case 'resolved':
      return t('playbook.eventType.resolved')
    case 'note':
    default:
      return t('playbook.eventType.note')
  }
}

function dateFromYMDutc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function getMonthMatrix(year: number, month: number): Date[][] {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const dow = firstDay.getUTCDay() // 0=Dom, 1=Lun, ...
  const offset = dow === 0 ? 6 : dow - 1 // días hacia atrás hasta el lunes
  const gridStart = new Date(Date.UTC(year, month, 1 - offset))
  return Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => {
      const d = new Date(gridStart)
      d.setUTCDate(gridStart.getUTCDate() + row * 7 + col)
      return d
    })
  )
}

interface CalTaskSegment {
  taskId: string
  rowIndex: number
  startCol: number
  endCol: number
  isStart: boolean
  isEnd: boolean
}

function segmentTaskByWeeks(
  task: { id: string; scheduledStartAt: string | null; scheduledEndAt: string | null; dueAt: string | null },
  matrix: Date[][]
): CalTaskSegment[] {
  const rawStart = task.scheduledStartAt ?? task.dueAt
  const rawEnd = task.scheduledEndAt ?? task.dueAt
  if (!rawStart || !rawEnd) return []
  const startDate = dateFromYMDutc(rawStart.slice(0, 10))
  const endDate = dateFromYMDutc(rawEnd.slice(0, 10))
  if (endDate < startDate) return []
  const segments: CalTaskSegment[] = []
  for (let rowIdx = 0; rowIdx < matrix.length; rowIdx++) {
    const row = matrix[rowIdx]
    const rowStart = row[0]; const rowEnd = row[6]
    if (endDate < rowStart || startDate > rowEnd) continue
    const segStart = startDate < rowStart ? rowStart : startDate
    const segEnd = endDate > rowEnd ? rowEnd : endDate
    const startCol = row.findIndex(d => isSameDay(d, segStart))
    const endCol = row.findIndex(d => isSameDay(d, segEnd))
    segments.push({
      taskId: task.id, rowIndex: rowIdx,
      startCol: startCol < 0 ? 0 : startCol,
      endCol: endCol < 0 ? 6 : endCol,
      isStart: isSameDay(segStart, startDate),
      isEnd: isSameDay(segEnd, endDate),
    })
  }
  return segments
}

function assignLanesInRow(segs: CalTaskSegment[]): (CalTaskSegment & { lane: number })[] {
  const sorted = [...segs].sort((a, b) => a.startCol - b.startCol)
  const laneEnds: number[] = []
  return sorted.map(seg => {
    let lane = laneEnds.findIndex(end => end < seg.startCol)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(seg.endCol) }
    else { laneEnds[lane] = seg.endCol }
    return { ...seg, lane }
  })
}

const GANTT_LEFT_W = 220  // px — ancho panel izquierdo de etiquetas
const GANTT_DAY_W  = 32   // px — ancho por día en el timeline
const GANTT_DAYS   = 42   // días visibles (6 semanas)

function getGanttWindowStart(date: Date): Date {
  const n = new Date()
  const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))
  const dow = d.getUTCDay()
  const offset = dow === 0 ? -6 : 1 - dow // retroceder al lunes
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function getGanttBarClassName(status: InteractiveTaskStatus, isOverdue: boolean): string {
  if (isOverdue)
    return 'bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-900/40 dark:border-rose-700 dark:text-rose-300'
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300'
    case 'in_progress':
      return 'bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-300'
    case 'blocked':
      return 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300'
    default:
      return 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
  }
}

interface CpmNode {
  id: string
  durationDays: number
  predecessorIds: string[]
}

interface CpmResult {
  id: string
  es: number
  ef: number
  ls: number
  lf: number
  slack: number
  critical: boolean
}

function computeCPM(nodes: CpmNode[]): Map<string, CpmResult> {
  const nodeMap = new Map<string, CpmNode>()
  const successors = new Map<string, string[]>()
  for (const n of nodes) { nodeMap.set(n.id, n); successors.set(n.id, []) }
  for (const n of nodes) {
    for (const predId of n.predecessorIds) {
      if (nodeMap.has(predId)) successors.get(predId)!.push(n.id)
    }
  }
  // Kahn topological sort
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    let deg = 0
    for (const p of n.predecessorIds) { if (nodeMap.has(p)) deg++ }
    inDeg.set(n.id, deg)
  }
  const queue: string[] = []
  inDeg.forEach((deg, id) => { if (deg === 0) queue.push(id) })
  const topo: string[] = []
  while (queue.length > 0) {
    const curr = queue.shift()!
    topo.push(curr)
    for (const succId of successors.get(curr) ?? []) {
      const nd = (inDeg.get(succId) ?? 1) - 1
      inDeg.set(succId, nd)
      if (nd === 0) queue.push(succId)
    }
  }
  const inTopo = new Set(topo)
  for (const n of nodes) { if (!inTopo.has(n.id)) topo.push(n.id) }
  // Forward pass
  const esMap = new Map<string, number>()
  const efMap = new Map<string, number>()
  for (const id of topo) {
    const n = nodeMap.get(id)!
    const esV = n.predecessorIds.reduce((max, p) => Math.max(max, efMap.get(p) ?? 0), 0)
    esMap.set(id, esV)
    efMap.set(id, esV + n.durationDays)
  }
  const projectEnd = nodes.reduce((m, n) => Math.max(m, efMap.get(n.id) ?? 0), 0)
  // Backward pass
  const lsMap = new Map<string, number>()
  const lfMap = new Map<string, number>()
  for (const id of [...topo].reverse()) {
    const n = nodeMap.get(id)!
    const succs = successors.get(id) ?? []
    const lfV = succs.reduce((min, s) => Math.min(min, lsMap.get(s) ?? projectEnd), projectEnd)
    lfMap.set(id, lfV)
    lsMap.set(id, lfV - n.durationDays)
  }
  const result = new Map<string, CpmResult>()
  for (const n of nodes) {
    const esV = esMap.get(n.id) ?? 0
    const efV = efMap.get(n.id) ?? n.durationDays
    const lsV = lsMap.get(n.id) ?? esV
    const lfV = lfMap.get(n.id) ?? efV
    const slack = lsV - esV
    result.set(n.id, { id: n.id, es: esV, ef: efV, ls: lsV, lf: lfV, slack: Math.max(0, slack), critical: slack <= 0 })
  }
  return result
}

// ── CPM Network Diagram layout ──────────────────────────────────────────────
const CPM_NODE_W = 244   // total node width
const CPM_NODE_H = 90    // total node height
const CPM_SIDE_W = 48    // left/right side cell width
const CPM_COL_GAP = 72   // horizontal gap between columns
const CPM_ROW_GAP = 52   // vertical gap between rows in same column

interface CpmNodeLayout {
  id: string
  x: number
  y: number
  layer: number
}

function buildCpmLayers(tasks: InteractiveTask[]): Map<string, number> {
  const taskSet = new Set(tasks.map(t => t.id))
  const successors = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const t of tasks) { successors.set(t.id, []); inDeg.set(t.id, 0) }
  for (const t of tasks) {
    for (const p of t.predecessorIds) {
      if (taskSet.has(p)) {
        inDeg.set(t.id, (inDeg.get(t.id) ?? 0) + 1)
        successors.get(p)!.push(t.id)
      }
    }
  }
  const layers = new Map<string, number>()
  const queue: string[] = []
  inDeg.forEach((d, id) => { if (d === 0) { queue.push(id); layers.set(id, 0) } })
  while (queue.length > 0) {
    const curr = queue.shift()!
    const cl = layers.get(curr) ?? 0
    for (const s of successors.get(curr) ?? []) {
      layers.set(s, Math.max(layers.get(s) ?? 0, cl + 1))
      const nd = (inDeg.get(s) ?? 1) - 1
      inDeg.set(s, nd)
      if (nd === 0) queue.push(s)
    }
  }
  const maxL = layers.size > 0 ? Math.max(...Array.from(layers.values())) : 0
  for (const t of tasks) { if (!layers.has(t.id)) layers.set(t.id, maxL + 1) }
  return layers
}

function buildCpmLayout(tasks: InteractiveTask[]): Map<string, CpmNodeLayout> {
  const layers = buildCpmLayers(tasks)
  const byLayer = new Map<number, InteractiveTask[]>()
  for (const t of tasks) {
    const l = layers.get(t.id) ?? 0
    const arr = byLayer.get(l) ?? []
    arr.push(t)
    byLayer.set(l, arr)
  }
  byLayer.forEach(group => {
    group.sort((a, b) =>
      a.phaseId !== b.phaseId ? a.phaseId - b.phaseId
        : (a.positionPath ?? '').localeCompare(b.positionPath ?? '')
    )
  })
  const layout = new Map<string, CpmNodeLayout>()
  byLayer.forEach((group, layer) => {
    group.forEach((t, rowIdx) => {
      layout.set(t.id, {
        id: t.id,
        x: layer * (CPM_NODE_W + CPM_COL_GAP),
        y: rowIdx * (CPM_NODE_H + CPM_ROW_GAP),
        layer,
      })
    })
  })
  return layout
}

function hasCyclicDeps(tasks: InteractiveTask[]): boolean {
  const taskSet = new Set(tasks.map(t => t.id))
  const inDeg = new Map<string, number>()
  const successors = new Map<string, string[]>()
  for (const t of tasks) { inDeg.set(t.id, 0); successors.set(t.id, []) }
  for (const t of tasks) {
    for (const p of t.predecessorIds) {
      if (taskSet.has(p)) {
        inDeg.set(t.id, (inDeg.get(t.id) ?? 0) + 1)
        successors.get(p)!.push(t.id)
      }
    }
  }
  const q: string[] = []
  inDeg.forEach((d, id) => { if (d === 0) q.push(id) })
  let visited = 0
  while (q.length > 0) {
    visited++
    const curr = q.shift()!
    for (const s of successors.get(curr) ?? []) {
      const nd = (inDeg.get(s) ?? 1) - 1
      inDeg.set(s, nd)
      if (nd === 0) q.push(s)
    }
  }
  return visited < tasks.length
}

function makeCpmBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const ctrl = Math.max(CPM_COL_GAP * 0.9, (x2 - x1) * 0.45)
  return `M${x1},${y1} C${x1 + ctrl},${y1} ${x2 - ctrl},${y2} ${x2},${y2}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

interface PlaybookReferenceToken {
  start: number
  end: number
  id: string
  label: string
}

const PLAYBOOK_REFERENCE_REGEX =
  /\[\[\s*playbook:([^\]\|\s]+)(?:\|([^\]]+))?\s*\]\]|\[([^\]]+)\]\(\s*playbook:([^) \t\r\n]+)\s*\)|\bplaybook:([A-Za-z0-9][A-Za-z0-9._-]*)\b/gi

function parsePlaybookReferenceTokens(text: unknown): PlaybookReferenceToken[] {
  const tokens: PlaybookReferenceToken[] = []
  if (typeof text !== 'string') return tokens
  if (!text.trim()) return tokens

  PLAYBOOK_REFERENCE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null = PLAYBOOK_REFERENCE_REGEX.exec(text)
  while (match) {
    const rawId = (match[1] ?? match[4] ?? match[5] ?? '').trim()
    if (rawId) {
      const rawLabel = (match[2] ?? match[3] ?? '').trim()
      tokens.push({
        start: match.index,
        end: match.index + match[0].length,
        id: rawId,
        label: rawLabel || `playbook:${rawId}`,
      })
    }
    match = PLAYBOOK_REFERENCE_REGEX.exec(text)
  }

  return tokens
}

function formatTaskEventDate(isoDate: string, locale: string, unknownDateLabel: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return unknownDateLabel

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: true,
  }).format(parsed)
}

interface TaskCommentNode extends InteractiveTaskComment {
  replies: TaskCommentNode[]
}

function buildTaskCommentTree(comments: InteractiveTaskComment[]) {
  const sorted = [...comments].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime()
    const timeB = new Date(b.createdAt).getTime()
    if (Number.isNaN(timeA) || Number.isNaN(timeB) || timeA === timeB) {
      return a.id.localeCompare(b.id)
    }
    return timeA - timeB
  })

  const nodeById = new Map<string, TaskCommentNode>()
  for (const comment of sorted) {
    nodeById.set(comment.id, { ...comment, replies: [] })
  }

  const roots: TaskCommentNode[] = []
  for (const comment of sorted) {
    const node = nodeById.get(comment.id)
    if (!node) continue

    const parentId = comment.parentCommentId?.trim() || null
    if (!parentId || parentId === comment.id) {
      roots.push(node)
      continue
    }

    const parent = nodeById.get(parentId)
    if (!parent) {
      roots.push(node)
      continue
    }

    parent.replies.push(node)
  }

  return roots
}

type EvidenceComposerMode = 'file' | 'note' | 'youtube'
type EvidenceAttachmentFilter = 'all' | InteractiveTaskAttachment['attachmentType']

const EVIDENCE_ATTACHMENT_FILTER_ORDER: InteractiveTaskAttachment['attachmentType'][] = [
  'note',
  'pdf',
  'image',
  'audio',
  'youtube_link',
]

function resolveEvidenceUploadType(mimeType: string, fileName?: string) {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === 'application/pdf') return 'pdf'
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('audio/')) return 'audio'

  const normalizedName = (fileName ?? '').trim().toLowerCase()
  const extension =
    normalizedName.lastIndexOf('.') >= 0 ? normalizedName.slice(normalizedName.lastIndexOf('.') + 1) : ''
  if (!extension) return null

  if (extension === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif'].includes(extension)) {
    return 'image'
  }
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'opus'].includes(extension)) {
    return 'audio'
  }
  return null
}

function formatAttachmentSize(sizeBytes: number | null) {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return null
  const kb = 1024
  const mb = kb * 1024
  if (sizeBytes >= mb) return `${(sizeBytes / mb).toFixed(1)} MB`
  return `${Math.max(1, Math.round(sizeBytes / kb))} KB`
}

function getAttachmentTypeLabel(
  type: InteractiveTaskAttachment['attachmentType'],
  t: (key: string) => string
) {
  if (type === 'image') return t('playbook.attachmentType.image')
  if (type === 'audio') return t('playbook.attachmentType.audio')
  if (type === 'youtube_link') return t('playbook.attachmentType.youtube')
  if (type === 'note') return t('playbook.attachmentType.note')
  return t('playbook.attachmentType.pdf')
}

function buildAttachmentFilterOptions(
  attachments: InteractiveTaskAttachment[],
  t: (key: string) => string
) {
  const counts = new Map<InteractiveTaskAttachment['attachmentType'], number>()
  for (const attachment of attachments) {
    counts.set(attachment.attachmentType, (counts.get(attachment.attachmentType) ?? 0) + 1)
  }

  const options: Array<{ key: EvidenceAttachmentFilter; label: string; count: number }> = [
    {
      key: 'all',
      label: t('playbook.evidenceFilterAll'),
      count: attachments.length,
    },
  ]

  for (const type of EVIDENCE_ATTACHMENT_FILTER_ORDER) {
    const count = counts.get(type) ?? 0
    if (count <= 0) continue
    options.push({
      key: type,
      label: getAttachmentTypeLabel(type, t),
      count,
    })
  }

  return options
}

/**
 * Deriva la URL de miniatura (primera página como JPG) de un PDF de Cloudinary.
 * Funciona tanto para thumbnailUrl ya generados como para retrocompatibilidad
 * con PDFs viejos que tenían la URL del PDF como thumbnailUrl.
 */
function resolvePdfPreviewUrl(attachment: InteractiveTaskAttachment): string | null {
  if (attachment.attachmentType !== 'pdf') return null
  // thumbnailUrl correcto: termina en .jpg/.jpeg/.png (ya es imagen)
  const thumb = attachment.thumbnailUrl
  if (thumb && !/\.pdf$/i.test(thumb)) return thumb
  // Retrocompatibilidad: derivar thumbnail desde la URL del PDF en Cloudinary
  const url = attachment.url
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    return url
      .replace('/upload/', '/upload/pg_1,f_jpg,q_70,w_600,ar_16:9,c_fill/')
      .replace(/\.pdf$/i, '.jpg')
  }
  return null
}

/**
 * Devuelve la URL del proxy para abrir un PDF con Content-Type: application/pdf
 * y Content-Disposition: inline, evitando el error "We can't open this file" en Edge.
 */
function pdfOpenUrl(url: string): string {
  if (url.includes('cloudinary.com')) {
    return `/api/pdf-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

export function ResultPanel({
  result,
  viewerUserId = null,
  url,
  extractionMode,
  activePhase,
  onTogglePhase,
  isExportingPdf,
  shareLoading,
  shareCopied,
  shareVisibility,
  shareVisibilityLoading,
  isProcessing,

  notionConfigured,
  notionConnected,
  notionWorkspaceName,
  notionLoading,
  notionExportLoading,

  trelloConfigured,
  trelloConnected,
  trelloUsername,
  trelloLoading,
  trelloExportLoading,

  todoistConfigured,
  todoistConnected,
  todoistUserLabel,
  todoistLoading,
  todoistExportLoading,

  googleDocsConfigured,
  googleDocsConnected,
  googleDocsUserEmail,
  googleDocsLoading,
  googleDocsExportLoading,
  googleSheetsExportLoading = false,

  onDownloadPdf,
  onCopyShareLink,
  onCopyMarkdown,
  onShareVisibilityChange,
  onSavePhases,
  onSaveMeta,
  onReExtractMode,
  onAnalyzeSources,

  onExportToNotion,
  onConnectNotion,

  onExportToTrello,
  onConnectTrello,

  onExportToTodoist,
  onConnectTodoist,

  onExportToGoogleDocs,
  onConnectGoogleDocs,
  onExportToGoogleSheets = async () => {},
  isBookClosed = false,
  bookFolderLabel,
  onClose,
  folders = [],
  onAssignFolder,
  accessRole = 'owner',
  members = [],
  membersLoading = false,
  memberMutationLoading = false,
  onAddMember,
  onRemoveMember,
  onOpenPlaybookReference,
  onFocusItemForChat,
  onStarResult,
  allTags = [],
  onAddTag,
  onRemoveTag,
}: ResultPanelProps) {
  const locale = useLocale()
  const tx = useTranslations()
  const localeTag = locale === 'es' ? 'es-ES' : 'en-US'

  const resolvedMode = normalizeExtractionMode(result.mode ?? extractionMode)
  const sourceUrl = (result.url ?? url).trim()
  const resolvedSourceType: SourceType = result.sourceType ?? (result.videoId ? 'youtube' : 'text')

  const sourceSectionLabel = (() => {
    switch (resolvedSourceType) {
      case 'youtube':
        return tx('playbook.source.sourceVideo')
      case 'web_url':
        return tx('playbook.source.webPage')
      case 'pdf':
        return tx('playbook.source.pdfDocument')
      case 'docx':
        return tx('playbook.source.wordDocument')
      case 'manual':
        return tx('playbook.source.manualExtraction')
      default:
        return tx('playbook.source.analyzedContent')
    }
  })()

  const sourceDisplayTitle = (() => {
    if (result.videoTitle) return result.videoTitle
    if (result.sourceLabel) return result.sourceLabel
    if (resolvedSourceType === 'manual') return tx('playbook.source.manualExtractionLabel')
    if (sourceUrl) {
      try { return new URL(sourceUrl).hostname } catch { return sourceUrl }
    }
    return tx('playbook.source.textAnalysis')
  })()
  const formattedPlaybookDateTime = useMemo(() => {
    const rawCreatedAt = result.createdAt?.trim()
    if (!rawCreatedAt) return null

    const parsed = new Date(rawCreatedAt)
    if (Number.isNaN(parsed.getTime())) return null

    return new Intl.DateTimeFormat(localeTag, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    }).format(parsed)
  }, [localeTag, result.createdAt])
  const coverFolderLabel =
    typeof bookFolderLabel === 'string' && bookFolderLabel.trim().length > 0
      ? bookFolderLabel.trim()
      : tx('playbook.folder.general')
  const playbookOwnerSignature = useMemo(() => {
    const ownerName = result.ownerName?.trim()
    if (ownerName) return ownerName
    const ownerEmail = result.ownerEmail?.trim()
    if (ownerEmail) return ownerEmail
    return tx('playbook.ownerFallback')
  }, [result.ownerEmail, result.ownerName, tx])
  const isShareableVisibility = isShareVisibilityShareable(shareVisibility)
  const isOwnerAccess = accessRole === 'owner'
  const canEditTaskContent = accessRole === 'owner' || accessRole === 'editor'
  const canEditMeta = isOwnerAccess
  const canEditStructure = canEditTaskContent
  const canManageFolder = isOwnerAccess
  const canManageVisibility = isOwnerAccess
  const canManageMembers = isOwnerAccess
  const isGuestExtraction = (result.id?.trim() ?? '').startsWith('g-')
  const currentPageTurnSnapshot = useMemo<PlaybookPageTurnSnapshot>(
    () => ({
      sourceSectionLabel,
      sourceDisplayTitle,
      objective: result.objective ?? '',
      phases: normalizePlaybookPhases(result.phases),
      savedTime: result.metadata.savedTime,
      difficulty: result.metadata.difficulty,
      modeLabel: getExtractionModeLabel(resolvedMode),
    }),
    [
      sourceSectionLabel,
      sourceDisplayTitle,
      result.objective,
      result.phases,
      result.metadata.savedTime,
      result.metadata.difficulty,
      resolvedMode,
    ]
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedPhaseId, setCopiedPhaseId] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // ── Source access ─────────────────────────────────────────────────────────
  const [showYoutubeEmbed, setShowYoutubeEmbed] = useState(false)
  const [isSourceSectionHidden, setIsSourceSectionHidden] = useState(false)
  const [showSourceTextModal, setShowSourceTextModal] = useState(false)
  const [sourceTextContent, setSourceTextContent] = useState<string | null>(null)
  const [sourceTextLoading, setSourceTextLoading] = useState(false)
  const [sourceLinkCopied, setSourceLinkCopied] = useState(false)
  const [sourceTextCopied, setSourceTextCopied] = useState(false)
  const [sourceDirectCopyLoading, setSourceDirectCopyLoading] = useState(false)
  const [sourceDirectDownloadLoading, setSourceDirectDownloadLoading] = useState(false)
  const [additionalSources, setAdditionalSources] = useState<ExtractionAdditionalSource[]>([])
  const [additionalSourcesLoading, setAdditionalSourcesLoading] = useState(false)
  const [additionalSourcesError, setAdditionalSourcesError] = useState<string | null>(null)
  const [isAdditionalSourcesFormOpen, setIsAdditionalSourcesFormOpen] = useState(false)
  const [additionalSourceLabelDraft, setAdditionalSourceLabelDraft] = useState('')
  const [additionalSourceUrlDraft, setAdditionalSourceUrlDraft] = useState('')
  const [additionalSourceUploadedFile, setAdditionalSourceUploadedFile] = useState<UploadedAdditionalSourceFile | null>(null)
  const [additionalSourceUploading, setAdditionalSourceUploading] = useState(false)
  const [additionalSourceSaving, setAdditionalSourceSaving] = useState(false)
  const [additionalSourceDeletingId, setAdditionalSourceDeletingId] = useState<string | null>(null)
  const [selectedPendingSourceIds, setSelectedPendingSourceIds] = useState<string[]>([])
  const [analyzingSourcesTarget, setAnalyzingSourcesTarget] = useState<null | 'update_current' | 'create_new'>(null)
  const [additionalSourcesReloadNonce, setAdditionalSourcesReloadNonce] = useState(0)
  const additionalSourceFileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFetchSourceText = useCallback(async () => {
    if (!result.id) return
    if (sourceTextContent !== null) { setShowSourceTextModal(true); return }
    setSourceTextLoading(true)
    try {
      const res = await fetch(`/api/extractions/${result.id}/source/text`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setSourceTextContent(json.error ?? tx('playbook.source.noSourceText'))
      } else {
        const json = await res.json() as { text?: string }
        setSourceTextContent(typeof json.text === 'string' ? json.text : tx('playbook.source.noSourceText'))
      }
    } catch {
      setSourceTextContent(tx('playbook.source.noSourceText'))
    } finally {
      setSourceTextLoading(false)
      setShowSourceTextModal(true)
    }
  }, [result.id, sourceTextContent, tx])

  const handleCopySourceLink = useCallback(() => {
    if (!sourceUrl) return
    void navigator.clipboard.writeText(sourceUrl).then(() => {
      setSourceLinkCopied(true)
      setTimeout(() => setSourceLinkCopied(false), 2000)
    })
  }, [sourceUrl])

  const handleCopySourceText = useCallback(() => {
    if (!sourceTextContent) return
    void navigator.clipboard.writeText(sourceTextContent).then(() => {
      setSourceTextCopied(true)
      setTimeout(() => setSourceTextCopied(false), 2000)
    })
  }, [sourceTextContent])

  const handleDownloadSourceText = useCallback(() => {
    if (!sourceTextContent) return
    const blob = new Blob([sourceTextContent], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(result.sourceLabel ?? result.videoTitle ?? 'source').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [sourceTextContent, result.sourceLabel, result.videoTitle])

  const fetchSourceTextSilently = useCallback(async (): Promise<string | null> => {
    if (sourceTextContent !== null) return sourceTextContent
    if (!result.id) return null
    const res = await fetch(`/api/extractions/${result.id}/source/text`)
    if (!res.ok) return null
    const json = await res.json() as { text?: string }
    const text = typeof json.text === 'string' ? json.text : null
    if (text) setSourceTextContent(text)
    return text
  }, [result.id, sourceTextContent])

  const handleDirectCopySourceText = useCallback(async () => {
    setSourceDirectCopyLoading(true)
    try {
      const text = await fetchSourceTextSilently()
      if (!text) return
      await navigator.clipboard.writeText(text)
      setSourceTextCopied(true)
      setTimeout(() => setSourceTextCopied(false), 2000)
    } finally {
      setSourceDirectCopyLoading(false)
    }
  }, [fetchSourceTextSilently])

  const handleDirectDownloadSourceText = useCallback(async () => {
    setSourceDirectDownloadLoading(true)
    try {
      const text = await fetchSourceTextSilently()
      if (!text) return
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(result.sourceLabel ?? result.videoTitle ?? result.sourceFileName ?? 'source').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setSourceDirectDownloadLoading(false)
    }
  }, [fetchSourceTextSilently, result.sourceLabel, result.videoTitle, result.sourceFileName])

  // Show text-access buttons when:
  // 1. The backend flag says so, OR
  // 2. It's a YouTube video (transcript always available), OR
  // 3. It's a source type that always produces text (pdf/docx/web_url/text/manual)
  //    — even if hasSourceText flag is missing/undefined (rehidration from old history items)
  const TEXT_SOURCE_TYPES: SourceType[] = ['pdf', 'docx', 'web_url', 'text', 'manual']
  const hasSourceText = result.hasSourceText === true ||
    (resolvedSourceType === 'youtube' && !!result.videoId) ||
    TEXT_SOURCE_TYPES.includes(resolvedSourceType)

  const primaryPlaybookSource = useMemo<ExtractionAdditionalSource>(() => ({
    id: `primary:${result.id ?? 'current'}`,
    kind: 'primary',
    analysisStatus: 'analyzed',
    analyzedAt: null,
    url: sourceUrl || null,
    sourceType: resolvedSourceType,
    sourceLabel: result.sourceLabel ?? result.videoTitle ?? null,
    createdAt: result.createdAt ?? '',
    sourceFileUrl: result.sourceFileUrl ?? null,
    sourceFileName: result.sourceFileName ?? null,
    sourceFileSizeBytes: result.sourceFileSizeBytes ?? null,
    sourceFileMimeType: result.sourceFileMimeType ?? null,
    hasSourceText,
  }), [
    hasSourceText,
    resolvedSourceType,
    result.createdAt,
    result.id,
    result.sourceFileMimeType,
    result.sourceFileName,
    result.sourceFileSizeBytes,
    result.sourceFileUrl,
    result.sourceLabel,
    result.videoTitle,
    sourceUrl,
  ])

  const resetAdditionalSourceForm = useCallback(() => {
    setAdditionalSourceLabelDraft('')
    setAdditionalSourceUrlDraft('')
    setAdditionalSourceUploadedFile(null)
    setAdditionalSourcesError(null)
    if (additionalSourceFileInputRef.current) {
      additionalSourceFileInputRef.current.value = ''
    }
  }, [])

  useEffect(() => {
    const extractionId = result.id?.trim()
    if (!extractionId) {
      setAdditionalSources([])
      setAdditionalSourcesError(null)
      setAdditionalSourcesLoading(false)
      setIsAdditionalSourcesFormOpen(false)
      resetAdditionalSourceForm()
      setSelectedPendingSourceIds([])
      return
    }

    let cancelled = false
    setAdditionalSourcesLoading(true)
    setAdditionalSourcesError(null)

    void (async () => {
      try {
        const res = await fetch(`/api/extractions/${extractionId}/sources`, {
          cache: 'no-store',
        })
        const payload = (await res.json().catch(() => null)) as
          | { sources?: ExtractionAdditionalSource[]; error?: string }
          | null

        if (cancelled) return

        if (!res.ok) {
          setAdditionalSources([])
          setAdditionalSourcesError(
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error
              : tx('playbook.source.additionalLoadError')
          )
          return
        }

        const fetchedSources = Array.isArray(payload?.sources) ? payload.sources : []
        const hasPrimary = fetchedSources.some((source) => source.kind === 'primary')
        setAdditionalSources(hasPrimary ? fetchedSources : [primaryPlaybookSource, ...fetchedSources])
      } catch {
        if (!cancelled) {
          setAdditionalSources([primaryPlaybookSource])
          setAdditionalSourcesError(tx('playbook.source.additionalLoadError'))
        }
      } finally {
        if (!cancelled) {
          setAdditionalSourcesLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [additionalSourcesReloadNonce, primaryPlaybookSource, resetAdditionalSourceForm, result.id, tx])

  useEffect(() => {
    const pendingIds = new Set(
      additionalSources
        .filter((source) => source.kind === 'additional' && source.analysisStatus === 'pending')
        .map((source) => source.id)
    )
    setSelectedPendingSourceIds((previous) => previous.filter((sourceId) => pendingIds.has(sourceId)))
  }, [additionalSources])

  const handleAdditionalSourceFileSelect = useCallback(async (file: File) => {
    setAdditionalSourcesError(null)
    setAdditionalSourceUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract/upload', {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json().catch(() => null)) as
        | {
            text?: string
            charCount?: number
            sourceLabel?: string
            sourceType?: string
            sourceFileName?: string
            sourceFileSizeBytes?: number
            sourceFileMimeType?: string
            sourceFileUrl?: string | null
            error?: string
          }
        | null

      if (!res.ok) {
        setAdditionalSourcesError(
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : tx('playbook.source.additionalSaveError')
        )
        return
      }

      if (
        !data ||
        typeof data.text !== 'string' ||
        typeof data.charCount !== 'number' ||
        (data.sourceType !== 'pdf' && data.sourceType !== 'docx' && data.sourceType !== 'text')
      ) {
        setAdditionalSourcesError(tx('playbook.source.additionalSaveError'))
        return
      }

      setAdditionalSourceUploadedFile({
        sourceType: data.sourceType,
        text: data.text,
        charCount: data.charCount,
        sourceLabel: data.sourceLabel ?? file.name,
        sourceFileName: data.sourceFileName ?? file.name,
        sourceFileSizeBytes: data.sourceFileSizeBytes ?? null,
        sourceFileMimeType: data.sourceFileMimeType ?? null,
        sourceFileUrl: data.sourceFileUrl ?? null,
      })
      setAdditionalSourceLabelDraft((previous) => previous || data.sourceLabel || file.name)
      setAdditionalSourceUrlDraft('')
    } catch {
      setAdditionalSourcesError(tx('playbook.source.additionalSaveError'))
    } finally {
      setAdditionalSourceUploading(false)
    }
  }, [tx])

  const handleAddAdditionalSource = useCallback(async () => {
    const extractionId = result.id?.trim()
    const nextUrl = additionalSourceUrlDraft.trim()
    const nextLabel = additionalSourceLabelDraft.trim()

    if (!extractionId || additionalSourceSaving) return
    if (!additionalSourceUploadedFile && !/^https?:\/\//i.test(nextUrl)) {
      setAdditionalSourcesError(tx('playbook.source.invalidAdditionalUrl'))
      return
    }

    setAdditionalSourceSaving(true)
    setAdditionalSourcesError(null)

    try {
      const res = await fetch(`/api/extractions/${extractionId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: additionalSourceUploadedFile?.sourceType ?? undefined,
          url: additionalSourceUploadedFile ? null : nextUrl,
          sourceLabel: nextLabel || null,
          sourceText: additionalSourceUploadedFile?.text ?? null,
          sourceFileUrl: additionalSourceUploadedFile?.sourceFileUrl ?? null,
          sourceFileName: additionalSourceUploadedFile?.sourceFileName ?? null,
          sourceFileSizeBytes: additionalSourceUploadedFile?.sourceFileSizeBytes ?? null,
          sourceFileMimeType: additionalSourceUploadedFile?.sourceFileMimeType ?? null,
        }),
      })
      const payload = (await res.json().catch(() => null)) as
        | { source?: ExtractionAdditionalSource; error?: string }
        | null

      if (!res.ok || !payload?.source) {
        if (typeof payload?.error === 'string' && payload.error.trim()) {
          setAdditionalSourcesError(payload.error)
        } else if (res.status === 409) {
          setAdditionalSourcesError(tx('playbook.source.duplicateSource'))
        } else if (res.status === 400) {
          setAdditionalSourcesError(tx('playbook.source.invalidAdditionalUrl'))
        } else {
          setAdditionalSourcesError(tx('playbook.source.additionalSaveError'))
        }
        return
      }

      setAdditionalSources((previous) => [...previous, payload.source as ExtractionAdditionalSource])
      resetAdditionalSourceForm()
      setIsAdditionalSourcesFormOpen(false)
    } catch {
      setAdditionalSourcesError(tx('playbook.source.additionalSaveError'))
    } finally {
      setAdditionalSourceSaving(false)
    }
  }, [
    additionalSourceLabelDraft,
    additionalSourceSaving,
    additionalSourceUploadedFile,
    additionalSourceUrlDraft,
    resetAdditionalSourceForm,
    result.id,
    tx,
  ])

  const handleDeleteAdditionalSource = useCallback(async (sourceId: string) => {
    const extractionId = result.id?.trim()
    if (!extractionId || !sourceId || additionalSourceDeletingId) return

    setAdditionalSourceDeletingId(sourceId)
    setAdditionalSourcesError(null)
    try {
      const res = await fetch(`/api/extractions/${extractionId}/sources/${sourceId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        setAdditionalSourcesError(tx('playbook.source.additionalDeleteError'))
        return
      }

      setAdditionalSources((previous) => previous.filter((source) => source.id !== sourceId))
      setSelectedPendingSourceIds((previous) => previous.filter((item) => item !== sourceId))
    } catch {
      setAdditionalSourcesError(tx('playbook.source.additionalDeleteError'))
    } finally {
      setAdditionalSourceDeletingId(null)
    }
  }, [additionalSourceDeletingId, result.id, tx])

  const pendingSources = useMemo(
    () => additionalSources.filter((source) => source.kind === 'additional' && source.analysisStatus === 'pending'),
    [additionalSources]
  )

  const togglePendingSourceSelection = useCallback((sourceId: string) => {
    setSelectedPendingSourceIds((previous) =>
      previous.includes(sourceId)
        ? previous.filter((item) => item !== sourceId)
        : [...previous, sourceId]
    )
  }, [])

  const handleAnalyzeSelectedSources = useCallback(async (targetMode: 'update_current' | 'create_new') => {
    if (!onAnalyzeSources || selectedPendingSourceIds.length === 0 || analyzingSourcesTarget) return

    setAnalyzingSourcesTarget(targetMode)
    setAdditionalSourcesError(null)
    try {
      const ok = await onAnalyzeSources({
        sourceIds: selectedPendingSourceIds,
        targetMode,
      })
      if (ok) {
        setSelectedPendingSourceIds([])
        setAdditionalSourcesReloadNonce((previous) => previous + 1)
      }
    } catch {
      setAdditionalSourcesError(tx('playbook.source.analyzeSourcesError'))
    } finally {
      setAnalyzingSourcesTarget(null)
    }
  }, [analyzingSourcesTarget, onAnalyzeSources, selectedPendingSourceIds, tx])

  const getPlaybookSourceHref = useCallback((source: ExtractionAdditionalSource) => {
    if (source.sourceFileUrl?.trim()) return source.sourceFileUrl
    if (source.url?.trim()) return source.url
    return null
  }, [])

  const getSourceTypeLabel = useCallback((sourceType: SourceType) => {
    switch (sourceType) {
      case 'youtube':
        return tx('playbook.source.sourceVideo')
      case 'web_url':
        return tx('playbook.source.webPage')
      case 'pdf':
        return tx('playbook.source.pdfDocument')
      case 'docx':
        return tx('playbook.source.wordDocument')
      case 'text':
        return tx('playbook.source.textAnalysis')
      case 'manual':
        return tx('playbook.source.manualExtraction')
      default:
        return tx('playbook.source.analyzedContent')
    }
  }, [tx])

  const getSourceStatusLabel = useCallback((source: ExtractionAdditionalSource) => {
    if (source.kind === 'primary') return tx('playbook.source.primarySource')
    return source.analysisStatus === 'analyzed'
      ? tx('playbook.source.analyzedBadge')
      : tx('playbook.source.pendingBadge')
  }, [tx])

  const formatSourceFileSize = useCallback((sizeBytes?: number | null) => {
    if (!sizeBytes || sizeBytes <= 0) return null
    if (sizeBytes >= 1024 * 1024) {
      return tx('playbook.source.fileSizeMb', { size: (sizeBytes / (1024 * 1024)).toFixed(1) })
    }
    if (sizeBytes >= 1024) {
      return tx('playbook.source.fileSizeKb', { size: (sizeBytes / 1024).toFixed(1) })
    }
    return tx('playbook.source.fileSizeBytes', { size: sizeBytes.toLocaleString() })
  }, [tx])

  const shouldShowAdditionalSourcesPanel =
    canEditMeta || additionalSources.length > 0 || additionalSourcesLoading || Boolean(additionalSourcesError)

  // ── Tags ──────────────────────────────────────────────────────────────────
  const [tagInput, setTagInput] = useState('')
  const [tagLoading, setTagLoading] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const resultTags = result.tags ?? []
  const resultTagIds = new Set(resultTags.map((t) => t.id))

  const filteredTagSuggestions = allTags.filter(
    (t) => !resultTagIds.has(t.id) && t.name.includes(tagInput.toLowerCase().trim())
  )

  const handleTagKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !tagInput.trim() || tagLoading || !onAddTag) return
    e.preventDefault()
    const name = tagInput.trim().toLowerCase()
    setTagLoading(true)
    setTagInput('')
    setShowTagDropdown(false)
    try { await onAddTag(name, 'indigo') } finally { setTagLoading(false) }
  }

  const handlePickSuggestion = async (tag: import('@/app/home/lib/types').ExtractionTag) => {
    if (tagLoading || !onAddTag) return
    setTagLoading(true)
    setShowTagDropdown(false)
    setTagInput('')
    try { await onAddTag(tag.name, tag.color) } finally { setTagLoading(false) }
  }

  const handleRemoveTag = async (tagId: string) => {
    if (tagLoading || !onRemoveTag) return
    setTagLoading(true)
    try { await onRemoveTag(tagId) } finally { setTagLoading(false) }
  }

  const handleToggleFullscreen = useCallback(() => {
    const el = panelRef.current ?? document.documentElement
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => undefined)
    } else {
      void document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const handleCopyPhase = useCallback((phase: Phase) => {
    const items = flattenItemsAsText(phase.items)
    const lines = [`## ${phase.title}`, '', ...items.map((t) => `- ${t}`)]
    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedPhaseId(phase.id)
      window.setTimeout(() => setCopiedPhaseId((p) => (p === phase.id ? null : p)), 2000)
    })
  }, [])

  const [isActionsExpanded, setIsActionsExpanded] = useState(false)
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false)
  const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState(false)
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [collapseAfterAsyncAction, setCollapseAfterAsyncAction] = useState(false)
  const asyncActionLoadingRef = useRef(false)
  const [isReextractExpanded, setIsReextractExpanded] = useState(false)
  const [collapseAfterReextract, setCollapseAfterReextract] = useState(false)
  const reextractProcessingRef = useRef(false)
  const shareMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const shareMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const rightControlsRef = useRef<HTMLDivElement | null>(null)
  const [interactiveTasks, setInteractiveTasks] = useState<InteractiveTask[]>([])
  const [taskStatusCatalog, setTaskStatusCatalog] = useState<string[]>([])
  const [taskView, setTaskView] = useState<'list' | 'kanban' | 'calendar' | 'gantt' | 'cpm' | 'mindmap' | 'hierarchy' | 'flowchart' | 'presentation' | 'sheets'>('list')
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const n = new Date()
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1))
  })
  const [schedulePopoverTask, setSchedulePopoverTask] = useState<InteractiveTask | null>(null)
  const [schedulePopoverStart, setSchedulePopoverStart] = useState('')
  const [schedulePopoverEnd, setSchedulePopoverEnd] = useState('')
  const [schedulePopoverSaving, setSchedulePopoverSaving] = useState(false)
  const [calendarSinFechaOpen, setCalendarSinFechaOpen] = useState(true)
  const [ganttRangeStart, setGanttRangeStart] = useState<Date>(() => getGanttWindowStart(new Date()))
  const [ganttSinFechaOpen, setGanttSinFechaOpen] = useState(true)
  const [cpmOnlyCritical, setCpmOnlyCritical] = useState(false)
  const [cpmGroupByPhase, setCpmGroupByPhase] = useState(true)
  const [cpmEditTask, setCpmEditTask] = useState<InteractiveTask | null>(null)
  const [cpmEditDuration, setCpmEditDuration] = useState(1)
  const [cpmEditPreds, setCpmEditPreds] = useState<string[]>([])
  const [cpmEditSaving, setCpmEditSaving] = useState(false)
  const [cpmPredSearch, setCpmPredSearch] = useState('')
  const [cpmPanX, setCpmPanX] = useState(24)
  const [cpmPanY, setCpmPanY] = useState(24)
  const [cpmZoom, setCpmZoom] = useState(0.85)
  const cpmDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const cpmDidMoveRef = useRef(false)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskMenuOpenId, setTaskMenuOpenId] = useState<string | null>(null)
  const [taskNumericValueDraftByTaskId, setTaskNumericValueDraftByTaskId] = useState<
    Record<string, string>
  >({})
  const [taskNumericValueErrorByTaskId, setTaskNumericValueErrorByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [taskNumericFormulaDraftByTaskId, setTaskNumericFormulaDraftByTaskId] = useState<
    Record<string, TaskNumericFormula>
  >({})
  const [taskNumericFormulaErrorByTaskId, setTaskNumericFormulaErrorByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [taskStatusCatalogMutationKey, setTaskStatusCatalogMutationKey] = useState<string | null>(null)
  const [editingTaskStatusValue, setEditingTaskStatusValue] = useState<string | null>(null)
  const [editingTaskStatusDraft, setEditingTaskStatusDraft] = useState('')
  const [taskCommentMenuOpenId, setTaskCommentMenuOpenId] = useState<string | null>(null)
  const [taskMutationLoadingId, setTaskMutationLoadingId] = useState<string | null>(null)
  const [eventDraftContent, setEventDraftContent] = useState('')
  const [idCopied, setIdCopied] = useState(false)
  const [isIdModalOpen, setIsIdModalOpen] = useState(false)
  const [playbookLinkCopied, setPlaybookLinkCopied] = useState(false)
  const [isAssigningFolder, setIsAssigningFolder] = useState(false)
  const [closeStage, setCloseStage] = useState<PlaybookCloseStage>('cover')
  const [coverMotion, setCoverMotion] = useState<PlaybookCoverMotion>(
    isBookClosed ? 'closing' : 'opening'
  )
  const closeTimersRef = useRef<number[]>([])
  const [pageTurnStage, setPageTurnStage] = useState<PlaybookPageTurnStage>('idle')
  const [pageTurnSnapshot, setPageTurnSnapshot] = useState<PlaybookPageTurnSnapshot | null>(null)
  const pageTurnTimersRef = useRef<number[]>([])
  const latestPageTurnSnapshotRef = useRef<PlaybookPageTurnSnapshot>(currentPageTurnSnapshot)
  const previousResultIdRef = useRef<string | null>(result.id?.trim() ?? null)
  const [isStructureEditing, setIsStructureEditing] = useState(false)
  const [phaseDrafts, setPhaseDrafts] = useState<Phase[]>(normalizePlaybookPhases(result.phases))
  const [structureSaving, setStructureSaving] = useState(false)
  const [structureError, setStructureError] = useState<string | null>(null)
  const [dragOverPhaseIndex, setDragOverPhaseIndex] = useState<number | null>(null)
  const [dragOverSubItem, setDragOverSubItem] = useState<{ phaseId: number; index: number } | null>(null)
  const dragPhaseRef = useRef<number | null>(null)
  const dragSubItemRef = useRef<{ phaseId: number; index: number } | null>(null)
  const kanbanDragRef = useRef(false)
  const [taskAttachmentsByTaskId, setTaskAttachmentsByTaskId] = useState<
    Record<string, InteractiveTaskAttachment[]>
  >({})
  const [taskAttachmentLoadingId, setTaskAttachmentLoadingId] = useState<string | null>(null)
  const [taskAttachmentMutationId, setTaskAttachmentMutationId] = useState<string | null>(null)
  const [taskAttachmentErrorByTaskId, setTaskAttachmentErrorByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [taskAttachmentFilterByTaskId, setTaskAttachmentFilterByTaskId] = useState<
    Record<string, EvidenceAttachmentFilter>
  >({})
  const [taskEvidenceComposerModeByTaskId, setTaskEvidenceComposerModeByTaskId] = useState<
    Record<string, EvidenceComposerMode>
  >({})
  const [pendingTaskFileByTaskId, setPendingTaskFileByTaskId] = useState<Record<string, File | null>>({})
  const [taskFileDropTargetId, setTaskFileDropTargetId] = useState<string | null>(null)
  const [youtubeAttachmentDraftByTaskId, setYoutubeAttachmentDraftByTaskId] = useState<
    Record<string, string>
  >({})
  const [taskCommentsByTaskId, setTaskCommentsByTaskId] = useState<
    Record<string, InteractiveTaskComment[]>
  >({})
  const [taskLikeSummaryByTaskId, setTaskLikeSummaryByTaskId] = useState<
    Record<string, InteractiveTaskLikeSummary>
  >({})
  const [taskCommunityLoadingId, setTaskCommunityLoadingId] = useState<string | null>(null)
  const [taskCommunityMutationId, setTaskCommunityMutationId] = useState<string | null>(null)
  const [taskCommunityErrorByTaskId, setTaskCommunityErrorByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [taskCommentDraftByTaskId, setTaskCommentDraftByTaskId] = useState<Record<string, string>>({})
  const [taskReplyDraftByTaskId, setTaskReplyDraftByTaskId] = useState<Record<string, string>>({})
  const [taskReplyParentByTaskId, setTaskReplyParentByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [collapsedReplyThreadsByCommentKey, setCollapsedReplyThreadsByCommentKey] = useState<
    Record<string, boolean>
  >({})
  const [taskShareCopiedByTaskId, setTaskShareCopiedByTaskId] = useState<Record<string, boolean>>({})
  const [taskOpenSectionByTaskId, setTaskOpenSectionByTaskId] = useState<
    Record<string, 'gestion' | 'actividad' | null>
  >({})
  const [taskCustomStatusDraftByTaskId, setTaskCustomStatusDraftByTaskId] = useState<
    Record<string, string>
  >({})
  // One selected task at a time — community renders only for the selected task
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Per-task community visibility (true = shown, false = hidden by user toggle)
  // Defaults to true when the task is first selected
  const [taskCommunityOpenByTaskId, setTaskCommunityOpenByTaskId] = useState<
    Record<string, boolean>
  >({})
  // Per-task evidence visibility (true = shown, false = hidden by user toggle)
  // Defaults to true when the task is first selected
  const [taskEvidenceOpenByTaskId, setTaskEvidenceOpenByTaskId] = useState<
    Record<string, boolean>
  >({})
  // Tracks tasks whose community data has already been auto-fetched (per mount)
  const autoFetchedCommunityRef = useRef<Set<string>>(new Set())
  const [taskAddEvidenceExpandedByTaskId, setTaskAddEvidenceExpandedByTaskId] = useState<
    Record<string, boolean>
  >({})
  const [copiedAttachmentId, setCopiedAttachmentId] = useState<string | null>(null)
  const [openAttachmentMenuId, setOpenAttachmentMenuId] = useState<string | null>(null)
  const [mobileSheetTaskId, setMobileSheetTaskId] = useState<string | null>(null)
  const [mobileSheetTab, setMobileSheetTab] = useState<'gestion' | 'actividad' | 'evidencias' | 'comunidad'>('gestion')
  const [noteDraftByTaskId, setNoteDraftByTaskId] = useState<Record<string, string>>({})
  const taskFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [isMetaEditing, setIsMetaEditing] = useState(false)
  const [metaTitleDraft, setMetaTitleDraft] = useState('')
  const [metaObjectiveDraft, setMetaObjectiveDraft] = useState('')
  const [metaThumbnailUrl, setMetaThumbnailUrl] = useState<string | null>(null)
  const [metaThumbnailPreview, setMetaThumbnailPreview] = useState<string | null>(null)
  const [isUploadingMetaThumb, setIsUploadingMetaThumb] = useState(false)
  const [metaThumbError, setMetaThumbError] = useState<string | null>(null)
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [metaCloudinaryAvailable, setMetaCloudinaryAvailable] = useState<boolean | null>(null)
  const [memberEmailDraft, setMemberEmailDraft] = useState('')
  const [memberRoleDraft, setMemberRoleDraft] = useState<'editor' | 'viewer'>('viewer')
  const [memberError, setMemberError] = useState<string | null>(null)
  const metaThumbInputRef = useRef<HTMLInputElement>(null)
  const phasesSignature = useMemo(() => JSON.stringify(result.phases), [result.phases])
  const isAnyActionLoading =
    isExportingPdf ||
    shareLoading ||
    notionLoading ||
    notionExportLoading ||
    trelloLoading ||
    trelloExportLoading ||
    todoistLoading ||
    todoistExportLoading ||
    googleDocsLoading ||
    googleDocsExportLoading ||
    googleSheetsExportLoading
  const isBookFullyClosed = closeStage === 'cover'
  const isBookOpen = closeStage === 'idle'
  const isPageTurning = pageTurnStage !== 'idle'
  const shouldHideBookContent =
    isBookFullyClosed || (closeStage === 'folding' && coverMotion === 'closing')
  const showBookCover = true
  const coverOpenedToLeft =
    closeStage === 'idle' || (closeStage === 'folding' && coverMotion === 'opening')
  const showPageTurnLeaf = isBookOpen && !isBookClosed && isPageTurning && Boolean(pageTurnSnapshot)
  const pageTurnTransform =
    pageTurnStage === 'turning'
      ? 'perspective(2800px) rotateY(-98deg) rotateX(1.15deg) skewY(-1.2deg) skewX(-0.8deg) scaleX(0.994) scaleY(0.983)'
      : 'perspective(2800px) rotateY(0deg) rotateX(0deg) skewY(0deg) skewX(0deg) scaleX(1) scaleY(1)'
  const pageTurnBorderRadius =
    pageTurnStage === 'turning'
      ? '2px 66px 84px 2px / 2px 82px 106px 2px'
      : '2px 12px 14px 2px / 2px 16px 18px 2px'
  const pageTurnShadow =
    pageTurnStage === 'turning'
      ? 'inset -24px 0 34px rgba(128, 100, 58, 0.24), inset -66px 0 44px rgba(255, 255, 255, 0.22), 12px 0 28px -15px rgba(64, 43, 20, 0.56)'
      : 'inset 0 0 0 1px rgba(255, 255, 255, 0.5), 8px 0 18px -14px rgba(64, 43, 20, 0.42)'
  const isPageTurnAtBend = pageTurnStage === 'turning'

  useEffect(() => {
    return () => {
      closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      closeTimersRef.current = []
      pageTurnTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      pageTurnTimersRef.current = []
    }
  }, [])

  useEffect(() => {
    closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    closeTimersRef.current = []

    if (isBookClosed) {
      setCoverMotion('closing')
      setCloseStage('folding')
      const closeTimer = window.setTimeout(() => setCloseStage('cover'), PLAYBOOK_COVER_CLOSE_MS)
      closeTimersRef.current = [closeTimer]
      return
    }

    setCoverMotion('opening')
    setCloseStage('folding')
    const openTimer = window.setTimeout(() => setCloseStage('idle'), PLAYBOOK_COVER_OPEN_MS)
    closeTimersRef.current = [openTimer]
  }, [isBookClosed])

  useEffect(() => {
    const nextResultId = result.id?.trim() ?? null
    const previousResultId = previousResultIdRef.current

    const shouldAnimateTurn =
      previousResultId !== null &&
      nextResultId !== null &&
      previousResultId !== nextResultId &&
      closeStage === 'idle' &&
      !isBookClosed

    pageTurnTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    pageTurnTimersRef.current = []

    if (shouldAnimateTurn) {
      setPageTurnSnapshot(latestPageTurnSnapshotRef.current)
      setPageTurnStage('primed')
      const startTimer = window.setTimeout(() => setPageTurnStage('turning'), 20)
      const endTimer = window.setTimeout(() => {
        setPageTurnStage('idle')
        setPageTurnSnapshot(null)
      }, PLAYBOOK_PAGE_TURN_MS + 120)
      pageTurnTimersRef.current = [startTimer, endTimer]
    } else {
      setPageTurnStage('idle')
      setPageTurnSnapshot(null)
    }

    previousResultIdRef.current = nextResultId
  }, [result.id, closeStage, isBookClosed])

  useEffect(() => {
    latestPageTurnSnapshotRef.current = currentPageTurnSnapshot
  }, [currentPageTurnSnapshot])

  useEffect(() => {
    if (!collapseAfterAsyncAction) return

    if (isAnyActionLoading) {
      asyncActionLoadingRef.current = true
      return
    }

    if (!asyncActionLoadingRef.current) return

    setIsActionsExpanded(false)
    setCollapseAfterAsyncAction(false)
    asyncActionLoadingRef.current = false
  }, [collapseAfterAsyncAction, isAnyActionLoading])

  useEffect(() => {
    if (!collapseAfterReextract) return

    if (isProcessing) {
      reextractProcessingRef.current = true
      return
    }

    if (!reextractProcessingRef.current) return

    setIsReextractExpanded(false)
    setCollapseAfterReextract(false)
    reextractProcessingRef.current = false
  }, [collapseAfterReextract, isProcessing])

  useEffect(() => {
    if (!isActionsExpanded && !isReextractExpanded) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return

      const controls = rightControlsRef.current
      if (!controls || controls.contains(target)) return

      setIsActionsExpanded(false)
      setIsReextractExpanded(false)
      setCollapseAfterAsyncAction(false)
      setCollapseAfterReextract(false)
      asyncActionLoadingRef.current = false
      reextractProcessingRef.current = false
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isActionsExpanded, isReextractExpanded])

  // Share menu close-on-outside-click is handled by the modal backdrop onClick

  useEffect(() => {
    setIdCopied(false)
    setIsIdModalOpen(false)
    setIsActionsModalOpen(false)
    setIsIntegrationsModalOpen(false)
    setIsShareMenuOpen(false)
  }, [result.id])

  // Reset meta edit mode when extraction changes
  useEffect(() => {
    setIsMetaEditing(false)
    setMetaError(null)
    setMetaCloudinaryAvailable(null)
    setMemberEmailDraft('')
    setMemberRoleDraft('viewer')
    setMemberError(null)
  }, [result.id])

  // Probe Cloudinary availability when meta edit mode opens
  useEffect(() => {
    if (!isMetaEditing || metaCloudinaryAvailable !== null) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/extract/thumbnail', { method: 'POST', body: new FormData() })
        if (!cancelled) setMetaCloudinaryAvailable(res.status !== 503)
      } catch {
        if (!cancelled) setMetaCloudinaryAvailable(false)
      }
    })()
    return () => { cancelled = true }
  }, [isMetaEditing, metaCloudinaryAvailable])

  useEffect(() => {
    setTaskStatusCatalog([])
    setTaskStatusCatalogMutationKey(null)
    setEditingTaskStatusValue(null)
    setEditingTaskStatusDraft('')
    setTaskNumericValueDraftByTaskId({})
    setTaskNumericValueErrorByTaskId({})
    setTaskNumericFormulaDraftByTaskId({})
    setTaskNumericFormulaErrorByTaskId({})
    setTaskAttachmentsByTaskId({})
    setTaskAttachmentErrorByTaskId({})
    setYoutubeAttachmentDraftByTaskId({})
    setTaskAttachmentLoadingId(null)
    setTaskAttachmentMutationId(null)
    setTaskCommentsByTaskId({})
    setTaskLikeSummaryByTaskId({})
    setTaskCommunityLoadingId(null)
    setTaskCommunityMutationId(null)
    setTaskCommunityErrorByTaskId({})
    setTaskCommentDraftByTaskId({})
    setTaskReplyDraftByTaskId({})
    setTaskReplyParentByTaskId({})
    setTaskCommentMenuOpenId(null)
    setTaskOpenSectionByTaskId({})
    setTaskCustomStatusDraftByTaskId({})
    setSelectedTaskId(null)
    setTaskCommunityOpenByTaskId({})
    setTaskEvidenceOpenByTaskId({})
    autoFetchedCommunityRef.current = new Set()
    setTaskAddEvidenceExpandedByTaskId({})
    taskFileInputRefs.current = {}
  }, [result.id])

  useEffect(() => {
    if (isStructureEditing) return
    setPhaseDrafts(normalizePlaybookPhases(result.phases))
    setStructureError(null)
  }, [isStructureEditing, result.phases])

  useEffect(() => {
    const extractionId = result.id?.trim()
    if (!extractionId) {
      setInteractiveTasks([])
      setTaskStatusCatalog([])
      setTasksLoading(false)
      setTasksError(null)
      setActiveTaskId(null)
      return
    }

    const controller = new AbortController()

    const loadTasks = async () => {
      setTasksLoading(true)
      setTasksError(null)
      try {
        const response = canEditTaskContent
          ? await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'sync',
                phases: result.phases,
              }),
              signal: controller.signal,
            })
          : await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/tasks`, {
              method: 'GET',
              signal: controller.signal,
            })

        const payload = (await response.json().catch(() => null)) as TaskCollectionResponsePayload | null

        if (!response.ok) {
          const message =
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error
              : tx('errors.loadInteractiveChecklist')
          throw new Error(message)
        }

        const tasks = Array.isArray(payload?.tasks) ? (payload.tasks as InteractiveTask[]) : []
        const nextTaskStatusCatalog = parseTaskStatusCatalogPayload(payload?.taskStatusCatalog)
        if (controller.signal.aborted) return

        setInteractiveTasks(tasks)
        setTaskStatusCatalog(nextTaskStatusCatalog)
        setActiveTaskId((previous) => (tasks.some((task) => task.id === previous) ? previous : null))
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : tx('errors.loadInteractiveChecklist')
        setTasksError(message)
      } finally {
        if (!controller.signal.aborted) {
          setTasksLoading(false)
        }
      }
    }

    void loadTasks()

    return () => {
      controller.abort()
    }
  }, [canEditTaskContent, phasesSignature, result.id, result.phases])

  useEffect(() => {
    setEventDraftContent('')
  }, [activeTaskId])

  const tasksByPhaseItem = useMemo(() => {
    const map = new Map<string, InteractiveTask>()
    for (const task of interactiveTasks) {
      map.set(`${task.phaseId}:${task.itemIndex}`, task)
    }
    return map
  }, [interactiveTasks])

  const tasksByNodeId = useMemo(() => {
    const map = new Map<string, InteractiveTask>()
    for (const task of interactiveTasks) {
      const key = task.nodeId?.trim()
      if (!key) continue
      map.set(key, task)
    }
    return map
  }, [interactiveTasks])

  const tasksById = useMemo(() => {
    const map = new Map<string, InteractiveTask>()
    for (const task of interactiveTasks) {
      map.set(task.id, task)
    }
    return map
  }, [interactiveTasks])

  const taskStatusOptions = useMemo<TaskStatusOption[]>(() => {
    return buildOrderedTaskStatusValues({
      catalog: taskStatusCatalog,
      usedStatuses: interactiveTasks.map((task) => task.status),
    }).map((status) => ({
      value: status,
      label: getTaskStatusLabel(status, tx),
      chipClassName: getTaskStatusChipClassName(status),
    }))
  }, [interactiveTasks, taskStatusCatalog, tx])

  const customTaskStatusOptions = useMemo(
    () => taskStatusOptions.filter((option) => !isBuiltInTaskStatus(option.value)),
    [taskStatusOptions]
  )

  const customTaskStatusCatalogValues = useMemo(
    () => customTaskStatusOptions.map((option) => String(option.value)),
    [customTaskStatusOptions]
  )

  const taskCountsByStatus = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of interactiveTasks) {
      const key = normalizeTaskStatusInput(task.status).toLocaleLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [interactiveTasks])

  const isTaskStatusCatalogMutating = taskStatusCatalogMutationKey !== null

  const spreadsheetRows = useMemo(
    () =>
      buildTaskSpreadsheetRows(
        interactiveTasks.map((task) => ({
          id: task.id,
          phaseTitle: task.phaseTitle,
          itemText: task.itemText,
          positionPath: task.positionPath,
          phaseId: task.phaseId,
          itemIndex: task.itemIndex,
          status: task.status,
          checked: task.checked,
          numericValue: task.numericValue,
          manualNumericValue: task.manualNumericValue,
          numericFormula: task.numericFormula,
          dueAt: task.dueAt,
          completedAt: task.completedAt,
          scheduledStartAt: task.scheduledStartAt,
          scheduledEndAt: task.scheduledEndAt,
          durationDays: task.durationDays,
          predecessorIds: task.predecessorIds,
          flowNodeType: task.flowNodeType,
          depth: task.depth,
        }))
      ),
    [interactiveTasks]
  )

  const spreadsheetHeaders = useMemo(
    () => TASK_SPREADSHEET_COLUMN_KEYS.map((column) => tx(column.labelKey)),
    [tx]
  )

  const spreadsheetColumns = useMemo(
    () =>
      TASK_SPREADSHEET_COLUMN_KEYS.map((column, index) => ({
        ...column,
        label: spreadsheetHeaders[index] ?? column.labelKey,
      })),
    [spreadsheetHeaders]
  )

  const calendarData = useMemo(() => {
    const year = calendarMonth.getUTCFullYear()
    const month = calendarMonth.getUTCMonth()
    const matrix = getMonthMatrix(year, month)
    const segsByRow = new Map<number, CalTaskSegment[]>()
    for (const task of interactiveTasks) {
      for (const seg of segmentTaskByWeeks(task, matrix)) {
        const arr = segsByRow.get(seg.rowIndex) ?? []
        arr.push(seg)
        segsByRow.set(seg.rowIndex, arr)
      }
    }
    const lanesByRow = new Map<number, (CalTaskSegment & { lane: number })[]>()
    segsByRow.forEach((segs, rowIdx) => {
      lanesByRow.set(rowIdx, assignLanesInRow(segs))
    })
    return { matrix, lanesByRow }
  }, [calendarMonth, interactiveTasks])

  const fetchTaskAttachments = async (taskId: string) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    setTaskAttachmentLoadingId(taskId)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          taskId
        )}/attachments`,
        { cache: 'no-store' }
      )
      const payload = (await response.json().catch(() => null)) as
        | { attachments?: unknown; error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudieron cargar las evidencias.'
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: message,
        }))
        return false
      }

      const attachments = Array.isArray(payload?.attachments)
        ? (payload.attachments as InteractiveTaskAttachment[])
        : []
      setTaskAttachmentsByTaskId((previous) => ({
        ...previous,
        [taskId]: attachments,
      }))
      return true
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: 'No se pudieron cargar las evidencias.',
      }))
      return false
    } finally {
      setTaskAttachmentLoadingId((previous) => (previous === taskId ? null : previous))
    }
  }

  const fetchTaskCommunity = async (taskId: string) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    setTaskCommunityLoadingId(taskId)
    setTaskCommunityErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          taskId
        )}/community`,
        { cache: 'no-store' }
      )
      const payload = (await response.json().catch(() => null)) as
        | { comments?: unknown; likeSummary?: unknown; error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : tx('errors.loadTaskCommunity')
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: message,
        }))
        return false
      }

      const comments = Array.isArray(payload?.comments)
        ? (payload.comments as InteractiveTaskComment[])
        : []
      const likeSummary =
        payload?.likeSummary && typeof payload.likeSummary === 'object'
          ? (payload.likeSummary as InteractiveTaskLikeSummary)
          : {
              taskId,
              extractionId,
              likesCount: 0,
              likedByMe: false,
              sharesCount: 0,
              sharedByMe: false,
              followersCount: 0,
              followingByMe: false,
              viewsCount: 0,
              viewedByMe: false,
            }

      setTaskCommentsByTaskId((previous) => ({
        ...previous,
        [taskId]: comments,
      }))
      setTaskLikeSummaryByTaskId((previous) => ({
        ...previous,
        [taskId]: likeSummary,
      }))
      return true
    } catch {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: tx('errors.loadTaskCommunity'),
      }))
      return false
    } finally {
      setTaskCommunityLoadingId((previous) => (previous === taskId ? null : previous))
    }
  }

  useEffect(() => {
    const extractionId = result.id?.trim()
    if (!extractionId || !activeTaskId) return
    void fetchTaskAttachments(activeTaskId)
  }, [activeTaskId, result.id])


  // Interceptar botón "atrás" del dispositivo para cerrar el modal en lugar de navegar
  useEffect(() => {
    if (!mobileSheetTaskId) return

    const taskIdSnapshot = mobileSheetTaskId
    // Empujar una entrada falsa con la misma URL para que el "atrás" llegue aquí primero
    window.history.pushState({ mobileSheet: taskIdSnapshot }, '')

    const onPopState = () => {
      // El usuario presionó "atrás" — cerrar modal sin navegar
      setMobileSheetTaskId(null)
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      // Si el modal se cerró por otro medio (botón X), limpiar la entrada falsa del historial
      if (window.history.state?.mobileSheet === taskIdSnapshot) {
        window.history.back()
      }
    }
  }, [mobileSheetTaskId])

  // Auto-fetch comunidad cuando el sheet mobile está en esa pestaña
  useEffect(() => {
    if (!mobileSheetTaskId || mobileSheetTab !== 'comunidad') return
    if (autoFetchedCommunityRef.current.has(mobileSheetTaskId)) return
    autoFetchedCommunityRef.current.add(mobileSheetTaskId)
    void fetchTaskCommunity(mobileSheetTaskId)
  }, [mobileSheetTaskId, mobileSheetTab])

  useEffect(() => {
    const extractionId = result.id?.trim()
    const realtimeTaskId = mobileSheetTaskId ?? selectedTaskId
    if (!extractionId || !realtimeTaskId) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    const streamUrl = `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
      realtimeTaskId
    )}/community/stream`
    const stream = new EventSource(streamUrl)

    const refreshCommunity = () => {
      void fetchTaskCommunity(realtimeTaskId)
    }

    const handleReady = () => {
      refreshCommunity()
    }

    const handleRefresh = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as { taskId?: unknown }
        const eventTaskId = typeof data?.taskId === 'string' ? data.taskId : realtimeTaskId
        if (eventTaskId !== realtimeTaskId) return
      } catch {
        // Ignore malformed payloads and still refresh conservatively
      }
      refreshCommunity()
    }

    stream.addEventListener('community_ready', handleReady as EventListener)
    stream.addEventListener('community_refresh', handleRefresh as EventListener)

    return () => {
      stream.removeEventListener('community_ready', handleReady as EventListener)
      stream.removeEventListener('community_refresh', handleRefresh as EventListener)
      stream.close()
    }
  }, [mobileSheetTaskId, result.id, selectedTaskId])

  useEffect(() => {
    if (!taskMenuOpenId) return

    const handleOutsideTaskMenuClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-task-menu-root="true"]')) return
      setTaskMenuOpenId(null)
    }

    document.addEventListener('mousedown', handleOutsideTaskMenuClick)
    document.addEventListener('touchstart', handleOutsideTaskMenuClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideTaskMenuClick)
      document.removeEventListener('touchstart', handleOutsideTaskMenuClick)
    }
  }, [taskMenuOpenId])

  useEffect(() => {
    if (!taskCommentMenuOpenId) return

    const handleOutsideCommentMenuClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-task-comment-menu-root="true"]')) return
      setTaskCommentMenuOpenId(null)
    }

    document.addEventListener('mousedown', handleOutsideCommentMenuClick)
    document.addEventListener('touchstart', handleOutsideCommentMenuClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideCommentMenuClick)
      document.removeEventListener('touchstart', handleOutsideCommentMenuClick)
    }
  }, [taskCommentMenuOpenId])

  const refreshTaskCollection = async (payload: Record<string, unknown>) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    const response = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(isGuestExtraction ? {} : { taskStatusCatalog: customTaskStatusCatalogValues }),
        ...payload,
      }),
    })

    const data = (await response.json().catch(() => null)) as TaskCollectionResponsePayload | null

    if (!response.ok) {
    const message =
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
          : tx('errors.updateInteractiveChecklist')
      setTasksError(message)
      return false
    }

    const tasks = Array.isArray(data?.tasks) ? (data.tasks as InteractiveTask[]) : []
    const nextTaskStatusCatalog = parseTaskStatusCatalogPayload(data?.taskStatusCatalog)
    setInteractiveTasks(tasks)
    setTaskStatusCatalog(nextTaskStatusCatalog)
    setActiveTaskId((previous) => (tasks.some((task) => task.id === previous) ? previous : null))
    setTasksError(null)
    return true
  }

  const handleDownloadSpreadsheetExcel = useCallback(() => {
    const exportTitle =
      sourceDisplayTitle.trim() || result.objective.trim() || tx('playbook.view.sheets')
    const workbook = buildTaskSpreadsheetExcelHtml({
      title: exportTitle,
      headers: spreadsheetHeaders,
      rows: spreadsheetRows.map((row) => taskSpreadsheetRowToCells(row)),
    })

    downloadTextBlob(
      workbook,
      'application/vnd.ms-excel;charset=utf-8',
      `${sanitizeSpreadsheetFileName(exportTitle)}.xls`
    )
  }, [result.objective, sourceDisplayTitle, spreadsheetHeaders, spreadsheetRows, tx])

  const handleTaskToggle = async (task: InteractiveTask, checked: boolean) => {
    if (!canEditTaskContent) return
    setTaskMutationLoadingId(task.id)
    try {
      await refreshTaskCollection({
        action: 'update',
        taskId: task.id,
        checked,
      })
    } finally {
      setTaskMutationLoadingId(null)
    }
  }

  const handleTaskStatusChange = async (task: InteractiveTask, status: InteractiveTaskStatus) => {
    if (!canEditTaskContent) return false
    setTaskMutationLoadingId(task.id)
    try {
      return await refreshTaskCollection({
        action: 'update',
        taskId: task.id,
        status,
      })
    } finally {
      setTaskMutationLoadingId(null)
    }
  }

  const handleTaskNumericValueDraftChange = useCallback((taskId: string, value: string) => {
    setTaskNumericValueDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
    setTaskNumericValueErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))
  }, [])

  const getTaskNumericFormulaDraft = useCallback((task: InteractiveTask) => {
    const existingDraft = taskNumericFormulaDraftByTaskId[task.id]
    if (existingDraft) {
      return {
        operation: existingDraft.operation,
        sourceTaskIds: [...existingDraft.sourceTaskIds],
      }
    }
    if (task.numericFormula) {
      return {
        operation: task.numericFormula.operation,
        sourceTaskIds: [...task.numericFormula.sourceTaskIds],
      }
    }
    return createDefaultTaskNumericFormulaDraft()
  }, [taskNumericFormulaDraftByTaskId])

  const handleSaveTaskNumericValue = useCallback(async (task: InteractiveTask) => {
    if (!canEditTaskContent || task.numericFormula) return false

    const draftValue =
      taskNumericValueDraftByTaskId[task.id] ?? formatTaskNumericValueDraft(task.manualNumericValue)
    const parsedDraft = parseTaskNumericValueDraft(draftValue)

    if (!parsedDraft.ok) {
      setTaskNumericValueErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('playbook.task.invalidNumericValue'),
      }))
      return false
    }

    if (parsedDraft.value === task.numericValue) {
      setTaskNumericValueDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: formatTaskNumericValueDraft(parsedDraft.value),
      }))
      setTaskNumericValueErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      return true
    }

    setTaskMutationLoadingId(task.id)
    try {
      const updated = await refreshTaskCollection({
        action: 'update',
        taskId: task.id,
        numericValue: parsedDraft.value,
      })
      if (!updated) return false

      setTaskNumericValueDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: formatTaskNumericValueDraft(parsedDraft.value),
      }))
      setTaskNumericValueErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      return true
    } finally {
      setTaskMutationLoadingId(null)
    }
  }, [canEditTaskContent, refreshTaskCollection, taskNumericValueDraftByTaskId, tx])

  const handleTaskNumericFormulaOperationChange = useCallback((
    task: InteractiveTask,
    operation: TaskNumericFormulaOperation
  ) => {
    const currentDraft = getTaskNumericFormulaDraft(task)
    setTaskNumericFormulaDraftByTaskId((previous) => ({
      ...previous,
      [task.id]: {
        ...currentDraft,
        operation,
      },
    }))
    setTaskNumericFormulaErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))
  }, [getTaskNumericFormulaDraft])

  const handleTaskNumericFormulaSourceToggle = useCallback((
    task: InteractiveTask,
    sourceTaskId: string
  ) => {
    const currentDraft = getTaskNumericFormulaDraft(task)
    const sourceTaskIds = currentDraft.sourceTaskIds.includes(sourceTaskId)
      ? currentDraft.sourceTaskIds.filter((candidateId) => candidateId !== sourceTaskId)
      : [...currentDraft.sourceTaskIds, sourceTaskId]

    setTaskNumericFormulaDraftByTaskId((previous) => ({
      ...previous,
      [task.id]: {
        ...currentDraft,
        sourceTaskIds,
      },
    }))
    setTaskNumericFormulaErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))
  }, [getTaskNumericFormulaDraft])

  const handleSaveTaskNumericFormula = useCallback(async (task: InteractiveTask) => {
    if (!canEditTaskContent) return false

    const availableTaskIds = new Set(
      interactiveTasks.filter((candidate) => candidate.id !== task.id).map((candidate) => candidate.id)
    )
    const currentDraft = getTaskNumericFormulaDraft(task)
    const sourceTaskIds = currentDraft.sourceTaskIds.filter(
      (sourceTaskId, index) =>
        sourceTaskId !== task.id &&
        availableTaskIds.has(sourceTaskId) &&
        currentDraft.sourceTaskIds.indexOf(sourceTaskId) === index
    )

    if (sourceTaskIds.length === 0) {
      setTaskNumericFormulaErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('playbook.task.numericFormulaInvalid'),
      }))
      return false
    }

    const nextFormula: TaskNumericFormula = {
      operation: currentDraft.operation,
      sourceTaskIds,
    }

    if (serializeTaskNumericFormula(nextFormula) === serializeTaskNumericFormula(task.numericFormula)) {
      setTaskNumericFormulaDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: nextFormula,
      }))
      setTaskNumericFormulaErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      return true
    }

    setTaskMutationLoadingId(task.id)
    try {
      const updated = await refreshTaskCollection({
        action: 'update',
        taskId: task.id,
        numericFormula: nextFormula,
      })
      if (!updated) return false

      setTaskNumericFormulaDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: nextFormula,
      }))
      setTaskNumericFormulaErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      return true
    } finally {
      setTaskMutationLoadingId(null)
    }
  }, [canEditTaskContent, getTaskNumericFormulaDraft, interactiveTasks, refreshTaskCollection, tx])

  const handleClearTaskNumericFormula = useCallback(async (task: InteractiveTask) => {
    if (!canEditTaskContent) return false

    if (!task.numericFormula) {
      setTaskNumericFormulaDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: createDefaultTaskNumericFormulaDraft(),
      }))
      setTaskNumericFormulaErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      return true
    }

    setTaskMutationLoadingId(task.id)
    try {
      const updated = await refreshTaskCollection({
        action: 'update',
        taskId: task.id,
        numericFormula: null,
      })
      if (!updated) return false

      setTaskNumericFormulaDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: createDefaultTaskNumericFormulaDraft(),
      }))
      setTaskNumericFormulaErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      setTaskNumericValueDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: formatTaskNumericValueDraft(task.manualNumericValue),
      }))
      return true
    } finally {
      setTaskMutationLoadingId(null)
    }
  }, [canEditTaskContent, refreshTaskCollection])

  const handleTaskCustomStatusDraftChange = useCallback((taskId: string, value: string) => {
    setTaskCustomStatusDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value.slice(0, MAX_TASK_STATUS_LENGTH),
    }))
  }, [])

  const handleCreateTaskCustomStatus = useCallback(async (task: InteractiveTask) => {
    if (!canEditTaskContent || isGuestExtraction) return false

    const nextStatus = resolveTaskStatusValueFromDraft(
      taskCustomStatusDraftByTaskId[task.id] ?? '',
      taskStatusOptions
    )
    if (!nextStatus || isBuiltInTaskStatus(nextStatus)) return false

    const mutationKey = `add:${getTaskStatusIdentityKey(nextStatus)}`
    setTaskStatusCatalogMutationKey(mutationKey)
    try {
      const updated = await refreshTaskCollection({
        action: 'add_status',
        status: nextStatus,
        taskStatusCatalog: parseTaskStatusCatalogPayload([
          ...customTaskStatusCatalogValues,
          nextStatus,
        ]),
      })
      if (!updated) return false
      setTaskCustomStatusDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
      return true
    } finally {
      setTaskStatusCatalogMutationKey((previous) => (previous === mutationKey ? null : previous))
    }
  }, [
    canEditTaskContent,
    customTaskStatusCatalogValues,
    isGuestExtraction,
    refreshTaskCollection,
    taskCustomStatusDraftByTaskId,
    taskStatusOptions,
  ])

  const handleStartEditingTaskStatus = useCallback((status: string) => {
    setEditingTaskStatusValue(status)
    setEditingTaskStatusDraft(status)
  }, [])

  const handleCancelEditingTaskStatus = useCallback(() => {
    setEditingTaskStatusValue(null)
    setEditingTaskStatusDraft('')
  }, [])

  const handleSaveTaskStatusRename = useCallback(async () => {
    if (!canEditTaskContent || isGuestExtraction || !editingTaskStatusValue) return false

    const nextStatus = resolveTaskStatusValueFromDraft(editingTaskStatusDraft, taskStatusOptions)
    if (!nextStatus) return false

    const nextCatalog = replaceTaskStatusInCatalog(
      customTaskStatusCatalogValues,
      editingTaskStatusValue,
      nextStatus
    )
    const mutationKey = `rename:${getTaskStatusIdentityKey(editingTaskStatusValue)}`
    setTaskStatusCatalogMutationKey(mutationKey)

    try {
      const updated = await refreshTaskCollection({
        action: 'rename_status',
        status: editingTaskStatusValue,
        nextStatus,
        taskStatusCatalog: nextCatalog,
      })
      if (!updated) return false
      handleCancelEditingTaskStatus()
      return true
    } finally {
      setTaskStatusCatalogMutationKey((previous) => (previous === mutationKey ? null : previous))
    }
  }, [
    canEditTaskContent,
    customTaskStatusCatalogValues,
    editingTaskStatusDraft,
    editingTaskStatusValue,
    handleCancelEditingTaskStatus,
    isGuestExtraction,
    refreshTaskCollection,
    taskStatusOptions,
  ])

  const handleDeleteTaskStatus = useCallback(async (status: string) => {
    if (!canEditTaskContent || isGuestExtraction) return false

    const nextCatalog = removeTaskStatusFromCatalog(customTaskStatusCatalogValues, status)
    const mutationKey = `delete:${getTaskStatusIdentityKey(status)}`
    setTaskStatusCatalogMutationKey(mutationKey)

    try {
      const updated = await refreshTaskCollection({
        action: 'delete_status',
        status,
        taskStatusCatalog: nextCatalog,
      })
      if (!updated) return false
      if (
        editingTaskStatusValue &&
        getTaskStatusIdentityKey(editingTaskStatusValue) === getTaskStatusIdentityKey(status)
      ) {
        handleCancelEditingTaskStatus()
      }
      return true
    } finally {
      setTaskStatusCatalogMutationKey((previous) => (previous === mutationKey ? null : previous))
    }
  }, [
    canEditTaskContent,
    customTaskStatusCatalogValues,
    editingTaskStatusValue,
    handleCancelEditingTaskStatus,
    isGuestExtraction,
    refreshTaskCollection,
  ])

  const handleMoveTaskStatus = useCallback(async (status: string, direction: 'up' | 'down') => {
    if (!canEditTaskContent || isGuestExtraction) return false

    const nextCatalog = moveTaskStatusInCatalog(customTaskStatusCatalogValues, status, direction)
    if (nextCatalog.every((value, index) => value === customTaskStatusCatalogValues[index])) {
      return false
    }

    const mutationKey = `move:${direction}:${getTaskStatusIdentityKey(status)}`
    setTaskStatusCatalogMutationKey(mutationKey)

    try {
      return await refreshTaskCollection({
        action: 'save_status_catalog',
        taskStatusCatalog: nextCatalog,
      })
    } finally {
      setTaskStatusCatalogMutationKey((previous) => (previous === mutationKey ? null : previous))
    }
  }, [
    canEditTaskContent,
    customTaskStatusCatalogValues,
    isGuestExtraction,
    refreshTaskCollection,
  ])

  const renderTaskStatusCatalogSection = useCallback((task: InteractiveTask, density: 'desktop' | 'mobile') => {
    const taskCustomStatusDraft = taskCustomStatusDraftByTaskId[task.id] ?? ''
    const isMobileDensity = density === 'mobile'
    const canManageCustomStatuses = canEditTaskContent && !isGuestExtraction
    const showSection = customTaskStatusOptions.length > 0 || canManageCustomStatuses

    if (!showSection) return null

    const containerClassName = isMobileDensity
      ? 'mt-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/70'
      : 'mt-2 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2.5 dark:border-slate-700 dark:bg-slate-900/70'
    const titleClassName = isMobileDensity
      ? 'text-sm font-semibold text-slate-600 dark:text-slate-300'
      : 'text-[11px] font-semibold text-slate-600 dark:text-slate-300'
    const hintClassName = isMobileDensity
      ? 'text-xs text-slate-500 dark:text-slate-400'
      : 'text-[10px] text-slate-500 dark:text-slate-400'
    const addRowClassName = isMobileDensity ? 'mt-3 flex gap-2' : 'mt-2 flex gap-1.5'
    const inputClassName = isMobileDensity
      ? 'h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
      : 'h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    const addButtonClassName = isMobileDensity
      ? 'inline-flex h-10 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40'
      : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40'
    const emptyStateClassName = isMobileDensity
      ? 'mt-3 text-xs text-slate-500 dark:text-slate-400'
      : 'mt-2 text-[11px] text-slate-500 dark:text-slate-400'
    const listClassName = isMobileDensity ? 'mt-3 space-y-2' : 'mt-2 space-y-2'
    const editRowClassName = isMobileDensity ? 'flex gap-2' : 'flex gap-1.5'
    const editInputClassName = isMobileDensity
      ? 'h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
      : 'h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    const saveButtonClassName = isMobileDensity
      ? 'inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
      : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
    const cancelButtonClassName = isMobileDensity
      ? 'inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
    const chipTextClassName = isMobileDensity ? 'text-[11px]' : 'text-[10px]'

    return (
      <div className={containerClassName}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={titleClassName}>
              {tx('playbook.task.customStatusesTitle')}
            </p>
            <p className={hintClassName}>
              {tx('playbook.task.customStatusesHint')}
            </p>
          </div>
          {customTaskStatusOptions.length > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {customTaskStatusOptions.length}
            </span>
          )}
        </div>

        {canManageCustomStatuses && (
          <div className={addRowClassName}>
            <input
              type="text"
              value={taskCustomStatusDraft}
              onChange={(event) => handleTaskCustomStatusDraftChange(task.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleCreateTaskCustomStatus(task)
                }
              }}
              placeholder={tx('playbook.task.customStatusPlaceholder')}
              maxLength={MAX_TASK_STATUS_LENGTH}
              disabled={isTaskStatusCatalogMutating}
              className={inputClassName}
            />
            <button
              type="button"
              onClick={() => void handleCreateTaskCustomStatus(task)}
              disabled={isTaskStatusCatalogMutating || normalizeTaskStatusInput(taskCustomStatusDraft).length === 0}
              className={addButtonClassName}
            >
              <Plus size={isMobileDensity ? 13 : 11} />
              {tx('playbook.task.addStatus')}
            </button>
          </div>
        )}

        {customTaskStatusOptions.length === 0 ? (
          <p className={emptyStateClassName}>
            {canManageCustomStatuses
              ? tx('playbook.task.noCustomStatuses')
              : tx('playbook.task.noCustomStatusesReadOnly')}
          </p>
        ) : (
          <div className={listClassName}>
            {customTaskStatusOptions.map((option, index) => {
              const statusValue = String(option.value)
              const statusIdentity = getTaskStatusIdentityKey(statusValue)
              const isEditing =
                editingTaskStatusValue !== null &&
                getTaskStatusIdentityKey(editingTaskStatusValue) === statusIdentity
              const assignedTaskCount = taskCountsByStatus.get(statusIdentity) ?? 0

              return (
                <div
                  key={statusValue}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  {isEditing ? (
                    <div className={editRowClassName}>
                      <input
                        type="text"
                        value={editingTaskStatusDraft}
                        onChange={(event) =>
                          setEditingTaskStatusDraft(
                            event.target.value.slice(0, MAX_TASK_STATUS_LENGTH)
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleSaveTaskStatusRename()
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            handleCancelEditingTaskStatus()
                          }
                        }}
                        maxLength={MAX_TASK_STATUS_LENGTH}
                        disabled={isTaskStatusCatalogMutating}
                        className={editInputClassName}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveTaskStatusRename()}
                        disabled={isTaskStatusCatalogMutating || normalizeTaskStatusInput(editingTaskStatusDraft).length === 0}
                        className={saveButtonClassName}
                        title={tx('playbook.task.saveStatus')}
                      >
                        <Save size={isMobileDensity ? 13 : 11} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditingTaskStatus}
                        disabled={isTaskStatusCatalogMutating}
                        className={cancelButtonClassName}
                        title={tx('playbook.task.cancelStatusEdit')}
                      >
                        <X size={isMobileDensity ? 13 : 11} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 ${chipTextClassName} font-semibold ${option.chipClassName}`}>
                            {option.label}
                          </span>
                          <span className={`${chipTextClassName} text-slate-500 dark:text-slate-400`}>
                            {tx('playbook.task.statusUsedByCount', { count: assignedTaskCount })}
                          </span>
                        </div>
                      </div>

                      {canManageCustomStatuses && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleMoveTaskStatus(statusValue, 'up')}
                            disabled={isTaskStatusCatalogMutating || index === 0}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-label={tx('playbook.task.moveStatusUp')}
                            title={tx('playbook.task.moveStatusUp')}
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveTaskStatus(statusValue, 'down')}
                            disabled={isTaskStatusCatalogMutating || index === customTaskStatusOptions.length - 1}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-label={tx('playbook.task.moveStatusDown')}
                            title={tx('playbook.task.moveStatusDown')}
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditingTaskStatus(statusValue)}
                            disabled={isTaskStatusCatalogMutating}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-label={tx('playbook.task.renameStatus')}
                            title={tx('playbook.task.renameStatus')}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTaskStatus(statusValue)}
                            disabled={isTaskStatusCatalogMutating}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-700 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                            aria-label={tx('playbook.task.deleteStatus')}
                            title={tx('playbook.task.deleteStatus')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }, [
    canEditTaskContent,
    customTaskStatusCatalogValues,
    customTaskStatusOptions,
    editingTaskStatusDraft,
    editingTaskStatusValue,
    handleCancelEditingTaskStatus,
    handleCreateTaskCustomStatus,
    handleDeleteTaskStatus,
    handleMoveTaskStatus,
    handleSaveTaskStatusRename,
    handleStartEditingTaskStatus,
    handleTaskCustomStatusDraftChange,
    isGuestExtraction,
    isTaskStatusCatalogMutating,
    taskCountsByStatus,
    taskCustomStatusDraftByTaskId,
    tx,
  ])

  const renderTaskNumericValueField = useCallback((task: InteractiveTask, density: 'desktop' | 'mobile') => {
    const isMobileDensity = density === 'mobile'
    const isFormulaDriven = Boolean(task.numericFormula)
    const draftValue = isFormulaDriven
      ? formatTaskNumericValueDraft(task.numericValue)
      : taskNumericValueDraftByTaskId[task.id] ?? formatTaskNumericValueDraft(task.manualNumericValue)
    const error = isFormulaDriven ? null : taskNumericValueErrorByTaskId[task.id] ?? null
    const isTaskMutating = taskMutationLoadingId === task.id
    const numericValuePlaceholder = tx('playbook.task.numericValuePlaceholder')
    const numericValueHint = isFormulaDriven
      ? tx('playbook.task.numericFormulaComputedHint')
      : tx('playbook.task.numericValueHint')

    if (!isMobileDensity) {
      const desktopInputWidthCh =
        Math.max(3, draftValue.trim().length || 0, numericValuePlaceholder.length) + 1

      return (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {tx('playbook.task.numericValueLabel')}
            </p>
            {isFormulaDriven && (
              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                {tx('playbook.task.numericFormulaModeComputed')}
              </span>
            )}
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={draftValue}
            onFocus={() => {
              focusTask(task.id)
            }}
            onChange={(event) => handleTaskNumericValueDraftChange(task.id, event.target.value)}
            onBlur={() => {
              void handleSaveTaskNumericValue(task)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSaveTaskNumericValue(task)
              }
            }}
            aria-label={tx('playbook.task.numericValueLabel')}
            placeholder={numericValuePlaceholder}
            disabled={!canEditTaskContent || isTaskMutating || isFormulaDriven}
            title={numericValueHint}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-right font-mono text-xs tabular-nums text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            style={{ width: `${desktopInputWidthCh}ch`, minWidth: '5ch' }}
          />
          {error && (
            <p className="max-w-[10rem] text-right text-[10px] text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>
      )
    }

    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="block">
          <div className="flex items-start justify-between gap-2">
            <div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {tx('playbook.task.numericValueLabel')}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {numericValueHint}
            </p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              isFormulaDriven
                ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300'
                : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}>
              {isFormulaDriven
                ? tx('playbook.task.numericFormulaModeComputed')
                : tx('playbook.task.numericFormulaModeManual')}
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={draftValue}
            onFocus={() => {
              focusTask(task.id)
            }}
            onChange={(event) => handleTaskNumericValueDraftChange(task.id, event.target.value)}
            onBlur={() => {
              void handleSaveTaskNumericValue(task)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSaveTaskNumericValue(task)
              }
            }}
            placeholder={numericValuePlaceholder}
            disabled={!canEditTaskContent || isTaskMutating || isFormulaDriven}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right font-mono text-sm tabular-nums text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
        {error && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    )
  }, [
    canEditTaskContent,
    focusTask,
    handleSaveTaskNumericValue,
    handleTaskNumericValueDraftChange,
    taskMutationLoadingId,
    taskNumericValueDraftByTaskId,
    taskNumericValueErrorByTaskId,
    tx,
  ])

  const renderTaskNumericFormulaSection = useCallback((task: InteractiveTask, density: 'desktop' | 'mobile') => {
    const isMobileDensity = density === 'mobile'
    const draft = getTaskNumericFormulaDraft(task)
    const selectedSourceTaskIds = draft.sourceTaskIds
    const selectedSourceTaskIdsSet = new Set(selectedSourceTaskIds)
    const availableSourceTasks = interactiveTasks.filter((candidate) => candidate.id !== task.id)
    const error = taskNumericFormulaErrorByTaskId[task.id] ?? null
    const isTaskMutating = taskMutationLoadingId === task.id

    return (
      <div className={`rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 ${
        isMobileDensity ? 'px-3 py-2.5' : 'mt-2 px-2.5 py-2'
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {tx('playbook.task.numericFormulaTitle')}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tx('playbook.task.numericFormulaHint')}
            </p>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            task.numericFormula
              ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300'
              : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}>
            {task.numericFormula
              ? tx('playbook.task.numericFormulaModeComputed')
              : tx('playbook.task.numericFormulaModeManual')}
          </span>
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {tx('playbook.task.numericFormulaOperationLabel')}
          </label>
          <select
            value={draft.operation}
            onChange={(event) => {
              handleTaskNumericFormulaOperationChange(
                task,
                event.target.value as TaskNumericFormulaOperation
              )
            }}
            disabled={!canEditTaskContent || isTaskMutating}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {TASK_NUMERIC_FORMULA_OPERATIONS.map((operation) => (
              <option key={operation} value={operation}>
                {getTaskNumericFormulaOperationLabel(operation, tx)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {tx('playbook.task.numericFormulaSourcesLabel')}
          </p>
          {availableSourceTasks.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {tx('playbook.task.numericFormulaNoSources')}
            </p>
          ) : (
            <div className={`mt-1.5 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900 ${
              isMobileDensity ? 'max-h-64' : 'max-h-48'
            }`}>
              {availableSourceTasks.map((sourceTask) => {
                const sourceTaskLabel =
                  typeof sourceTask.itemText === 'string' && sourceTask.itemText.trim()
                    ? sourceTask.itemText.trim()
                    : tx('playbook.subitemWithoutText')

                return (
                  <label
                    key={sourceTask.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-2 transition-colors ${
                      selectedSourceTaskIdsSet.has(sourceTask.id)
                        ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSourceTaskIdsSet.has(sourceTask.id)}
                      onChange={() => handleTaskNumericFormulaSourceToggle(task, sourceTask.id)}
                      disabled={!canEditTaskContent || isTaskMutating}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                          {sourceTask.positionPath?.trim() || `${sourceTask.phaseId}.${sourceTask.itemIndex + 1}`}
                        </span>
                        {selectedSourceTaskIdsSet.has(sourceTask.id) && (
                          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                            {selectedSourceTaskIds.indexOf(sourceTask.id) + 1}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {sourceTaskLabel}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void handleSaveTaskNumericFormula(task)
            }}
            disabled={!canEditTaskContent || isTaskMutating || availableSourceTasks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={12} />
            {tx('playbook.task.numericFormulaSave')}
          </button>
          {task.numericFormula && (
            <button
              type="button"
              onClick={() => {
                void handleClearTaskNumericFormula(task)
              }}
              disabled={!canEditTaskContent || isTaskMutating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={12} />
              {tx('playbook.task.numericFormulaRemove')}
            </button>
          )}
        </div>
      </div>
    )
  }, [
    canEditTaskContent,
    getTaskNumericFormulaDraft,
    handleClearTaskNumericFormula,
    handleSaveTaskNumericFormula,
    handleTaskNumericFormulaOperationChange,
    handleTaskNumericFormulaSourceToggle,
    interactiveTasks,
    taskMutationLoadingId,
    taskNumericFormulaErrorByTaskId,
    tx,
  ])

  const prevMonth = useCallback(() => {
    setCalendarMonth(prev => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() - 1, 1)))
  }, [])

  const nextMonth = useCallback(() => {
    setCalendarMonth(prev => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1)))
  }, [])

  const openSchedulePopover = useCallback((task: InteractiveTask) => {
    setSchedulePopoverTask(task)
    const toInput = (iso: string | null) => iso ? iso.slice(0, 10) : ''
    setSchedulePopoverStart(toInput(task.scheduledStartAt ?? task.dueAt))
    setSchedulePopoverEnd(toInput(task.scheduledEndAt ?? task.dueAt))
  }, [])

  const handleSaveSchedule = async () => {
    if (!schedulePopoverTask || schedulePopoverSaving) return
    setSchedulePopoverSaving(true)
    try {
      const ok = await refreshTaskCollection({
        action: 'update_schedule',
        taskId: schedulePopoverTask.id,
        scheduledStartAt: schedulePopoverStart || null,
        scheduledEndAt: schedulePopoverEnd || null,
      })
      if (ok) setSchedulePopoverTask(null)
    } finally {
      setSchedulePopoverSaving(false)
    }
  }

  const prevGanttWeek = useCallback(() => {
    setGanttRangeStart(prev => { const d = new Date(prev); d.setUTCDate(d.getUTCDate() - 7); return d })
  }, [])

  const nextGanttWeek = useCallback(() => {
    setGanttRangeStart(prev => { const d = new Date(prev); d.setUTCDate(d.getUTCDate() + 7); return d })
  }, [])

  const resetGanttToToday = useCallback(() => {
    setGanttRangeStart(getGanttWindowStart(new Date()))
  }, [])

  const handleSavePlanning = async () => {
    if (!cpmEditTask || cpmEditSaving) return
    setCpmEditSaving(true)
    try {
      const ok = await refreshTaskCollection({
        action: 'update_planning',
        taskId: cpmEditTask.id,
        durationDays: cpmEditDuration,
        predecessorIds: cpmEditPreds,
      })
      if (ok) setCpmEditTask(null)
    } finally {
      setCpmEditSaving(false)
    }
  }

  const handleAddTaskEvent = async (task: InteractiveTask, eventType: InteractiveTaskEventType) => {
    if (!canEditTaskContent) return
    const content = eventDraftContent.trim()
    if (!content) return

    setTaskMutationLoadingId(task.id)
    try {
      const ok = await refreshTaskCollection({
        action: 'add_event',
        taskId: task.id,
        eventType,
        content,
      })

      if (ok) {
        setEventDraftContent('')
      }
    } finally {
      setTaskMutationLoadingId(null)
    }
  }

  const handleOpenTaskFilePicker = (taskId: string) => {
    if (!canEditTaskContent) return
    const node = taskFileInputRefs.current[taskId]
    if (!node) return
    node.click()
  }

  const handleSelectTaskEvidenceMode = useCallback((taskId: string, mode: EvidenceComposerMode) => {
    setTaskAddEvidenceExpandedByTaskId((previous) => ({
      ...previous,
      [taskId]: true,
    }))
    setTaskEvidenceComposerModeByTaskId((previous) => ({
      ...previous,
      [taskId]: mode,
    }))
  }, [])

  const clearPendingTaskFile = useCallback((taskId: string) => {
    setPendingTaskFileByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))
    const node = taskFileInputRefs.current[taskId]
    if (node) node.value = ''
  }, [])

  const handleTaskFileCandidate = useCallback((taskId: string, file: File | null) => {
    if (!canEditTaskContent) return
    if (!file) return

    if (!resolveEvidenceUploadType(file.type || '', file.name)) {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: tx('errors.invalidEvidenceFileType'),
      }))
      clearPendingTaskFile(taskId)
      return
    }

    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))
    setPendingTaskFileByTaskId((previous) => ({
      ...previous,
      [taskId]: file,
    }))
    setTaskEvidenceComposerModeByTaskId((previous) => ({
      ...previous,
      [taskId]: 'file',
    }))
    setTaskAddEvidenceExpandedByTaskId((previous) => ({
      ...previous,
      [taskId]: true,
    }))
  }, [canEditTaskContent, clearPendingTaskFile, tx])

  const handleTaskFileSelected = async (task: InteractiveTask, file: File | null) => {
    if (!canEditTaskContent) return
    if (!file) return
    const extractionId = result.id?.trim()
    if (!extractionId) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    try {
      const formData = new FormData()
      formData.set('file', file)

      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          task.id
        )}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      )
      const payload = (await response.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : tx('errors.uploadEvidence')
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: message,
        }))
        return
      }

      setPendingTaskFileByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('errors.uploadEvidence'),
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
      const node = taskFileInputRefs.current[task.id]
      if (node) node.value = ''
    }
  }

  const handleUploadPendingTaskFile = useCallback(async (task: InteractiveTask) => {
    const pendingFile = pendingTaskFileByTaskId[task.id] ?? null
    if (!pendingFile) return
    await handleTaskFileSelected(task, pendingFile)
  }, [handleTaskFileSelected, pendingTaskFileByTaskId])

  const handleTaskYoutubeDraftChange = (taskId: string, value: string) => {
    setYoutubeAttachmentDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
  }

  const handleAddTaskYoutubeLink = async (task: InteractiveTask) => {
    if (!canEditTaskContent) return
    const extractionId = result.id?.trim()
    if (!extractionId) return

    const youtubeUrl = (youtubeAttachmentDraftByTaskId[task.id] ?? '').trim()
    if (!youtubeUrl) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          task.id
        )}/attachments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeUrl }),
        }
      )
      const payload = (await response.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : tx('errors.saveTaskLink')
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: message,
        }))
        return
      }

      setYoutubeAttachmentDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('errors.saveTaskLink'),
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
    }
  }

  const handleDeleteTaskAttachment = async (
    task: InteractiveTask,
    attachment: InteractiveTaskAttachment
  ) => {
    if (!canEditTaskContent) return
    const extractionId = result.id?.trim()
    if (!extractionId) return

    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(tx('playbook.confirmDeleteEvidence'))
    if (!confirmed) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          task.id
        )}/attachments/${encodeURIComponent(attachment.id)}`,
        {
          method: 'DELETE',
        }
      )
      const payload = (await response.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : tx('errors.deleteEvidence')
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: message,
        }))
        return
      }

      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('errors.deleteEvidence'),
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
    }
  }

  const handleAddTaskNote = async (task: InteractiveTask) => {
    if (!canEditTaskContent) return
    const extractionId = result.id?.trim()
    if (!extractionId) return
    const noteText = (noteDraftByTaskId[task.id] ?? '').trim()
    if (!noteText) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({ ...previous, [task.id]: null }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(task.id)}/attachments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteText }),
        }
      )
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : tx('errors.saveTaskNote')
        setTaskAttachmentErrorByTaskId((previous) => ({ ...previous, [task.id]: message }))
        return
      }
      setNoteDraftByTaskId((previous) => ({ ...previous, [task.id]: '' }))
      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('errors.saveTaskNote'),
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
    }
  }

  const handleCopyAttachmentLink = (attachmentId: string, url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedAttachmentId(attachmentId)
      setTimeout(() => setCopiedAttachmentId((previous) => (previous === attachmentId ? null : previous)), 2000)
    })
  }

  const handleTaskCommentDraftChange = (taskId: string, value: string) => {
    setTaskCommentDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
  }

  const handleTaskReplyDraftChange = (taskId: string, value: string) => {
    setTaskReplyDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
  }

  const handleStartTaskReply = (taskId: string, commentId: string) => {
    const replyThreadKey = `${taskId}:${commentId}`
    setTaskCommunityOpenByTaskId((previous) => ({
      ...previous,
      [taskId]: true,
    }))
    setTaskCommentMenuOpenId(null)
    setTaskReplyParentByTaskId((previous) => ({
      ...previous,
      [taskId]: commentId,
    }))
    setTaskReplyDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: '',
    }))
    setCollapsedReplyThreadsByCommentKey((previous) => ({
      ...previous,
      [replyThreadKey]: false,
    }))
  }

  const handleCancelTaskReply = (taskId: string) => {
    setTaskReplyParentByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))
    setTaskReplyDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: '',
    }))
  }

  const handleToggleTaskCommentReplies = (taskId: string, commentId: string) => {
    const replyThreadKey = `${taskId}:${commentId}`
    setCollapsedReplyThreadsByCommentKey((previous) => ({
      ...previous,
      [replyThreadKey]: !previous[replyThreadKey],
    }))
  }

  const mutateTaskCommunity = async (taskId: string, payload: Record<string, unknown>) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    setTaskCommunityMutationId(taskId)
    setTaskCommunityErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          taskId
        )}/community`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = (await response.json().catch(() => null)) as
        | { comments?: unknown; likeSummary?: unknown; error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : tx('errors.updateTaskCommunity')
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: message,
        }))
        return false
      }

      const comments = Array.isArray(data?.comments) ? (data.comments as InteractiveTaskComment[]) : []
      const likeSummary =
        data?.likeSummary && typeof data.likeSummary === 'object'
          ? (data.likeSummary as InteractiveTaskLikeSummary)
          : {
              taskId,
              extractionId,
              likesCount: 0,
              likedByMe: false,
              sharesCount: 0,
              sharedByMe: false,
              followersCount: 0,
              followingByMe: false,
              viewsCount: 0,
              viewedByMe: false,
            }

      setTaskCommentsByTaskId((previous) => ({
        ...previous,
        [taskId]: comments,
      }))
      setTaskLikeSummaryByTaskId((previous) => ({
        ...previous,
        [taskId]: likeSummary,
      }))
      return true
    } catch {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: tx('errors.updateTaskCommunity'),
      }))
      return false
    } finally {
      setTaskCommunityMutationId((previous) => (previous === taskId ? null : previous))
    }
  }

  const handleAddTaskComment = async (task: InteractiveTask) => {
    const content = (taskCommentDraftByTaskId[task.id] ?? '').trim()
    if (!content) return

    const ok = await mutateTaskCommunity(task.id, {
      action: 'add_comment',
      content,
    })
    if (ok) {
      setTaskCommentDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
    }
  }

  const handleAddTaskReply = async (task: InteractiveTask, parentCommentId: string) => {
    const content = (taskReplyDraftByTaskId[task.id] ?? '').trim()
    if (!content) return

    const parentExists = (taskCommentsByTaskId[task.id] ?? []).some((comment) => comment.id === parentCommentId)
    if (!parentExists) {
      handleCancelTaskReply(task.id)
      return
    }

    const ok = await mutateTaskCommunity(task.id, {
      action: 'add_comment',
      content,
      parentCommentId,
    })
    if (ok) {
      setTaskReplyDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
      setTaskReplyParentByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
    }
  }

  const handleDeleteTaskComment = async (task: InteractiveTask, commentId: string) => {
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(tx('playbook.confirmDeleteComment'))
    if (!confirmed) return

    setTaskCommentMenuOpenId(null)
    const ok = await mutateTaskCommunity(task.id, {
      action: 'delete_comment',
      commentId,
    })
    if (ok && taskReplyParentByTaskId[task.id] === commentId) {
      setTaskReplyParentByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      setTaskReplyDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
    }
  }

  const handleToggleTaskCommentHidden = async (
    task: InteractiveTask,
    commentId: string,
    currentlyHidden: boolean
  ) => {
    const nextHidden = !currentlyHidden
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(
            nextHidden ? tx('playbook.confirmHideComment') : tx('playbook.confirmShowComment')
          )
    if (!confirmed) return

    setTaskCommentMenuOpenId(null)
    const ok = await mutateTaskCommunity(task.id, {
      action: 'toggle_hide_comment',
      commentId,
      hidden: nextHidden,
    })
    if (ok && taskReplyParentByTaskId[task.id] === commentId) {
      setTaskReplyParentByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      setTaskReplyDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
    }
  }

  const handleToggleTaskLike = async (task: InteractiveTask) => {
    await mutateTaskCommunity(task.id, {
      action: 'toggle_like',
    })
  }

  const handleToggleTaskFollow = async (task: InteractiveTask) => {
    if (isGuestExtraction) {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('errors.followSubItemsRequiresAccount'),
      }))
      return
    }

    await mutateTaskCommunity(task.id, {
      action: 'toggle_follow',
    })
  }

  const handleShareTask = async (task: InteractiveTask) => {
    if (typeof window === 'undefined') return

    const extractionId = result.id?.trim()
    if (!extractionId) return

    setTaskCommunityErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    const taskHash = `#task-${task.id}`
    const fallbackShareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${taskHash}`
    let shareUrl = fallbackShareUrl

    if (!isGuestExtraction && canManageVisibility && isShareableVisibility) {
      try {
        const response = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractionId }),
        })
        const payload = (await response.json().catch(() => null)) as
          | { token?: unknown; error?: unknown }
          | null

        if (response.ok) {
          const token = typeof payload?.token === 'string' ? payload.token.trim() : ''
          if (token) {
            shareUrl = `${window.location.origin}/share/${token}${taskHash}`
          }
        } else {
          const message =
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error
              : tx('errors.generateSubItemShareLink')
          setTaskCommunityErrorByTaskId((previous) => ({
            ...previous,
            [task.id]: message,
          }))
        }
      } catch {
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: tx('errors.generateSubItemShareLink'),
        }))
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setTaskShareCopiedByTaskId((previous) => ({
        ...previous,
        [task.id]: true,
      }))
      window.setTimeout(() => {
        setTaskShareCopiedByTaskId((previous) => ({
          ...previous,
          [task.id]: false,
        }))
      }, 1800)
    } catch {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: tx('errors.copySubItemShareLink'),
      }))
      return
    }

    if (!isGuestExtraction) {
      await mutateTaskCommunity(task.id, {
        action: 'record_share',
      })
    }
  }

  const collapseActionsSection = () => {
    setIsActionsExpanded(false)
    setCollapseAfterAsyncAction(false)
    asyncActionLoadingRef.current = false
  }

  const triggerAsyncAction = (action: () => void | Promise<void>) => {
    const maybePromise = action()
    if (maybePromise && typeof (maybePromise as PromiseLike<void>).then === 'function') {
      void Promise.resolve(maybePromise).finally(() => {
        collapseActionsSection()
      })
      return
    }

    setCollapseAfterAsyncAction(true)
    asyncActionLoadingRef.current = false
  }

  const triggerInstantAction = (action: () => void | Promise<void>) => {
    const maybePromise = action()
    if (maybePromise && typeof (maybePromise as PromiseLike<void>).then === 'function') {
      void Promise.resolve(maybePromise).finally(() => {
        collapseActionsSection()
      })
      return
    }

    collapseActionsSection()
  }

  const triggerReextractMode = (mode: ExtractionMode) => {
    setCollapseAfterReextract(true)
    reextractProcessingRef.current = false
    onReExtractMode(mode)
  }

  const handleToggleActions = () => {
    setCollapseAfterAsyncAction(false)
    asyncActionLoadingRef.current = false
    setIsActionsExpanded((previous) => {
      const next = !previous
      if (next) {
        setIsReextractExpanded(false)
        setCollapseAfterReextract(false)
        reextractProcessingRef.current = false
      }
      return next
    })
  }

  const handleToggleReextract = () => {
    setCollapseAfterReextract(false)
    reextractProcessingRef.current = false
    setIsReextractExpanded((previous) => {
      const next = !previous
      if (next) {
        setIsActionsExpanded(false)
        setCollapseAfterAsyncAction(false)
        asyncActionLoadingRef.current = false
      }
      return next
    })
  }

  const handleCopyExtractionId = async () => {
    const extractionId = result.id?.trim()
    if (!extractionId) return

    try {
      await navigator.clipboard.writeText(extractionId)
      setIdCopied(true)
      window.setTimeout(() => setIdCopied(false), 2200)
    } catch {
      setIdCopied(false)
    }
  }

  const handleCopyPlaybookReference = async () => {
    const extractionId = result.id?.trim()
    if (!extractionId) return

    try {
      await navigator.clipboard.writeText(`playbook:${extractionId}`)
      setPlaybookLinkCopied(true)
      window.setTimeout(() => setPlaybookLinkCopied(false), 2200)
    } catch {
      setPlaybookLinkCopied(false)
    }
  }

  const handleToggleShareMenu = () => {
    setIsShareMenuOpen((previous) => !previous)
  }

  const triggerShareMenuAction = (action: () => void | Promise<void>) => {
    return action()
  }

  const renderTextWithPlaybookReferences = (text: unknown) => {
    const safeText = typeof text === 'string' ? text : text == null ? '' : String(text)
    const tokens = parsePlaybookReferenceTokens(safeText)
    if (tokens.length === 0) return safeText

    const parts: Array<string | JSX.Element> = []
    let cursor = 0

    tokens.forEach((token, index) => {
      if (token.start > cursor) {
        parts.push(safeText.slice(cursor, token.start))
      }

      parts.push(
        <span
          key={`playbook-reference-${token.id}-${token.start}-${index}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenPlaybookReference?.(token.id)
          }}
          className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.86em] ${
            onOpenPlaybookReference
              ? 'cursor-pointer border-violet-300 bg-violet-50 text-violet-700 underline decoration-violet-500/70 underline-offset-2 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-200 dark:hover:bg-violet-900/40'
              : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
          title={tx('playbook.openPlaybook', { id: token.id })}
        >
          {token.label}
        </span>
      )

      cursor = token.end
    })

    if (cursor < safeText.length) {
      parts.push(safeText.slice(cursor))
    }

    return parts
  }

  const handleStartStructureEditing = () => {
    if (!canEditStructure) return
    setPhaseDrafts(normalizePlaybookPhases(result.phases))
    setStructureError(null)
    setIsStructureEditing(true)
  }

  const handleCancelStructureEditing = () => {
    setPhaseDrafts(normalizePlaybookPhases(result.phases))
    setStructureError(null)
    setIsStructureEditing(false)
  }

  const handleDraftPhaseTitleChange = (phaseId: number, title: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => (phase.id === phaseId ? { ...phase, title } : phase))
    )
  }

  const handleDraftSubItemChange = (phaseId: number, nodeId: string, value: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        return {
          ...phase,
          items: updateNodeText(phase.items, nodeId, value),
        }
      })
    )
  }

  const handleAddDraftPhase = () => {
    setPhaseDrafts((previous) => {
      const nextId = previous.reduce((max, phase) => Math.max(max, phase.id), 0) + 1
      return [
        ...previous,
        {
          id: nextId,
          title: `${tx('playbook.mainItem')} ${previous.length + 1}`,
          items: [buildNewNode(tx('playbook.newItem'))],
        },
      ]
    })
  }

  const handleDeleteDraftPhase = (phaseId: number) => {
    setPhaseDrafts((previous) => previous.filter((phase) => phase.id !== phaseId))
  }

  const handleAddDraftSubItem = (phaseId: number) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              items: [...phase.items, buildNewNode(tx('playbook.newItem'))],
            }
          : phase
      )
    )
  }

  const handleAddDraftChildSubItem = (phaseId: number, parentNodeId: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        return {
          ...phase,
          items: addChildNode(phase.items, parentNodeId, buildNewNode(tx('playbook.newChildItem'))),
        }
      })
    )
  }

  const handleAddDraftSiblingSubItem = (phaseId: number, siblingNodeId: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        if (findNode(phase.items, siblingNodeId) == null) return phase
        return {
          ...phase,
          items: addSiblingNode(phase.items, siblingNodeId, buildNewNode(tx('playbook.newItem'))),
        }
      })
    )
  }

  const handleDeleteDraftSubItem = (phaseId: number, nodeId: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        const remaining = deleteNode(phase.items, nodeId)
        if (remaining.length === 0) {
          return {
            ...phase,
            items: [buildNewNode(tx('playbook.newItem'))],
          }
        }
        return {
          ...phase,
          items: remaining,
        }
      })
    )
  }

  const handlePhaseDragStart = (e: React.DragEvent, index: number) => {
    dragPhaseRef.current = index
    e.dataTransfer.effectAllowed = 'move'
  }

  const handlePhaseDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverPhaseIndex !== index) setDragOverPhaseIndex(index)
  }

  const handlePhaseDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const fromIndex = dragPhaseRef.current
    dragPhaseRef.current = null
    setDragOverPhaseIndex(null)
    if (fromIndex === null || fromIndex === dropIndex) return
    setPhaseDrafts((prev) => {
      const next = [...prev]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(dropIndex, 0, removed)
      return next
    })
  }

  const handlePhaseDragEnd = () => {
    dragPhaseRef.current = null
    setDragOverPhaseIndex(null)
  }

  const handleSubItemDragStart = (e: React.DragEvent, phaseId: number, index: number) => {
    dragSubItemRef.current = { phaseId, index }
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }

  const handleSubItemDragOver = (e: React.DragEvent, phaseId: number, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (!dragOverSubItem || dragOverSubItem.phaseId !== phaseId || dragOverSubItem.index !== index) {
      setDragOverSubItem({ phaseId, index })
    }
  }

  const handleSubItemDrop = (e: React.DragEvent, phaseId: number, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const from = dragSubItemRef.current
    dragSubItemRef.current = null
    setDragOverSubItem(null)
    if (!from || from.phaseId !== phaseId || from.index === dropIndex) return
    setPhaseDrafts((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase
        const items = [...phase.items]
        const [removed] = items.splice(from.index, 1)
        items.splice(dropIndex, 0, removed)
        return { ...phase, items }
      })
    )
  }

  const handleSubItemDragEnd = () => {
    dragSubItemRef.current = null
    setDragOverSubItem(null)
  }

  const handleSaveStructure = async () => {
    if (!canEditStructure) return
    const normalized = normalizePlaybookPhases(phaseDrafts)
      .map((phase, index) => ({
        id: index + 1,
        title: phase.title.trim(),
        items: phase.items,
      }))
      .filter((phase) => phase.title.length > 0 || phase.items.length > 0)

    if (normalized.length === 0) {
      setStructureError(tx('errors.keepAtLeastOneMainItem'))
      return
    }

    const hasInvalidPhase = normalized.some(
      (phase) => !phase.title || phase.items.length === 0 || countNodes(phase.items) === 0
    )
    if (hasInvalidPhase) {
      setStructureError(tx('errors.mainItemNeedsTitleAndSubitem'))
      return
    }

    setStructureSaving(true)
    setStructureError(null)
    try {
      const ok = await onSavePhases(normalized)
      if (!ok) {
        setStructureError(tx('playbook.saveContentEditFailed'))
        return
      }

      setIsStructureEditing(false)
      setPhaseDrafts(normalized)
      setActiveTaskId(null)
    } finally {
      setStructureSaving(false)
    }
  }

  const handleStartMetaEdit = () => {
    if (!canEditMeta) return
    setMetaTitleDraft(sourceDisplayTitle)
    setMetaObjectiveDraft(result.objective)
    setMetaThumbnailUrl(result.thumbnailUrl ?? null)
    setMetaThumbnailPreview(result.thumbnailUrl ?? null)
    setMetaError(null)
    setMetaThumbError(null)
    setIsMetaEditing(true)
  }

  const handleCancelMetaEdit = () => {
    setIsMetaEditing(false)
    setMetaError(null)
    setMetaThumbError(null)
  }

  const handleMetaThumbSelect = async (file: File) => {
    if (!canEditMeta) return
    setMetaThumbError(null)
    setIsUploadingMetaThumb(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract/thumbnail', { method: 'POST', body: formData })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok) {
        setMetaThumbError(data?.error ?? tx('errors.uploadImage'))
        return
      }
      const url = data?.url ?? null
      setMetaThumbnailUrl(url)
      setMetaThumbnailPreview(url)
    } catch {
      setMetaThumbError(tx('errors.uploadImage'))
    } finally {
      setIsUploadingMetaThumb(false)
    }
  }

  const handleSaveMeta = async () => {
    if (!canEditMeta) return
    setMetaSaving(true)
    const ok = await onSaveMeta({
      title: metaTitleDraft.trim() || tx('playbook.untitled'),
      thumbnailUrl: metaThumbnailUrl,
      objective: metaObjectiveDraft.trim(),
    })
    setMetaSaving(false)
    if (ok) setIsMetaEditing(false)
    else setMetaError(tx('playbook.saveFailedTryAgain'))
  }

  const handleClose = () => {
    if (!onClose || closeStage !== 'idle' || isBookClosed) return
    closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    closeTimersRef.current = []

    setCoverMotion('closing')
    setCloseStage('folding')
    onClose()
  }

  const handleAssignCurrentFolder = (folderId: string | null) => {
    const extractionId = result.id?.trim()
    if (!canManageFolder || !extractionId || !onAssignFolder || isAssigningFolder) return
    setIsAssigningFolder(true)
    void Promise.resolve(onAssignFolder(extractionId, folderId)).finally(() => {
      setIsAssigningFolder(false)
    })
  }

  const handleAddMember = async () => {
    if (!canManageMembers || !onAddMember || memberMutationLoading) return

    const email = memberEmailDraft.trim().toLowerCase()
    if (!email) {
      setMemberError(tx('errors.validEmailRequired'))
      return
    }

    setMemberError(null)
    const ok = await onAddMember({ email, role: memberRoleDraft })
    if (!ok) {
      setMemberError(tx('errors.addMember'))
      return
    }

    setMemberEmailDraft('')
  }

  const handleRemoveMember = async (memberUserId: string) => {
    if (!canManageMembers || !onRemoveMember || memberMutationLoading) return
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(tx('playbook.confirmRemoveCircleMember'))
    if (!confirmed) return

    setMemberError(null)
    const ok = await onRemoveMember(memberUserId)
    if (!ok) {
      setMemberError(tx('errors.removeMember'))
    }
  }

  const renderTaskCommentThread = (input: {
    task: InteractiveTask
    comments: InteractiveTaskComment[]
    isCommunityMutating: boolean
    replyParentCommentId: string | null
    replyDraft: string
    compact: boolean
  }) => {
    const roots = buildTaskCommentTree(input.comments)

    const renderNodes = (nodes: TaskCommentNode[], depth: number): JSX.Element => (
      <ul className={depth === 0 ? (input.compact ? 'space-y-3' : 'mt-3 space-y-2') : 'mt-2 space-y-2'}>
        {nodes.map((comment) => {
          const isReplyTarget = input.replyParentCommentId === comment.id
          const commentMenuKey = `${input.task.id}:${comment.id}`
          const isCommentMenuOpen = taskCommentMenuOpenId === commentMenuKey
          const replyThreadKey = `${input.task.id}:${comment.id}`
          const replyCount = comment.replies.length
          const hasReplies = replyCount > 0
          const isRepliesCollapsed =
            hasReplies && collapsedReplyThreadsByCommentKey[replyThreadKey] === true
          const repliesLabel = tx('playbook.replyCount', { count: replyCount })
          const repliesContainerId = `task-comment-replies-${input.compact ? 'compact' : 'full'}-${input.task.id}-${comment.id}`
          const canHideComment = isOwnerAccess && !isGuestExtraction
          const canDeleteComment =
            isGuestExtraction || (viewerUserId !== null && viewerUserId === comment.userId)
          const canOpenCommentMenu = canDeleteComment || canHideComment
          const isHiddenComment = comment.isHidden === true
          const displayContent =
            !isOwnerAccess && isHiddenComment
              ? tx('playbook.commentHiddenByOwner')
              : comment.content
          return (
            <li key={comment.id} style={depth > 0 ? { marginLeft: `${Math.min(depth, 5) * 14}px` } : undefined}>
              <div
                className={`rounded-lg border bg-white p-2 dark:bg-slate-900 ${
                  isHiddenComment
                    ? 'border-amber-300/80 bg-amber-50/70 dark:border-amber-800/70 dark:bg-amber-950/20'
                    : depth > 0
                    ? 'border-indigo-200/80 dark:border-indigo-900/60'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare
                    size={input.compact ? 14 : 13}
                    className={`mt-0.5 flex-shrink-0 ${
                      isHiddenComment
                        ? 'text-amber-500 dark:text-amber-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {comment.userName?.trim() || comment.userEmail?.trim() || 'Usuario'}
                          </p>
                          {isOwnerAccess && (
                            <span
                              className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                                isHiddenComment
                                  ? 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300'
                              }`}
                            >
                              {isHiddenComment ? 'Oculto' : 'Visible'}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{displayContent}</p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          {formatTaskEventDate(
                            comment.createdAt,
                            localeTag,
                            tx('playbook.unknownDate')
                          )}
                        </p>
                      </div>
                      {canOpenCommentMenu && (
                        <div className="relative flex-shrink-0" data-task-comment-menu-root="true">
                          <button
                            type="button"
                            onClick={() =>
                              setTaskCommentMenuOpenId((previous) =>
                                previous === commentMenuKey ? null : commentMenuKey
                              )
                            }
                            disabled={input.isCommunityMutating}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            aria-label={tx('playbook.commentOptions')}
                          >
                            <MoreHorizontal size={13} />
                          </button>
                          {isCommentMenuOpen && (
                            <div className="absolute right-0 top-full z-20 mt-1 min-w-[132px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteTaskComment(input.task, comment.id)}
                                  disabled={input.isCommunityMutating}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                >
                                  <Trash2 size={11} />
                                  {tx('common.delete')}
                                </button>
                              )}
                              {canHideComment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleToggleTaskCommentHidden(
                                      input.task,
                                      comment.id,
                                      comment.isHidden
                                    )
                                  }
                                  disabled={input.isCommunityMutating}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300 dark:hover:bg-amber-900/30"
                                >
                                  {comment.isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                                  {comment.isHidden ? tx('common.show') : tx('common.hide')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartTaskReply(input.task.id, comment.id)}
                        disabled={input.isCommunityMutating}
                        className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isReplyTarget
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isReplyTarget ? tx('playbook.replying') : tx('playbook.reply')}
                      </button>
                      {hasReplies && (
                        <button
                          type="button"
                          onClick={() => handleToggleTaskCommentReplies(input.task.id, comment.id)}
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-expanded={!isRepliesCollapsed}
                          aria-controls={repliesContainerId}
                        >
                          {isRepliesCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                          {isRepliesCollapsed
                            ? tx('playbook.viewReplies', { label: repliesLabel })
                            : tx('playbook.hideReplies', { label: repliesLabel })}
                        </button>
                      )}
                    </div>

                    {isReplyTarget && (
                      <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/70 p-2 dark:border-indigo-800 dark:bg-indigo-900/20">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={input.replyDraft}
                            autoFocus
                            onChange={(event) =>
                              handleTaskReplyDraftChange(input.task.id, event.target.value)
                            }
                            placeholder="Escribe tu respuesta..."
                            disabled={input.isCommunityMutating}
                            className={`min-w-0 flex-1 rounded-lg border border-indigo-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60 ${
                              input.compact ? 'h-10' : 'h-9'
                            }`}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleAddTaskReply(input.task, comment.id)}
                              disabled={input.isCommunityMutating || input.replyDraft.trim().length === 0}
                              className={`inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40 ${
                                input.compact ? 'h-10' : 'h-9'
                              }`}
                            >
                              Responder
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelTaskReply(input.task.id)}
                              disabled={input.isCommunityMutating}
                              className={`inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${
                                input.compact ? 'h-10' : 'h-9'
                              }`}
                            >
                              {tx('common.cancel')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {hasReplies && !isRepliesCollapsed && (
                <div id={repliesContainerId}>
                  {renderNodes(comment.replies, depth + 1)}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )

    return renderNodes(roots, 0)
  }

  function closeTaskPanels(taskId: string) {
    setTaskOpenSectionByTaskId((prev) => ({
      ...prev,
      [taskId]: null,
    }))
    setTaskEvidenceOpenByTaskId((prev) => ({
      ...prev,
      [taskId]: false,
    }))
    setTaskCommunityOpenByTaskId((prev) => ({
      ...prev,
      [taskId]: false,
    }))
  }

  function focusTask(taskId: string) {
    if (selectedTaskId && selectedTaskId !== taskId) {
      closeTaskPanels(selectedTaskId)
    }
    setSelectedTaskId(taskId)
    setActiveTaskId(taskId)
  }

  function setExclusiveTaskPanel(taskId: string, panel: TaskDetailTab | null) {
    if (panel === null) {
      closeTaskPanels(taskId)
      return
    }

    setTaskOpenSectionByTaskId((prev) => ({
      ...prev,
      [taskId]: panel === 'gestion' || panel === 'actividad' ? panel : null,
    }))
    setTaskEvidenceOpenByTaskId((prev) => ({
      ...prev,
      [taskId]: panel === 'evidencias',
    }))
    setTaskCommunityOpenByTaskId((prev) => ({
      ...prev,
      [taskId]: panel === 'comunidad',
    }))
  }

  function openTaskDetailSheet(taskId: string, tab: TaskDetailTab) {
    focusTask(taskId)
    setMobileSheetTaskId(taskId)
    setMobileSheetTab(tab)
  }

  const isMobileTaskViewport = () => typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div
      ref={panelRef}
      className={`animate-fade-slide relative${isFullscreen ? ' overflow-y-auto h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8' : ''}`}
      style={{
        transition: 'transform 0.55s ease',
        transform:
          closeStage === 'idle'
            ? 'translateY(0) scale(1)'
            : closeStage === 'folding'
              ? 'translateY(0) scale(0.998)'
              : 'translateY(0) scale(0.995)',
        pointerEvents: closeStage === 'idle' && !isPageTurning ? undefined : 'none',
      }}
    >
      <div
        className={`paper-playbook bg-white rounded-sm shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 dark:shadow-none ${
          shouldHideBookContent
            ? 'paper-playbook-closed min-h-screen min-h-[100dvh]'
            : ''
        }`}
        style={{
          transition: 'transform 0.55s ease',
          transform:
            closeStage === 'idle'
              ? 'perspective(1400px) rotateX(0deg)'
              : closeStage === 'folding'
                ? 'perspective(1400px) rotateX(6deg)'
                : 'perspective(1400px) rotateX(0deg)',
        }}
      >
        <span aria-hidden="true" className="paper-playbook-fold" />
        <div
          className={`border-b border-slate-200/80 bg-transparent px-0 pt-5 pb-6 transition-all duration-300 dark:border-slate-800 ${
            shouldHideBookContent
              ? 'max-h-0 -translate-y-2 overflow-hidden opacity-0 py-0'
              : 'max-h-80 translate-y-0 opacity-100'
          }`}
          style={{ marginInline: '4.5%' }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              <Clock size={14} /> {tx('playbook.savedTimeLabel')}: {result.metadata.savedTime}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
              <Brain size={14} /> {tx('playbook.difficultyLabel')}: {result.metadata.difficulty}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300">
              <Zap size={14} /> {tx('playbook.modeLabel')}: {getExtractionModeLabel(resolvedMode)}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
            <div className="flex min-w-0 flex-col items-start gap-2">
              {((result.orderNumber && result.orderNumber > 0) || result.id) && (
                <div className="flex flex-col items-start gap-2">
                  {result.orderNumber && result.orderNumber > 0 && (
                    <p className="paper-playbook-ink-note paper-playbook-ink-note-left">
                      #{result.orderNumber}
                    </p>
                  )}
                  {result.id && (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsIdModalOpen(true)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-mono text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        title={result.id}
                      >
                        <span className="max-w-[180px] truncate">ID: {result.id}</span>
                        <Copy size={11} className="shrink-0 opacity-60" />
                      </button>
                      <span
                        title={`${tx('playbook.folder.label')}: ${coverFolderLabel}`}
                        className="inline-flex min-w-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-200"
                      >
                        <Folder size={12} />
                        <span className="max-w-[220px] truncate">{coverFolderLabel}</span>
                      </span>
                      {isIdModalOpen && typeof window !== 'undefined' && createPortal(
                        <div
                          role="dialog"
                          aria-modal="true"
                          aria-label={tx('playbook.uniqueId')}
                          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
                          onClick={() => setIsIdModalOpen(false)}
                        >
                          <div
                            onClick={(event) => event.stopPropagation()}
                            className="mx-4 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                          >
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              {tx('playbook.uniqueId')}
                            </p>
                            <p className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {result.id}
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleCopyExtractionId}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                <Copy size={13} />
                                {idCopied ? tx('common.copied') : tx('common.copy')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsIdModalOpen(false)}
                                className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              >
                                {tx('common.close')}
                              </button>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  )}
                </div>
              )}
              {result.id && (onAddTag || resultTags.length > 0) && (
                <div className="flex max-w-full flex-wrap items-center justify-start gap-1.5">
                  {resultTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                      #{tag.name}
                      {onRemoveTag && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveTag(tag.id)}
                          disabled={tagLoading}
                          aria-label={tx('playbook.tags.removeAria', { tag: tag.name })}
                          className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
                        >
                          <X size={9} />
                        </button>
                      )}
                    </span>
                  ))}
                  {onAddTag && (
                    <div className="relative">
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={tagInput}
                        onChange={(e) => { setTagInput(e.target.value); setShowTagDropdown(true) }}
                        onKeyDown={(e) => void handleTagKeyDown(e)}
                        onFocus={() => setShowTagDropdown(true)}
                        onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
                        placeholder="+ tag"
                        disabled={tagLoading}
                        className="h-6 w-20 rounded-full border border-dashed border-slate-300 bg-transparent px-2 text-[11px] text-slate-500 outline-none placeholder:text-slate-300 focus:border-indigo-400 focus:text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-400 dark:focus:border-indigo-500"
                      />
                      {showTagDropdown && filteredTagSuggestions.length > 0 && (
                        <div className="absolute left-0 top-full z-30 mt-1 min-w-[140px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          {filteredTagSuggestions.slice(0, 6).map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); void handlePickSuggestion(tag) }}
                              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <span className="inline-block h-2 w-2 rounded-full bg-indigo-400" />
                              #{tag.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {formattedPlaybookDateTime && (
                <p className="paper-playbook-ink-note paper-playbook-ink-note-right">
                  {formattedPlaybookDateTime}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {result.id && onStarResult && (
                  <button
                    type="button"
                    onClick={() => onStarResult(!result.isStarred)}
                    aria-label={
                      result.isStarred
                        ? tx('playbook.removeFromFavorites')
                        : tx('playbook.addToFavorites')
                    }
                    title={
                      result.isStarred
                        ? tx('playbook.removeFromFavorites')
                        : tx('playbook.addToFavorites')
                    }
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                      result.isStarred
                        ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-amber-400'
                    }`}
                  >
                    <Star size={13} fill={result.isStarred ? 'currentColor' : 'none'} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsIntegrationsModalOpen(false)
                    setIsActionsModalOpen(true)
                  }}
                  aria-label={tx('playbook.actions')}
                  title={tx('playbook.actions')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-300 dark:hover:bg-violet-900/40"
                >
                  <FileText size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsModalOpen(false)
                    setIsIntegrationsModalOpen(true)
                  }}
                  aria-label={tx('playbook.integrations')}
                  title={tx('playbook.integrations')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  <Zap size={13} />
                </button>
                {result.id && onAssignFolder && canManageFolder && (
                  <label
                    aria-label={tx('playbook.folder.assign')}
                    title={`${tx('playbook.folder.assign')}: ${coverFolderLabel}`}
                    className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition-colors hover:border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-300 dark:hover:bg-amber-900/40 ${
                      isAssigningFolder ? 'opacity-60' : ''
                    }`}
                  >
                    <Folder size={13} />
                    <select
                      value={result.folderId ?? ''}
                      disabled={isAssigningFolder}
                      onChange={(event) => handleAssignCurrentFolder(event.target.value || null)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label={tx('playbook.folder.assign')}
                    >
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {result.id && !isMetaEditing && canEditMeta && (
                  <button
                    type="button"
                    onClick={handleStartMetaEdit}
                    aria-label={tx('common.edit')}
                    title={tx('common.edit')}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <Pencil size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  aria-label={
                    isFullscreen ? tx('playbook.exitFullscreen') : tx('playbook.enterFullscreen')
                  }
                  title={isFullscreen ? tx('playbook.exitFullscreen') : tx('playbook.enterFullscreen')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                {onClose && isBookOpen && (
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label={tx('playbook.close')}
                    title={tx('playbook.close')}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="relative mx-auto mt-10 mb-3 flex w-full max-w-3xl items-start justify-center gap-2">
            <p className="text-center text-xl font-bold leading-tight text-slate-700 dark:text-slate-100">
              {sourceDisplayTitle}
            </p>
            {result.id && (
              <button
                ref={shareMenuButtonRef}
                type="button"
                onPointerDownCapture={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  handleToggleShareMenu()
                }}
                aria-expanded={isShareMenuOpen}
                aria-label={tx('playbook.actionsAndExport')}
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <MoreHorizontal size={15} />
              </button>
            )}
            {result.id && isShareMenuOpen && typeof window !== 'undefined' && createPortal(
              <div
                role="dialog"
                aria-modal="true"
                aria-label={tx('playbook.actionsAndExport')}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
                onClick={() => setIsShareMenuOpen(false)}
              >
                <div
                  ref={shareMenuPanelRef}
                  onClick={(event) => event.stopPropagation()}
                  className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex flex-col gap-3">
                  {canManageVisibility ? (
                    <div className="inline-flex min-h-8 flex-wrap items-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                      <button
                        type="button"
                        onClick={() => {
                          void triggerShareMenuAction(() => onShareVisibilityChange('private'))
                        }}
                        disabled={shareVisibilityLoading}
                        className={`min-h-8 px-3 text-[11px] font-semibold transition-colors ${
                          shareVisibility === 'private'
                            ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        aria-label={tx('playbook.visibility.markPrivateAria')}
                      >
                        {tx('playbook.visibility.private')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void triggerShareMenuAction(() => onShareVisibilityChange('circle'))
                        }}
                        disabled={shareVisibilityLoading}
                        className={`min-h-8 px-3 text-[11px] font-semibold transition-colors ${
                          shareVisibility === 'circle'
                            ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        aria-label={tx('playbook.visibility.markCircleAria')}
                      >
                        {tx('playbook.visibility.circle')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void triggerShareMenuAction(() => onShareVisibilityChange('unlisted'))
                        }}
                        disabled={shareVisibilityLoading}
                        className={`min-h-8 px-3 text-[11px] font-semibold transition-colors ${
                          shareVisibility === 'unlisted'
                            ? 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        aria-label={tx('playbook.visibility.markLinkAria')}
                      >
                        {tx('playbook.visibility.link')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void triggerShareMenuAction(() => onShareVisibilityChange('public'))
                        }}
                        disabled={shareVisibilityLoading}
                        className={`min-h-8 px-3 text-[11px] font-semibold transition-colors ${
                          shareVisibility === 'public'
                            ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        aria-label={tx('playbook.visibility.markPublicAria')}
                      >
                        {tx('playbook.visibility.public')}
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex self-start rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-700 dark:bg-sky-900/25 dark:text-sky-300">
                      {tx('playbook.visibility.label')}: {getShareVisibilityLabel(shareVisibility)}
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void triggerShareMenuAction(handleCopyPlaybookReference)
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-200 dark:hover:bg-violet-900/40"
                      aria-label={tx('playbook.copyInternalLinkAria')}
                    >
                      <Link2 size={12} />
                      {playbookLinkCopied ? tx('playbook.linkCopied') : tx('playbook.internalLink')}
                    </button>
                    {canManageVisibility && (
                      <button
                        type="button"
                        onClick={() => {
                          void triggerShareMenuAction(onCopyShareLink)
                        }}
                        disabled={shareLoading || !isShareableVisibility}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-wait disabled:opacity-70 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-300 dark:hover:bg-violet-900/40"
                        aria-label={tx('playbook.shareExtractionAria')}
                      >
                        <Share2 size={12} />
                        {shareLoading
                          ? tx('playbook.sharing')
                          : !isShareableVisibility
                            ? tx('playbook.visibility.publicOrLink')
                            : shareCopied
                              ? tx('common.shared')
                              : tx('common.share')}
                      </button>
                    )}
                  </div>

                  {canManageMembers && shareVisibility === 'circle' && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-800 dark:bg-sky-900/20">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                        {tx('playbook.circleMembers')}
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="email"
                          value={memberEmailDraft}
                          onChange={(event) => setMemberEmailDraft(event.target.value)}
                          placeholder={tx('playbook.emailPlaceholder')}
                          disabled={memberMutationLoading}
                          className="h-8 min-w-0 flex-1 rounded-md border border-sky-200 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200"
                        />
                        <select
                          value={memberRoleDraft}
                          onChange={(event) =>
                            setMemberRoleDraft(event.target.value === 'editor' ? 'editor' : 'viewer')
                          }
                          disabled={memberMutationLoading}
                          className="h-8 rounded-md border border-sky-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleAddMember()}
                          disabled={memberMutationLoading || !memberEmailDraft.trim()}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                        >
                          <Plus size={12} />
                          {tx('common.add')}
                        </button>
                      </div>
                      {memberError && (
                        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                          {memberError}
                        </p>
                      )}
                      {membersLoading ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {tx('common.loading')}
                        </p>
                      ) : members.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {tx('playbook.noCircleMembers')}
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {members.map((member) => (
                            <li
                              key={member.userId}
                              className="flex items-center justify-between gap-2 rounded-md border border-sky-100 bg-white px-2 py-1.5 text-xs dark:border-sky-900 dark:bg-slate-900"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-700 dark:text-slate-200">
                                  {member.userName?.trim() || member.userEmail}
                                </p>
                                <p className="truncate text-slate-500 dark:text-slate-400">
                                  {member.userEmail} · {member.role}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleRemoveMember(member.userId)}
                                disabled={memberMutationLoading}
                                className="inline-flex h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
                              >
                                {tx('common.remove')}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
        <div
          className="p-6 border-b border-slate-100 bg-transparent dark:bg-transparent dark:border-slate-800"
          style={{ marginInline: '4.5%' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {sourceSectionLabel}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsSourceSectionHidden((previous) => !previous)}
              aria-expanded={!isSourceSectionHidden}
              aria-label={
                isSourceSectionHidden
                  ? tx('playbook.source.showPanel')
                  : tx('playbook.source.hidePanel')
              }
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {isSourceSectionHidden ? <Eye size={12} /> : <EyeOff size={12} />}
              {isSourceSectionHidden
                ? tx('playbook.source.showPanel')
                : tx('playbook.source.hidePanel')}
            </button>
          </div>

          {!isSourceSectionHidden && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
              {/* Thumbnail — edit or display */}
              {isMetaEditing ? (
                <div className="flex flex-col gap-2 w-full md:w-56 shrink-0">
                  <div className="relative h-32 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {metaThumbnailPreview ? (
                      <Image
                        src={metaThumbnailPreview}
                        alt={tx('playbook.thumbnailAlt')}
                        fill
                        sizes="224px"
                        className="object-cover"
                      />
                    ) : (
                      <ImageIcon size={28} className="text-slate-400 dark:text-slate-600" />
                    )}
                    {isUploadingMetaThumb && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <Loader2 size={24} className="animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  {metaCloudinaryAvailable === true && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => metaThumbInputRef.current?.click()}
                        disabled={isUploadingMetaThumb}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Upload size={11} />{' '}
                        {metaThumbnailPreview ? tx('playbook.change') : tx('playbook.upload')}
                      </button>
                      {metaThumbnailPreview && (
                        <button
                          type="button"
                          onClick={() => { setMetaThumbnailUrl(null); setMetaThumbnailPreview(null) }}
                          disabled={isUploadingMetaThumb}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                  <input
                    ref={metaThumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleMetaThumbSelect(file)
                      e.target.value = ''
                    }}
                  />
                  {metaThumbError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{metaThumbError}</p>
                  )}
                </div>
              ) : result.thumbnailUrl ? (
                <div className="relative h-32 w-full md:w-56">
                  <Image
                    src={result.thumbnailUrl}
                    alt={result.videoTitle ?? tx('playbook.videoThumbnailAlt')}
                    fill
                    sizes="(min-width: 768px) 224px, 100vw"
                    className="rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                </div>
              ) : (
                <div className="h-32 w-full rounded-xl bg-slate-100 border border-slate-200 md:w-56 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-600">
                  {resolvedSourceType === 'youtube' && <Play size={32} />}
                  {resolvedSourceType === 'web_url' && <Globe size={32} />}
                  {(resolvedSourceType === 'pdf' || resolvedSourceType === 'docx') && <FileText size={32} />}
                  {resolvedSourceType === 'text' && <AlignLeft size={32} />}
                  {resolvedSourceType === 'manual' && <PenLine size={32} />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {isMetaEditing && (
                  <input
                    type="text"
                    value={metaTitleDraft}
                    onChange={(e) => setMetaTitleDraft(e.target.value)}
                    maxLength={300}
                    placeholder={tx('playbook.titlePlaceholder')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                )}
                {sourceUrl && /^https?:\/\//i.test(sourceUrl) ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`break-words text-xs text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 ${isMetaEditing ? 'mt-2 block' : 'mt-0 block'}`}
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    {sourceUrl}
                  </a>
                ) : sourceUrl ? (
                  <p
                    className={`break-words text-xs text-slate-500 dark:text-slate-400 ${isMetaEditing ? 'mt-2' : 'mt-0'}`}
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    {sourceUrl}
                  </p>
                ) : null}
                {/* ── Source Actions ─────────────────────────────────────────────── */}
                {!isMetaEditing && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {/* YouTube: play/hide embed */}
                    {resolvedSourceType === 'youtube' && result.videoId && (
                      <button
                        type="button"
                        onClick={() => setShowYoutubeEmbed((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                        aria-label={showYoutubeEmbed ? tx('playbook.source.hideEmbed') : tx('playbook.source.playVideo')}
                      >
                        {showYoutubeEmbed ? <X size={11} /> : <Play size={11} className="fill-current" />}
                        {showYoutubeEmbed ? tx('playbook.source.hideEmbed') : tx('playbook.source.playVideo')}
                      </button>
                    )}
                    {/* YouTube: open on youtube.com */}
                    {resolvedSourceType === 'youtube' && sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        aria-label={tx('playbook.source.openYoutube')}
                      >
                        <ExternalLink size={11} />
                        {tx('playbook.source.openYoutube')}
                      </a>
                    )}
                    {/* Web URL: open in new tab + copy link */}
                    {resolvedSourceType === 'web_url' && sourceUrl && (
                      <>
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                          aria-label={tx('playbook.source.openInNewTab')}
                        >
                          <ExternalLink size={11} />
                          {tx('playbook.source.openInNewTab')}
                        </a>
                        <button
                          type="button"
                          onClick={handleCopySourceLink}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          aria-label={tx('playbook.source.copyLink')}
                        >
                          {sourceLinkCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          {sourceLinkCopied ? tx('playbook.source.copied') : tx('playbook.source.copyLink')}
                        </button>
                      </>
                    )}
                    {/* PDF/DOCX: download original file */}
                    {(resolvedSourceType === 'pdf' || resolvedSourceType === 'docx') && result.sourceFileUrl && (
                      <a
                        href={result.sourceFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={result.sourceFileName ?? undefined}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-300 dark:hover:bg-amber-900/40"
                        aria-label={tx('playbook.source.download')}
                      >
                        <Download size={11} />
                        {tx('playbook.source.download')}
                        {result.sourceFileName && (
                          <span className="max-w-[120px] truncate opacity-70">
                            {result.sourceFileName}
                          </span>
                        )}
                      </a>
                    )}
                    {/* View full text / copy / download TXT */}
                    {hasSourceText && result.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleFetchSourceText()}
                          disabled={sourceTextLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60 dark:border-violet-800 dark:bg-violet-900/25 dark:text-violet-300 dark:hover:bg-violet-900/40"
                          aria-label={tx('playbook.source.viewText')}
                        >
                          {sourceTextLoading ? <Loader2 size={11} className="animate-spin" /> : <AlignLeft size={11} />}
                          {tx('playbook.source.viewText')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDirectCopySourceText()}
                          disabled={sourceDirectCopyLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          aria-label={tx('playbook.source.copyText')}
                        >
                          {sourceDirectCopyLoading ? <Loader2 size={11} className="animate-spin" /> : sourceTextCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          {sourceTextCopied ? tx('playbook.source.copied') : tx('playbook.source.copyText')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDirectDownloadSourceText()}
                          disabled={sourceDirectDownloadLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          aria-label={tx('playbook.source.downloadTxt')}
                        >
                          {sourceDirectDownloadLoading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                          {tx('playbook.source.downloadTxt')}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* ── YouTube inline embed ──────────────────────────────────────── */}
                {showYoutubeEmbed && result.videoId && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-black dark:border-slate-700">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 h-full w-full"
                        src={`https://www.youtube.com/embed/${result.videoId}?autoplay=1`}
                        title={result.videoTitle ?? 'YouTube video'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

              </div>

              </div>

              <div className="w-full lg:w-[22rem] lg:shrink-0">
                <div ref={rightControlsRef} className="flex flex-col gap-3">
                {isActionsModalOpen && typeof window !== 'undefined' && createPortal(
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={tx('playbook.actions')}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
                    onClick={() => setIsActionsModalOpen(false)}
                  >
                    <div
                      onClick={(event) => event.stopPropagation()}
                      className="mx-4 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {tx('playbook.actions')}
                        </p>
                        <button type="button" onClick={() => setIsActionsModalOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                          <X size={15} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { void triggerAsyncAction(onDownloadPdf); setIsActionsModalOpen(false) }} disabled={isExportingPdf} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                          <Download size={14} />
                          {isExportingPdf ? tx('common.generating') : tx('playbook.savePdf')}
                        </button>
                        <button onClick={() => { void triggerAsyncAction(onCopyShareLink); setIsActionsModalOpen(false) }} disabled={!canManageVisibility || !result.id || shareLoading || !isShareableVisibility} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                          <Share2 size={14} />
                          {shareLoading ? tx('common.generating') : !isShareableVisibility ? tx('playbook.visibility.publicOrLink') : shareCopied ? tx('common.copied') : tx('common.share')}
                        </button>
                        <button onClick={() => { void triggerInstantAction(onCopyMarkdown); setIsActionsModalOpen(false) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                          <Copy size={14} />
                          {tx('playbook.copyMarkdown')}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {isIntegrationsModalOpen && typeof window !== 'undefined' && createPortal(
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={tx('playbook.integrations')}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
                    onClick={() => setIsIntegrationsModalOpen(false)}
                  >
                    <div
                      onClick={(event) => event.stopPropagation()}
                      className="mx-4 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {tx('playbook.integrations')}
                        </p>
                        <button type="button" onClick={() => setIsIntegrationsModalOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                          <X size={15} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {notionConnected ? (
                          <button onClick={() => { void triggerAsyncAction(onExportToNotion); setIsIntegrationsModalOpen(false) }} disabled={!result.id || notionExportLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:bg-slate-400"><Zap size={14} />{notionExportLoading ? tx('playbook.exportingToNotion') : tx('playbook.exportToNotion')}</button>
                        ) : (
                          <button onClick={() => { void triggerAsyncAction(onConnectNotion); setIsIntegrationsModalOpen(false) }} disabled={notionLoading || !notionConfigured} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400 dark:bg-slate-700"><Zap size={14} />{notionLoading ? 'Conectando...' : notionConfigured ? tx('playbook.connectNotion') : 'No configurado'}</button>
                        )}
                        {trelloConnected ? (
                          <button onClick={() => { void triggerAsyncAction(onExportToTrello); setIsIntegrationsModalOpen(false) }} disabled={!result.id || trelloExportLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-wait disabled:bg-slate-400"><Zap size={14} />{trelloExportLoading ? tx('playbook.exportingToTrello') : tx('playbook.exportToTrello')}</button>
                        ) : (
                          <button onClick={() => { void triggerAsyncAction(onConnectTrello); setIsIntegrationsModalOpen(false) }} disabled={trelloLoading || !trelloConfigured} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400 dark:bg-slate-700"><Zap size={14} />{trelloLoading ? 'Conectando...' : trelloConfigured ? tx('playbook.connectTrello') : 'No configurado'}</button>
                        )}
                        {todoistConnected ? (
                          <button onClick={() => { void triggerAsyncAction(onExportToTodoist); setIsIntegrationsModalOpen(false) }} disabled={!result.id || todoistExportLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:bg-slate-400"><Zap size={14} />{todoistExportLoading ? tx('playbook.exportingToTodoist') : tx('playbook.exportToTodoist')}</button>
                        ) : (
                          <button onClick={() => { void triggerAsyncAction(onConnectTodoist); setIsIntegrationsModalOpen(false) }} disabled={todoistLoading || !todoistConfigured} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400 dark:bg-slate-700"><Zap size={14} />{todoistLoading ? 'Conectando...' : todoistConfigured ? tx('playbook.connectTodoist') : 'No configurado'}</button>
                        )}
                        {googleDocsConnected ? (
                          <button onClick={() => { void triggerAsyncAction(onExportToGoogleDocs); setIsIntegrationsModalOpen(false) }} disabled={!result.id || googleDocsExportLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:bg-slate-400"><Zap size={14} />{googleDocsExportLoading ? tx('playbook.exportingToGoogleDocs') : tx('playbook.exportToGoogleDocs')}</button>
                        ) : (
                          <button onClick={() => { void triggerAsyncAction(onConnectGoogleDocs); setIsIntegrationsModalOpen(false) }} disabled={googleDocsLoading || !googleDocsConfigured} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400 dark:bg-slate-700"><Zap size={14} />{googleDocsLoading ? 'Conectando...' : googleDocsConfigured ? tx('playbook.connectGoogleDocs') : 'No configurado'}</button>
                        )}
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {sourceUrl && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                    <button
                      type="button"
                      onClick={handleToggleReextract}
                      aria-expanded={isReextractExpanded}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-indigo-100/70 dark:hover:bg-indigo-900/20"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                          {tx('playbook.reExtractInAnotherMode')}
                        </p>
                        <p className="mt-0.5 text-[11px] text-indigo-500/90 dark:text-indigo-300/80">
                          {isReextractExpanded
                            ? tx('playbook.selectModeToGenerate')
                            : tx('playbook.clickToExpandOptions')}
                        </p>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-indigo-500 transition-transform duration-500 ease-out dark:text-indigo-300 ${
                          isReextractExpanded ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    </button>

                    <div
                      aria-hidden={!isReextractExpanded}
                      className={`grid transition-[grid-template-rows,opacity,margin-top] duration-700 ease-out ${
                        isReextractExpanded
                          ? 'visible mt-3 grid-rows-[1fr] opacity-100'
                          : 'invisible mt-0 grid-rows-[0fr] opacity-0 pointer-events-none'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div
                          className={`transition-transform duration-700 ease-out ${
                            isReextractExpanded ? 'translate-y-0' : '-translate-y-2'
                          }`}
                        >
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {tx('playbook.useSameSourceToDiscoverModes')}
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {EXTRACTION_MODE_OPTIONS.map((option) => {
                              const isActive = option.value === resolvedMode
                              const isDisabled = isProcessing || isActive

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => triggerReextractMode(option.value)}
                                  disabled={isDisabled}
                                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                    isActive
                                      ? 'border-indigo-300 bg-white text-indigo-700 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300'
                                      : isProcessing
                                        ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                                        : 'border-indigo-100 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-100/60 dark:border-indigo-900/60 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40'
                                  }`}
                                >
                                  <p className="text-sm font-semibold">
                                    {option.label}
                                    {isActive ? ` (${tx('playbook.current')})` : ''}
                                  </p>
                                  <p className="mt-0.5 text-xs opacity-80">{option.description}</p>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>

            {shouldShowAdditionalSourcesPanel && (
              <div className="w-full">
                <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.55)] dark:border-slate-700/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
                  <div className="border-b border-slate-200/80 px-4 py-4 dark:border-slate-800 md:px-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <Link2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {tx('playbook.source.additionalSources')}
                            </h3>
                            <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {additionalSources.length}
                            </span>
                            {pendingSources.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-300">
                                <Clock size={10} />
                                {tx('playbook.source.pendingBadge')}
                              </span>
                            )}
                          </div>
                          {(pendingSources.length > 0 || additionalSources.length === 0) && (
                            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                              {pendingSources.length > 0
                                ? tx('playbook.source.pendingHelp')
                                : tx('playbook.source.additionalSourcesEmpty')}
                            </p>
                          )}
                        </div>
                      </div>

                      {canEditMeta && !isMetaEditing && (
                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setAdditionalSourcesError(null)
                              setIsAdditionalSourcesFormOpen((previous) => !previous)
                            }}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/25 dark:text-violet-300 dark:hover:bg-violet-900/40"
                          >
                            <Plus size={14} />
                            {tx('playbook.source.showAddSourceForm')}
                          </button>
                          <input
                            ref={additionalSourceFileInputRef}
                            type="file"
                            accept=".pdf,.docx,.txt,text/plain"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) {
                                void handleAdditionalSourceFileSelect(file)
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {canEditMeta && !isMetaEditing && isAdditionalSourcesFormOpen && (
                      <div className="mt-4 rounded-[1.25rem] border border-slate-200/80 bg-white/85 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                          <input
                            type="text"
                            value={additionalSourceLabelDraft}
                            onChange={(event) => setAdditionalSourceLabelDraft(event.target.value)}
                            placeholder={tx('playbook.source.additionalLabelPlaceholder')}
                            maxLength={200}
                            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <input
                            type="url"
                            value={additionalSourceUrlDraft}
                            onChange={(event) => setAdditionalSourceUrlDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                void handleAddAdditionalSource()
                              }
                            }}
                            placeholder={tx('playbook.source.additionalUrlPlaceholder')}
                            disabled={Boolean(additionalSourceUploadedFile)}
                            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => additionalSourceFileInputRef.current?.click()}
                            disabled={additionalSourceUploading || additionalSourceSaving}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {additionalSourceUploading
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Upload size={14} />}
                            {tx('playbook.source.uploadFile')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAddAdditionalSource()}
                            disabled={
                              additionalSourceSaving ||
                              additionalSourceUploading ||
                              (!additionalSourceUploadedFile && !additionalSourceUrlDraft.trim())
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                          >
                            {additionalSourceSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {additionalSourceSaving ? tx('common.saving') : tx('common.save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAdditionalSourcesFormOpen(false)
                              resetAdditionalSourceForm()
                            }}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {tx('common.cancel')}
                          </button>
                        </div>
                        {additionalSourceUploadedFile && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[1rem] border border-slate-200 bg-slate-50/90 px-3 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <span className="font-semibold text-slate-700 dark:text-slate-100">
                              {additionalSourceUploadedFile.sourceFileName}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-950">
                              {(additionalSourceUploadedFile.charCount / 1000).toFixed(1)}k chars
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 uppercase tracking-wide text-[10px] dark:border-slate-700 dark:bg-slate-950">
                              {getSourceTypeLabel(additionalSourceUploadedFile.sourceType)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalSourceUploadedFile(null)
                                if (additionalSourceFileInputRef.current) {
                                  additionalSourceFileInputRef.current.value = ''
                                }
                              }}
                              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <X size={11} />
                              {tx('playbook.source.removeUploadedFile')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-4 md:px-5">
                    {additionalSourcesError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/30 dark:text-rose-300">
                        {additionalSourcesError}
                      </div>
                    )}

                    {additionalSourcesLoading ? (
                      <div className="mt-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        <Loader2 size={14} className="animate-spin" />
                        {tx('common.loading')}
                      </div>
                    ) : additionalSources.length > 0 ? (
                      <div className="space-y-4">
                        {canEditMeta && !isMetaEditing && pendingSources.length > 0 && (
                          <div className="rounded-[1.25rem] border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/80 p-4 dark:border-amber-900/80 dark:from-amber-950/30 dark:to-orange-950/20">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                              <p className="max-w-3xl text-sm leading-6 text-amber-900 dark:text-amber-200">
                                {tx('playbook.source.pendingHelp')}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleAnalyzeSelectedSources('update_current')}
                                  disabled={selectedPendingSourceIds.length === 0 || analyzingSourcesTarget !== null}
                                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50"
                                >
                                  {analyzingSourcesTarget === 'update_current'
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <RefreshCw size={14} />}
                                  {tx('playbook.source.updateCurrentPlaybook')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleAnalyzeSelectedSources('create_new')}
                                  disabled={selectedPendingSourceIds.length === 0 || analyzingSourcesTarget !== null}
                                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                                >
                                  {analyzingSourcesTarget === 'create_new'
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Copy size={14} />}
                                  {tx('playbook.source.createNewPlaybook')}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                          {additionalSources.map((source) => {
                            const isYoutubeSource = source.sourceType === 'youtube'
                            const href = getPlaybookSourceHref(source)
                            const isPendingSelectable =
                              source.kind === 'additional' && source.analysisStatus === 'pending' && canEditMeta && !isMetaEditing
                            const isSelected = selectedPendingSourceIds.includes(source.id)
                            const sourceTitle =
                              source.sourceLabel?.trim() || source.sourceFileName || href || tx('playbook.source.analyzedContent')
                            const sourcePreview = href || source.sourceFileName || null
                            const formattedFileSize = formatSourceFileSize(source.sourceFileSizeBytes)

                            return (
                              <li
                                key={source.id}
                                className="flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.65)] dark:border-slate-700/80 dark:bg-slate-950/80"
                              >
                                <div className="flex h-full flex-col gap-4 p-4 md:p-5">
                                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                          {isYoutubeSource
                                            ? <Play size={10} className="fill-current" />
                                            : source.sourceType === 'web_url'
                                              ? <Globe size={10} />
                                              : <FileText size={10} />}
                                          {getSourceTypeLabel(source.sourceType)}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                          source.kind === 'primary'
                                            ? 'border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                                            : source.analysisStatus === 'analyzed'
                                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                                              : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                                        }`}>
                                          {source.analysisStatus === 'analyzed' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                                          {getSourceStatusLabel(source)}
                                        </span>
                                        {formattedFileSize && (
                                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                            {formattedFileSize}
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-3 space-y-1.5">
                                        <p className="break-words text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
                                          {sourceTitle}
                                        </p>
                                        {source.sourceFileName && source.sourceFileName !== sourceTitle && (
                                          <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {source.sourceFileName}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 lg:max-w-[19rem] lg:justify-end">
                                      {isPendingSelectable && (
                                        <label className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                                          isSelected
                                            ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                                            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                                        }`}>
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => togglePendingSourceSelection(source.id)}
                                            className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                          />
                                          {tx('playbook.source.includeInAnalysis')}
                                        </label>
                                      )}
                                      {href && (
                                        <a
                                          href={href}
                                          target={href.startsWith('/api/uploads/') ? undefined : '_blank'}
                                          rel={href.startsWith('/api/uploads/') ? undefined : 'noopener noreferrer'}
                                          download={source.sourceFileName ?? undefined}
                                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                        >
                                          {source.sourceFileUrl ? <Download size={13} /> : <ExternalLink size={13} />}
                                          {source.sourceFileUrl ? tx('playbook.source.download') : tx('playbook.source.openInNewTab')}
                                        </a>
                                      )}
                                      {canEditMeta && !isMetaEditing && source.kind === 'additional' && source.analysisStatus !== 'analyzed' && (
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteAdditionalSource(source.id)}
                                          disabled={additionalSourceDeletingId === source.id}
                                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                          aria-label={tx('playbook.source.deleteAdditionalSource')}
                                        >
                                          {additionalSourceDeletingId === source.id
                                            ? <Loader2 size={13} className="animate-spin" />
                                            : <Trash2 size={13} />}
                                          {tx('common.delete')}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {sourcePreview && (
                                    <div className="rounded-[1rem] border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1">
                                          {href ? <Link2 size={10} /> : <FileText size={10} />}
                                          {href ? tx('playbook.source.openSource') : tx('playbook.source.download')}
                                        </span>
                                      </div>
                                      {href ? (
                                        <a
                                          href={href}
                                          target={href.startsWith('/api/uploads/') ? undefined : '_blank'}
                                          rel={href.startsWith('/api/uploads/') ? undefined : 'noopener noreferrer'}
                                          className="block max-h-28 overflow-y-auto text-sm leading-6 text-slate-700 transition-colors hover:text-violet-700 dark:text-slate-200 dark:hover:text-violet-300"
                                          style={{ overflowWrap: 'anywhere' }}
                                        >
                                          {href}
                                        </a>
                                      ) : (
                                        <div
                                          className="max-h-28 overflow-y-auto text-sm leading-6 text-slate-700 dark:text-slate-200"
                                          style={{ overflowWrap: 'anywhere' }}
                                        >
                                          {sourcePreview}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                        {tx('playbook.source.additionalSourcesEmpty')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        <div
          className="bg-slate-50 p-6 border-b border-slate-100 dark:bg-slate-800/40 dark:border-slate-800"
          style={{ marginInline: '4.5%' }}
        >
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {tx('playbook.resultObjective')}
          </h2>
          {isMetaEditing ? (
            <div>
              <textarea
                value={metaObjectiveDraft}
                onChange={(e) => setMetaObjectiveDraft(e.target.value)}
                rows={4}
                placeholder={tx('playbook.extractionObjectivePlaceholder')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
              />
              {metaError && (
                <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{metaError}</p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelMetaEdit}
                  disabled={metaSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <X size={14} /> {tx('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveMeta()}
                  disabled={metaSaving || isUploadingMetaThumb}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  {metaSaving ? (
                    <><Loader2 size={14} className="animate-spin" /> {tx('common.loading')}</>
                  ) : (
                    <><Save size={14} /> {tx('common.saveChanges')}</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-lg font-medium text-slate-800 leading-relaxed dark:text-slate-100">
              {renderTextWithPlaybookReferences(result.objective)}
            </p>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {tx('playbook.itemsAndSubitems')}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {tx('playbook.defineActionableStructure')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isStructureEditing && interactiveTasks.length > 0 && (
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setTaskView('list')}
                    title={tx('playbook.view.listTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'list'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <LayoutList size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.list')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('sheets')}
                    title={tx('playbook.view.sheetsTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'sheets'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <FileText size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.sheets')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('kanban')}
                    title={tx('playbook.view.kanbanTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'kanban'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <KanbanSquare size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.kanban')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('calendar')}
                    title={tx('playbook.view.calendarTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'calendar'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <CalendarDays size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.calendar')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('gantt')}
                    title={tx('playbook.view.ganttTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'gantt'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <GanttChart size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.gantt')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('cpm')}
                    title={tx('playbook.view.cpmTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'cpm'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <GitBranch size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.cpm')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('mindmap')}
                    title={tx('playbook.view.mindmapTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'mindmap'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Brain size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.mindmap')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('hierarchy')}
                    title={tx('playbook.view.hierarchyTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'hierarchy'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Network size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.hierarchy')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('flowchart')}
                    title={tx('playbook.view.flowchartTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'flowchart'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Workflow size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.flowchart')}</span>
                    <span className="rounded-full bg-amber-400 px-1 py-px text-[9px] font-bold leading-none text-white">Beta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView('presentation')}
                    title={tx('playbook.view.slidesTooltip')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                      taskView === 'presentation'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Presentation size={13} />
                    <span className="hidden sm:inline">{tx('playbook.view.slides')}</span>
                  </button>
                </div>
              )}
              {result.id && !isStructureEditing && canEditStructure && (
                <button
                  type="button"
                  onClick={handleStartStructureEditing}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                >
                  <Pencil size={14} />
                  {tx('playbook.editContent')}
                </button>
              )}
            </div>
          </div>

          {isStructureEditing && (
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
              {structureError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                  {structureError}
                </p>
              )}

              <div className="space-y-3">
                {phaseDrafts.map((phase, phaseIndex) => (
                  <div
                    key={phase.id}
                    draggable={!structureSaving}
                    onDragStart={(e) => handlePhaseDragStart(e, phaseIndex)}
                    onDragOver={(e) => handlePhaseDragOver(e, phaseIndex)}
                    onDrop={(e) => handlePhaseDrop(e, phaseIndex)}
                    onDragEnd={handlePhaseDragEnd}
                    className={`rounded-xl border bg-white p-3 transition-colors dark:bg-slate-900 ${
                      dragOverPhaseIndex === phaseIndex && dragPhaseRef.current !== phaseIndex
                        ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-900/20'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex-shrink-0 cursor-grab touch-none text-slate-300 active:cursor-grabbing dark:text-slate-600"
                        title={tx('playbook.dragToReorder')}
                      >
                        <GripVertical size={16} />
                      </span>
                      <input
                        type="text"
                        value={phase.title}
                        onChange={(event) => handleDraftPhaseTitleChange(phase.id, event.target.value)}
                        placeholder={tx('playbook.mainItemTitlePlaceholder')}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteDraftPhase(phase.id)}
                        disabled={phaseDrafts.length <= 1 || structureSaving}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                        aria-label={tx('playbook.deleteMainItemAria', {
                          name: phase.title || String(phase.id),
                        })}
                      >
                        <Trash2 size={13} />
                        {tx('common.delete')}
                      </button>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/30">
                      <p className="mb-2 pl-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                        {tx('playbook.subitems')}
                      </p>
                      <div className="ml-2 space-y-2 border-l border-dashed border-slate-300 pl-3 dark:border-slate-600">
                        {flattenPhaseNodes(phase.id, phase.items).map((node) => {
                          const canDelete = countNodes(phase.items) > 1
                          return (
                            <div
                              key={`${phase.id}-draft-item-${node.nodeId}`}
                              className="rounded-lg border border-slate-200/80 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                              style={{ marginLeft: `${Math.max(0, node.depth - 1) * 14}px` }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-6 min-w-[2.3rem] items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 font-mono text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  {node.fullPath}
                                </span>
                                <input
                                  type="text"
                                  value={node.text}
                                  onChange={(event) =>
                                    handleDraftSubItemChange(phase.id, node.nodeId, event.target.value)
                                  }
                                  placeholder={tx('playbook.itemTextPlaceholder')}
                                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddDraftChildSubItem(phase.id, node.nodeId)}
                                  disabled={structureSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-2 text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300 dark:hover:bg-sky-900/40"
                                  title={tx('playbook.addChild')}
                                  aria-label={tx('playbook.addChild')}
                                >
                                  <Plus size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddDraftSiblingSubItem(phase.id, node.nodeId)}
                                  disabled={structureSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                  title={tx('playbook.addSibling')}
                                  aria-label={tx('playbook.addSibling')}
                                >
                                  <Plus size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDraftSubItem(phase.id, node.nodeId)}
                                  disabled={!canDelete || structureSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                  aria-label={tx('playbook.deleteItem')}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddDraftSubItem(phase.id)}
                      disabled={structureSaving}
                      className="mt-3 ml-2 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Plus size={13} />
                      {tx('playbook.addRootItem')}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddDraftPhase}
                  disabled={structureSaving}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  <Plus size={14} />
                  {tx('playbook.addMainItem')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveStructure()}
                  disabled={structureSaving}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {structureSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {tx('common.saveChanges')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelStructureEditing}
                  disabled={structureSaving}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X size={14} />
                  {tx('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {!isStructureEditing && taskView === 'sheets' && interactiveTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-950/20">
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    {tx('playbook.sheet.title')}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    {tx('playbook.sheet.description', { count: spreadsheetRows.length })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSpreadsheetExcel}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    <Download size={14} />
                    {tx('playbook.sheet.exportExcel')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      googleDocsConnected
                        ? triggerAsyncAction(onExportToGoogleSheets)
                        : triggerAsyncAction(onConnectGoogleDocs)
                    }
                    disabled={
                      googleDocsConnected
                        ? !result.id || googleSheetsExportLoading
                        : googleDocsLoading || !googleDocsConfigured || !result.id
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:bg-slate-400"
                  >
                    <Zap size={14} />
                    {googleDocsConnected
                      ? googleSheetsExportLoading
                        ? tx('playbook.sheet.exportingGoogleSheets')
                        : tx('playbook.sheet.exportGoogleSheets')
                      : googleDocsLoading
                        ? tx('playbook.sheet.connectingGoogleSheets')
                        : googleDocsConfigured
                          ? tx('playbook.sheet.connectGoogleSheets')
                          : tx('playbook.sheet.googleUnavailable')}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="min-w-[1200px] w-full border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                      <tr>
                        {spreadsheetColumns.map((column) => (
                          <th
                            key={column.key}
                            className={`border-b border-slate-200 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-300 ${
                              column.align === 'right'
                                ? 'text-right'
                                : column.align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            }`}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {spreadsheetRows.map((row) => {
                        const task = tasksById.get(row.id) ?? null
                        const isSelected = task?.id === selectedTaskId

                        return (
                          <tr
                            key={row.id}
                            onClick={() => {
                              if (!task) return
                              if (isMobileTaskViewport()) {
                                openTaskDetailSheet(task.id, 'gestion')
                                return
                              }
                              focusTask(task.id)
                              setExclusiveTaskPanel(task.id, 'gestion')
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/20'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            {spreadsheetColumns.map((column) => {
                              const rawValue = row[column.key]
                              const alignClassName =
                                column.align === 'right'
                                  ? 'text-right'
                                  : column.align === 'center'
                                    ? 'text-center'
                                    : 'text-left'

                              let content: React.ReactNode =
                                rawValue === '' || rawValue === null ? (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                ) : (
                                  String(rawValue)
                                )

                              if (column.key === 'item') {
                                content = (
                                  <span className="block min-w-[18rem] max-w-[28rem] whitespace-normal leading-relaxed text-slate-700 dark:text-slate-200">
                                    {renderTextWithPlaybookReferences(row.item || tx('playbook.subitemWithoutText'))}
                                  </span>
                                )
                              } else if (column.key === 'status' && task) {
                                content = (
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                    {getTaskStatusLabel(task.status, tx)}
                                  </span>
                                )
                              } else if (column.key === 'checked') {
                                content = (
                                  <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    row.checked
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                                  }`}>
                                    {row.checked ? tx('playbook.sheet.completedValue') : tx('playbook.sheet.pendingValue')}
                                  </span>
                                )
                              } else if (
                                column.key === 'numericValue' ||
                                column.key === 'manualNumericValue' ||
                                column.key === 'durationDays' ||
                                column.key === 'depth'
                              ) {
                                content = (
                                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                                    {rawValue === '' || rawValue === null ? '-' : String(rawValue)}
                                  </span>
                                )
                              } else if (column.key === 'formula') {
                                content = row.formula ? (
                                  <span className="font-mono text-[11px] text-sky-700 dark:text-sky-300">
                                    {row.formula}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )
                              }

                              return (
                                <td
                                  key={`${row.id}-${column.key}`}
                                  className={`border-b border-slate-100 px-3 py-2 align-top text-slate-600 dark:border-slate-800 dark:text-slate-300 ${alignClassName}`}
                                >
                                  {content}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!isStructureEditing && taskView === 'kanban' && interactiveTasks.length > 0 && (
            <div className="overflow-x-auto pb-1">
              <div
                className="grid min-w-max gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(taskStatusOptions.length, 1)}, minmax(260px, 1fr))`,
                }}
              >
              {taskStatusOptions.map((col) => {
                const colTasks = interactiveTasks.filter((t) => t.status === col.value)
                return (
                  <div
                    key={col.value}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const taskId = e.dataTransfer.getData('kanban-task-id')
                      const task = interactiveTasks.find((t) => t.id === taskId)
                      if (task && task.status !== col.value) {
                        void handleTaskStatusChange(task, col.value)
                      }
                    }}
                    className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 min-h-[160px]"
                  >
                    <div className="flex items-center justify-between px-3 py-2 rounded-t-xl border-b border-slate-200 dark:border-slate-700">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${getTaskStatusHeaderClassName(col.value)}`}>
                        {col.label}
                      </span>
                      <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-2 flex-1">
                      {colTasks.map((task) => {
                        const isTaskMutating = taskMutationLoadingId === task.id
                        const isSelected = task.id === selectedTaskId
                        const dueDate = task.dueAt ? new Date(task.dueAt) : null
                        const isOverdue =
                          dueDate !== null &&
                          dueDate < new Date() &&
                          task.status !== 'completed'
                        const eventCount = task.events?.length ?? 0
                        return (
                          <div
                            key={task.id}
                            draggable={canEditTaskContent && !isTaskMutating}
                            onDragStart={(e) => {
                              kanbanDragRef.current = true
                              e.dataTransfer.setData('kanban-task-id', task.id)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragEnd={() => {
                              setTimeout(() => { kanbanDragRef.current = false }, 50)
                            }}
                            onClick={() => {
                              if (kanbanDragRef.current) return
                              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                setMobileSheetTaskId(task.id)
                                setMobileSheetTab('gestion')
                              } else {
                                setSelectedTaskId(isSelected ? null : task.id)
                                setActiveTaskId(isSelected ? null : task.id)
                              }
                            }}
                            className={`rounded-lg border bg-white text-xs shadow-sm transition-all dark:bg-slate-900 ${
                              isSelected
                                ? 'border-indigo-400 ring-1 ring-indigo-300 dark:border-indigo-500 dark:ring-indigo-600'
                                : 'border-slate-200 dark:border-slate-700'
                            } ${
                              canEditTaskContent && !isTaskMutating
                                ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700'
                                : 'cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700'
                            } ${isTaskMutating ? 'opacity-50' : ''}`}
                          >
                            {/* Barra de fase coloreada en el top */}
                            <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                              <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 max-w-[130px] truncate">
                                F{task.phaseId} · {task.phaseTitle}
                              </span>
                            </div>

                            {/* Texto de la tarea */}
                            <p className="px-3 pb-2 font-medium text-slate-700 dark:text-slate-200 line-clamp-3 leading-snug">
                              {task.itemText}
                            </p>

                            {/* Footer: fecha y eventos */}
                            {(dueDate || eventCount > 0 || isTaskMutating) && (
                              <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  {dueDate && (
                                    <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? 'text-rose-500 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                                      <Clock size={9} />
                                      {new Intl.DateTimeFormat(localeTag, {
                                        month: 'short',
                                        day: 'numeric',
                                      }).format(dueDate)}
                                      {isOverdue && ` · ${tx('playbook.overdue')}`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {eventCount > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                                      <MessageSquare size={9} />
                                      {eventCount}
                                    </span>
                                  )}
                                  {isTaskMutating && (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                      <Loader2 size={9} className="animate-spin" />
                                      {tx('common.saving')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {colTasks.length === 0 && (
                        <div className="flex flex-1 items-center justify-center py-6 text-[11px] text-slate-400 dark:text-slate-600">
                          {tx('playbook.noTasks')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          )}

          {/* ── Schedule Popover — compartido por Calendar y Gantt ── */}
          {schedulePopoverTask && typeof window !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                onClick={() => setSchedulePopoverTask(null)} />
              <div className="relative z-10 w-full max-w-xs rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-0.5">
                      {tx('schedule.title')}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                      {schedulePopoverTask.itemText}
                    </p>
                  </div>
                  <button onClick={() => setSchedulePopoverTask(null)}
                    className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                    <X size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {tx('schedule.start')}
                    </label>
                    <input type="date" value={schedulePopoverStart}
                      onChange={e => setSchedulePopoverStart(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {tx('schedule.end')}
                    </label>
                    <input type="date" value={schedulePopoverEnd}
                      onChange={e => setSchedulePopoverEnd(e.target.value)}
                      min={schedulePopoverStart || undefined}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {(schedulePopoverTask.scheduledStartAt || schedulePopoverTask.dueAt) && (
                    <button type="button"
                      onClick={async () => {
                        setSchedulePopoverSaving(true)
                        try {
                          await refreshTaskCollection({ action: 'update_schedule', taskId: schedulePopoverTask.id, scheduledStartAt: null, scheduledEndAt: null })
                          setSchedulePopoverTask(null)
                        } finally { setSchedulePopoverSaving(false) }
                      }}
                      disabled={schedulePopoverSaving}
                      className="text-xs text-slate-400 hover:text-rose-500 disabled:opacity-50">
                      {tx('schedule.clearDates')}
                    </button>
                  )}
                  <button type="button" onClick={() => setSchedulePopoverTask(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    {tx('schedule.cancel')}
                  </button>
                  <button type="button" onClick={handleSaveSchedule}
                    disabled={schedulePopoverSaving || !schedulePopoverStart || !schedulePopoverEnd}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">
                    {schedulePopoverSaving && <Loader2 size={11} className="animate-spin" />}
                    {tx('schedule.save')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {!isStructureEditing && taskView === 'calendar' && interactiveTasks.length > 0 && (() => {
            const { matrix, lanesByRow } = calendarData
            const unscheduledTasks = interactiveTasks.filter(t =>
              (t.scheduledStartAt ?? t.dueAt) === null
            )

            return (
              <div key="calendar-view" className="space-y-3">

                {/* ── Month navigation ── */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                  <button type="button" onClick={prevMonth}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                    <ChevronLeft size={14} />
                    <span className="hidden sm:inline">{tx('calendar.prevMonth')}</span>
                  </button>
                  <span className="capitalize text-sm font-bold text-slate-700 dark:text-slate-200">
                    {new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(
                      new Date(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth(), 1)
                    )}
                  </span>
                  <button type="button" onClick={nextMonth}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                    <span className="hidden sm:inline">{tx('calendar.nextMonth')}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* ── Calendar grid ── */}
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  {/* Day-of-week header */}
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    {[
                      tx('calendar.dayMon'),
                      tx('calendar.dayTue'),
                      tx('calendar.dayWed'),
                      tx('calendar.dayThu'),
                      tx('calendar.dayFri'),
                      tx('calendar.daySat'),
                      tx('calendar.daySun'),
                    ].map((d, i) => (
                      <div key={d} className={`py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 ${i > 0 ? 'border-l border-slate-100 dark:border-slate-700' : ''}`}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* 6 rows */}
                  {matrix.map((row, rowIdx) => {
                    const _cn = new Date(); const calToday = new Date(Date.UTC(_cn.getFullYear(), _cn.getMonth(), _cn.getDate()))
                    const rowLanes = lanesByRow.get(rowIdx) ?? []
                    const numLanes = rowLanes.length > 0 ? Math.max(...rowLanes.map(s => s.lane)) + 1 : 0
                    const barsHeight = numLanes > 0 ? numLanes * 24 + 6 : 0
                    const currentMonthNum = calendarMonth.getUTCMonth()

                    return (
                      <div key={rowIdx} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                        {/* Date numbers */}
                        <div className="grid grid-cols-7">
                          {row.map((day, colIdx) => {
                            const isToday = isSameDay(day, calToday)
                            const inMonth = day.getUTCMonth() === currentMonthNum
                            return (
                              <div key={colIdx}
                                className={`flex h-7 items-center justify-end px-1.5 ${colIdx > 0 ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                                  isToday ? 'bg-indigo-600 text-white font-bold' :
                                  !inMonth ? 'text-slate-300 dark:text-slate-700' :
                                  'text-slate-600 dark:text-slate-400'
                                }`}>
                                  {day.getUTCDate()}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Bars layer */}
                        {numLanes > 0 && (
                          <div className="relative w-full" style={{ height: barsHeight }}>
                            {rowLanes.map(seg => {
                              const task = interactiveTasks.find(t => t.id === seg.taskId)
                              if (!task) return null
                              const rawEnd = task.scheduledEndAt ?? task.dueAt
                              const _now = new Date(); const nowUtc = new Date(Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate()))
                              const isOverdue = rawEnd && dateFromYMDutc(rawEnd.slice(0, 10)) < nowUtc && task.status !== 'completed'
                              const barColor = isOverdue
                                ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
                                : task.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
                                : task.status === 'in_progress'
                                  ? 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800'
                                : task.status === 'blocked'
                                  ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800'
                              const PAD = 2
                              return (
                                <div
                                  key={`${seg.taskId}-r${rowIdx}`}
                                  onClick={() => openSchedulePopover(task)}
                                  title={task.itemText}
                                  className={`absolute cursor-pointer select-none overflow-hidden border text-[10px] font-medium flex items-center hover:brightness-95 dark:hover:brightness-110 transition-[filter] ${barColor} ${seg.isStart ? 'rounded-l-full pl-2' : 'border-l-0'} ${seg.isEnd ? 'rounded-r-full pr-1' : 'border-r-0'}`}
                                  style={{
                                    left: `calc(${(seg.startCol / 7) * 100}% + ${PAD}px)`,
                                    width: `calc(${((seg.endCol - seg.startCol + 1) / 7) * 100}% - ${PAD * 2}px)`,
                                    top: `${seg.lane * 24 + 3}px`,
                                    height: '20px',
                                  }}
                                >
                                  {seg.isStart && <span className="truncate leading-none">{task.itemText}</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* ── Sin fecha (colapsable) ── */}
                {unscheduledTasks.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <button type="button" onClick={() => setCalendarSinFechaOpen(v => !v)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                      <span className="flex items-center gap-2">
                        {tx('calendar.unscheduled')}
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {unscheduledTasks.length}
                        </span>
                      </span>
                      <ChevronDown size={14} className={`transition-transform duration-200 ${calendarSinFechaOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div aria-hidden={!calendarSinFechaOpen}
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${calendarSinFechaOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="flex flex-col gap-1.5 p-2">
                          {unscheduledTasks.map(task => (
                            <div key={task.id} onClick={() => openSchedulePopover(task)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm transition-all hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-700">
                              <div className="flex items-start gap-1.5">
                                {(task.depth ?? 0) > 0 && <span className="mt-0.5 flex-shrink-0 text-slate-300 dark:text-slate-600">└</span>}
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 max-w-[120px] truncate">
                                      F{task.phaseId} · {task.phaseTitle}
                                    </span>
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                      {getTaskStatusLabel(task.status, tx)}
                                    </span>
                                  </div>
                                  <p className="font-medium text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">
                                    {task.itemText}
                                  </p>
                                  <p className="flex items-center gap-0.5 text-[10px] text-indigo-400 dark:text-indigo-500">
                                    <CalendarDays size={9} />
                                    {tx('calendar.clickToSchedule')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Gantt Chart view ── */}
          {!isStructureEditing && taskView === 'gantt' && interactiveTasks.length > 0 && (() => {
            const ganttRangeEnd = new Date(ganttRangeStart)
            ganttRangeEnd.setUTCDate(ganttRangeStart.getUTCDate() + GANTT_DAYS - 1)

            const ganttDays = Array.from({ length: GANTT_DAYS }, (_, i) => {
              const d = new Date(ganttRangeStart)
              d.setUTCDate(ganttRangeStart.getUTCDate() + i)
              return d
            })

            const _tn = new Date(); const today = new Date(Date.UTC(_tn.getFullYear(), _tn.getMonth(), _tn.getDate()))
            const todayOffset = daysBetween(ganttRangeStart, today)
            const todayVisible = todayOffset >= 0 && todayOffset < GANTT_DAYS

            // Agrupar por fase; los sin-fecha van aparte
            const phasesMap = new Map<number, { id: number; title: string; tasks: InteractiveTask[] }>()
            const unscheduledTasks: InteractiveTask[] = []
            for (const task of interactiveTasks) {
              if ((task.scheduledStartAt ?? task.dueAt) === null) {
                unscheduledTasks.push(task)
                continue
              }
              if (!phasesMap.has(task.phaseId)) {
                phasesMap.set(task.phaseId, { id: task.phaseId, title: task.phaseTitle, tasks: [] })
              }
              phasesMap.get(task.phaseId)!.tasks.push(task)
            }
            const phases = Array.from(phasesMap.values()).sort((a, b) => a.id - b.id)
            const totalWidth = GANTT_LEFT_W + GANTT_DAYS * GANTT_DAY_W

            // Etiqueta del rango visible
            const fmtRangeLabel = () => {
              const fmt = (d: Date) =>
                new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short' }).format(
                  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
                )
              return `${fmt(ganttRangeStart)} – ${fmt(ganttRangeEnd)}`
            }

            return (
              <div key="gantt-view" className="space-y-3">

                {/* Navegación */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                  <button type="button" onClick={prevGanttWeek}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                    <ChevronLeft size={14} />
                    <span className="hidden sm:inline">{tx('calendar.prevWeek')}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={resetGanttToToday}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                      {tx('calendar.today')}
                    </button>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {fmtRangeLabel()}
                    </span>
                  </div>
                  <button type="button" onClick={nextGanttWeek}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                    <span className="hidden sm:inline">{tx('calendar.nextWeek')}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Grid */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <div style={{ minWidth: `${totalWidth}px` }}>

                    {/* Cabecera — días */}
                    <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      {/* Columna título (sticky) */}
                      <div
                        style={{ position: 'sticky', left: 0, width: GANTT_LEFT_W, zIndex: 20 }}
                        className="flex-shrink-0 border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 flex items-center px-3 h-10"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {tx('calendar.task')}
                        </span>
                      </div>
                      {/* Días */}
                      <div className="flex">
                        {ganttDays.map((day, i) => {
                          const isToday = isSameDay(day, today)
                          const isMonday = day.getUTCDay() === 1
                          const showMonth = day.getUTCDate() === 1 || i === 0
                          return (
                            <div
                              key={i}
                              style={{ width: GANTT_DAY_W }}
                              className={`relative h-10 flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-700/50 ${isMonday && i > 0 ? 'border-l-slate-300 dark:border-l-slate-600' : ''}`}
                            >
                              {showMonth && (
                                <span className="absolute top-0.5 left-0.5 text-[8px] font-bold uppercase text-slate-400 dark:text-slate-500 leading-none">
                                  {new Intl.DateTimeFormat(localeTag, { month: 'short' }).format(
                                    new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
                                  )}
                                </span>
                              )}
                              <span className={`text-[11px] font-medium leading-none ${isToday ? 'text-indigo-600 font-bold dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                {day.getUTCDate()}
                              </span>
                              <span className="text-[8px] uppercase text-slate-300 dark:text-slate-700 leading-none mt-0.5">
                                {new Intl.DateTimeFormat(localeTag, { weekday: 'short' })
                                  .format(new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
                                  .slice(0, 2)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Filas por fase */}
                    {phases.map(phase => (
                      <div key={phase.id}>
                        {/* Fila de fase */}
                        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 bg-indigo-50/60 dark:bg-indigo-900/10">
                          <div
                            style={{ position: 'sticky', left: 0, width: GANTT_LEFT_W, zIndex: 10 }}
                            className="flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-indigo-50/60 dark:bg-indigo-900/10 px-3 h-8 flex items-center"
                          >
                            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 truncate">
                              F{phase.id} · {phase.title}
                            </span>
                          </div>
                          <div style={{ width: `${GANTT_DAYS * GANTT_DAY_W}px` }} className="relative h-8">
                            {todayVisible && (
                              <div
                                className="absolute top-0 bottom-0 w-px bg-indigo-400/30 dark:bg-indigo-500/30 pointer-events-none"
                                style={{ left: `${todayOffset * GANTT_DAY_W + GANTT_DAY_W / 2}px` }}
                              />
                            )}
                            {/* Separadores de semana */}
                            {ganttDays.map((day, i) =>
                              day.getUTCDay() === 1 && i > 0 ? (
                                <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-200/60 dark:bg-slate-700/40 pointer-events-none"
                                  style={{ left: `${i * GANTT_DAY_W}px` }} />
                              ) : null
                            )}
                          </div>
                        </div>

                        {/* Filas de tarea */}
                        {phase.tasks.map(task => {
                          const rawStart = task.scheduledStartAt ?? task.dueAt
                          const rawEnd   = task.scheduledEndAt   ?? task.dueAt
                          const tStart = rawStart ? dateFromYMDutc(rawStart.slice(0, 10)) : null
                          const tEnd   = rawEnd   ? dateFromYMDutc(rawEnd.slice(0, 10))   : null

                          let barLeftPx: number | null = null
                          let barWidthPx: number | null = null
                          let isClampedLeft  = false
                          let isClampedRight = false
                          let isOverdue = false

                          if (tStart && tEnd && tEnd >= ganttRangeStart && tStart <= ganttRangeEnd) {
                            isClampedLeft  = tStart < ganttRangeStart
                            isClampedRight = tEnd   > ganttRangeEnd
                            const cStart = isClampedLeft  ? ganttRangeStart : tStart
                            const cEnd   = isClampedRight ? ganttRangeEnd   : tEnd
                            barLeftPx  = daysBetween(ganttRangeStart, cStart) * GANTT_DAY_W
                            barWidthPx = (daysBetween(cStart, cEnd) + 1) * GANTT_DAY_W
                            isOverdue  = tEnd < today && task.status !== 'completed'
                          }

                          return (
                            <div
                              key={task.id}
                              className="flex border-b border-slate-100 dark:border-slate-800 group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                              style={{ height: 44 }}
                            >
                              {/* Etiqueta (sticky) */}
                              <div
                                style={{ position: 'sticky', left: 0, width: GANTT_LEFT_W, zIndex: 10 }}
                                onClick={() => openSchedulePopover(task)}
                                className="flex-shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 px-3 flex items-center h-full cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {(task.depth ?? 0) > 1 && (
                                    <span className="flex-shrink-0 text-[10px] text-slate-300 dark:text-slate-600">└</span>
                                  )}
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold flex-shrink-0 ${getTaskStatusChipClassName(task.status)}`}>
                                    {getTaskStatusLabel(task.status, tx).slice(0, 3)}
                                  </span>
                                  <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate leading-tight">
                                    {task.itemText}
                                  </span>
                                </div>
                              </div>

                              {/* Timeline row */}
                              <div
                                style={{ width: `${GANTT_DAYS * GANTT_DAY_W}px` }}
                                onClick={() => openSchedulePopover(task)}
                                className="relative h-full cursor-pointer"
                              >
                                {/* Línea de hoy */}
                                {todayVisible && (
                                  <div
                                    className="absolute top-0 bottom-0 w-px bg-indigo-400/30 dark:bg-indigo-500/30 pointer-events-none"
                                    style={{ left: `${todayOffset * GANTT_DAY_W + GANTT_DAY_W / 2}px` }}
                                  />
                                )}
                                {/* Separadores de semana */}
                                {ganttDays.map((day, i) =>
                                  day.getUTCDay() === 1 && i > 0 ? (
                                    <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800 pointer-events-none"
                                      style={{ left: `${i * GANTT_DAY_W}px` }} />
                                  ) : null
                                )}
                                {/* Barra */}
                                {barLeftPx !== null && barWidthPx !== null && (
                                  <div
                                    className={`absolute border text-[10px] font-medium flex items-center overflow-hidden hover:brightness-95 dark:hover:brightness-110 transition-[filter] ${getGanttBarClassName(task.status, isOverdue)} ${!isClampedLeft ? 'rounded-l-full' : ''} ${!isClampedRight ? 'rounded-r-full' : ''}`}
                                    style={{
                                      left: `${barLeftPx + 2}px`,
                                      width: `${Math.max(barWidthPx - 4, 8)}px`,
                                      top: '10px',
                                      height: '22px',
                                    }}
                                  >
                                    <span className="px-2 truncate leading-none">{task.itemText}</span>
                                  </div>
                                )}
                                {/* Si la tarea está fuera del rango actual: icono indicador */}
                                {barLeftPx === null && tStart && tEnd && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-[9px] text-slate-300 dark:text-slate-700 italic">
                                      {tEnd < ganttRangeStart
                                        ? tx('calendar.outOfRangeLeft')
                                        : tx('calendar.outOfRangeRight')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}

                    {/* Mensaje si todo está sin fecha */}
                    {phases.length === 0 && (
                      <div className="flex" style={{ height: 48 }}>
                        <div style={{ position: 'sticky', left: 0, width: GANTT_LEFT_W }}
                          className="flex-shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center px-3">
                          <span className="text-xs text-slate-400">
                            {tx('calendar.noScheduledTasks')}
                          </span>
                        </div>
                        <div style={{ width: `${GANTT_DAYS * GANTT_DAY_W}px` }} className="relative">
                          {todayVisible && (
                            <div className="absolute top-0 bottom-0 w-px bg-indigo-400/30 pointer-events-none"
                              style={{ left: `${todayOffset * GANTT_DAY_W + GANTT_DAY_W / 2}px` }} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sin fecha */}
                {unscheduledTasks.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <button type="button" onClick={() => setGanttSinFechaOpen(v => !v)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                      <span className="flex items-center gap-2">
                        {tx('calendar.unscheduled')}
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {unscheduledTasks.length}
                        </span>
                      </span>
                      <ChevronDown size={14} className={`transition-transform duration-200 ${ganttSinFechaOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div aria-hidden={!ganttSinFechaOpen}
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${ganttSinFechaOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="flex flex-col gap-1.5 p-2">
                          {unscheduledTasks.map(task => (
                            <div key={task.id} onClick={() => openSchedulePopover(task)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm transition-all hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-700">
                              <div className="flex items-start gap-1.5">
                                {(task.depth ?? 0) > 0 && <span className="mt-0.5 flex-shrink-0 text-slate-300 dark:text-slate-600">└</span>}
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 max-w-[120px] truncate">
                                      F{task.phaseId} · {task.phaseTitle}
                                    </span>
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                      {getTaskStatusLabel(task.status, tx)}
                                    </span>
                                  </div>
                                  <p className="font-medium text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">
                                    {task.itemText}
                                  </p>
                                  <p className="flex items-center gap-0.5 text-[10px] text-indigo-400 dark:text-indigo-500">
                                    <CalendarDays size={9} />
                                    {tx('calendar.clickToSchedule')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── CPM Network Diagram view ── */}
          {!isStructureEditing && taskView === 'cpm' && interactiveTasks.length > 0 && (() => {
            const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')

            const cpmNodes: CpmNode[] = interactiveTasks.map(t => ({
              id: t.id, durationDays: t.durationDays, predecessorIds: t.predecessorIds,
            }))
            const hasCycle = hasCyclicDeps(interactiveTasks)
            const cpmMap = computeCPM(cpmNodes)
            const criticalCount = interactiveTasks.filter(t => cpmMap.get(t.id)?.critical).length
            const projectDuration = interactiveTasks.reduce((m, t) => Math.max(m, cpmMap.get(t.id)?.ef ?? 0), 0)
            const displayTasks = cpmOnlyCritical
              ? interactiveTasks.filter(t => cpmMap.get(t.id)?.critical)
              : interactiveTasks

            const layout = buildCpmLayout(displayTasks)

            // Collect edges
            const edges: { taskId: string; predId: string; critical: boolean }[] = []
            for (const task of displayTasks) {
              for (const predId of task.predecessorIds) {
                if (layout.has(predId)) {
                  const pCpm = cpmMap.get(predId)
                  const tCpm = cpmMap.get(task.id)
                  const critical = !!(pCpm?.critical && tCpm?.critical && pCpm.ef === tCpm.es)
                  edges.push({ taskId: task.id, predId, critical })
                }
              }
            }

            // Color palette (light / dark)
            const nodeFill      = isDark ? '#0f172a' : '#ffffff'
            const nodeBorder    = isDark ? '#475569' : '#cbd5e1'
            const nodeCritFill  = isDark ? '#1c0505' : '#fff1f2'
            const nodeCritBorder = isDark ? '#dc2626' : '#ef4444'
            const textPrimary   = isDark ? '#f1f5f9' : '#0f172a'
            const textSecondary = isDark ? '#64748b' : '#94a3b8'
            const textData      = isDark ? '#94a3b8' : '#64748b'
            const phaseChipBg   = isDark ? '#1e1b4b' : '#eef2ff'
            const phaseChipText = isDark ? '#818cf8' : '#4f46e5'
            const edgeNormal    = isDark ? '#334155' : '#cbd5e1'
            const edgeCrit      = isDark ? '#dc2626' : '#ef4444'
            const canvasBg      = isDark ? '#020617' : '#f8fafc'
            const dividerColor  = isDark ? '#1e293b' : '#e2e8f0'

            const openCpmEditor = (task: InteractiveTask) => {
              if (cpmDidMoveRef.current) return
              setCpmEditTask(task)
              setCpmEditDuration(task.durationDays)
              setCpmEditPreds([...task.predecessorIds])
              setCpmPredSearch('')
            }

            const handleCpmWheel = (e: React.WheelEvent<SVGSVGElement>) => {
              e.preventDefault()
              const factor = e.deltaY < 0 ? 1.12 : 0.9
              const newZoom = Math.max(0.2, Math.min(4, cpmZoom * factor))
              const rect = e.currentTarget.getBoundingClientRect()
              const mx = e.clientX - rect.left
              const my = e.clientY - rect.top
              const svgX = (mx - cpmPanX) / cpmZoom
              const svgY = (my - cpmPanY) / cpmZoom
              setCpmZoom(newZoom)
              setCpmPanX(mx - svgX * newZoom)
              setCpmPanY(my - svgY * newZoom)
            }

            const handleCpmMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
              if (e.button !== 0) return
              cpmDragRef.current = { startX: e.clientX, startY: e.clientY, panX: cpmPanX, panY: cpmPanY }
              cpmDidMoveRef.current = false
            }

            const handleCpmMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
              if (!cpmDragRef.current) return
              const dx = e.clientX - cpmDragRef.current.startX
              const dy = e.clientY - cpmDragRef.current.startY
              if (Math.abs(dx) + Math.abs(dy) > 5) cpmDidMoveRef.current = true
              setCpmPanX(cpmDragRef.current.panX + dx)
              setCpmPanY(cpmDragRef.current.panY + dy)
            }

            const handleCpmMouseUp = () => { cpmDragRef.current = null }

            const nw = CPM_NODE_W
            const nh = CPM_NODE_H
            const sw = CPM_SIDE_W

            return (
              <div className="space-y-3">

                {/* ── Editor popover ── */}
                {cpmEditTask && typeof window !== 'undefined' && createPortal(
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                      onClick={() => setCpmEditTask(null)} />
                    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-0.5">
                            {tx('playbook.editPlanning')}
                          </p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                            {cpmEditTask.itemText}
                          </p>
                        </div>
                        <button onClick={() => setCpmEditTask(null)}
                          className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                          <X size={15} />
                        </button>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          {tx('playbook.durationDays')}
                        </label>
                        <input type="number" min={1} value={cpmEditDuration}
                          onChange={e => setCpmEditDuration(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                          className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {tx('playbook.predecessors', { count: cpmEditPreds.length })}
                          </label>
                          {cpmEditPreds.length > 0 && (
                            <button type="button" onClick={() => setCpmEditPreds([])}
                              className="text-[10px] text-slate-400 hover:text-rose-500">
                              {tx('playbook.clearDependencies')}
                            </button>
                          )}
                        </div>
                        <input type="text" placeholder={tx('playbook.searchTask')} value={cpmPredSearch}
                          onChange={e => setCpmPredSearch(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
                        />
                        <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
                          {interactiveTasks
                            .filter(t => t.id !== cpmEditTask.id && (!cpmPredSearch.trim() || t.itemText.toLowerCase().includes(cpmPredSearch.toLowerCase().trim())))
                            .map(t => {
                              const checked = cpmEditPreds.includes(t.id)
                              return (
                                <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                                  <input type="checkbox" checked={checked}
                                    onChange={() => setCpmEditPreds(prev =>
                                      checked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                                    )}
                                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                  />
                                  <span className="text-[11px] leading-snug text-slate-700 dark:text-slate-300 line-clamp-2">
                                    <span className="mr-1 text-[10px] text-indigo-500">F{t.phaseId}</span>
                                    {t.itemText}
                                  </span>
                                </label>
                              )
                            })}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setCpmEditTask(null)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                          {tx('common.cancel')}
                        </button>
                        <button type="button" onClick={handleSavePlanning} disabled={cpmEditSaving}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">
                          {cpmEditSaving && <Loader2 size={11} className="animate-spin" />}
                          {tx('common.save')}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {tx('playbook.cpmNetworkSummary', {
                        count: displayTasks.length,
                        duration: projectDuration,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 dark:bg-rose-900/20">
                    <Zap size={11} className="text-rose-500" />
                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      {tx('playbook.criticalCount', { count: criticalCount })}
                    </span>
                  </div>
                  <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <input type="checkbox" checked={cpmOnlyCritical}
                      onChange={e => { setCpmOnlyCritical(e.target.checked); setCpmPanX(24); setCpmPanY(24); setCpmZoom(0.85) }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-rose-500 focus:ring-rose-400 dark:border-slate-600"
                    />
                    {tx('playbook.onlyCriticalPath')}
                  </label>
                  {canEditTaskContent && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      · {tx('playbook.clickNodeToEdit')}
                    </span>
                  )}
                </div>

                {/* ── Cycle warning ── */}
                {hasCycle && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    {tx('playbook.cycleDetectedWarning')}
                  </div>
                )}

                {/* ── Hint: no deps yet ── */}
                {!hasCycle && interactiveTasks.every(t => t.predecessorIds.length === 0) && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-[11px] text-indigo-600 dark:border-indigo-800/40 dark:bg-indigo-900/20 dark:text-indigo-400">
                    {tx('playbook.noPredecessorsHint')}
                  </div>
                )}

                {/* ── SVG canvas ── */}
                <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" style={{ height: 600 }}>
                  <svg
                    width="100%" height="100%"
                    style={{ background: canvasBg, cursor: cpmDragRef.current ? 'grabbing' : 'grab', userSelect: 'none', display: 'block' }}
                    onMouseDown={handleCpmMouseDown}
                    onMouseMove={handleCpmMouseMove}
                    onMouseUp={handleCpmMouseUp}
                    onMouseLeave={handleCpmMouseUp}
                    onWheel={handleCpmWheel}
                  >
                    <defs>
                      <marker id="cpm-arr" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 Z" fill={edgeNormal} />
                      </marker>
                      <marker id="cpm-arr-c" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 Z" fill={edgeCrit} />
                      </marker>
                    </defs>

                    <g transform={`translate(${cpmPanX},${cpmPanY}) scale(${cpmZoom})`}>
                      {/* Edges — rendered first (below nodes) */}
                      {edges.map(edge => {
                        const from = layout.get(edge.predId)
                        const to   = layout.get(edge.taskId)
                        if (!from || !to) return null
                        const x1 = from.x + nw                // right-center of source
                        const y1 = from.y + nh / 2
                        const x2 = to.x                       // left-center of target
                        const y2 = to.y + nh / 2
                        return (
                          <path
                            key={`${edge.predId}->${edge.taskId}`}
                            d={makeCpmBezierPath(x1, y1, x2, y2)}
                            fill="none"
                            stroke={edge.critical ? edgeCrit : edgeNormal}
                            strokeWidth={edge.critical ? 2.5 : 1.5}
                            markerEnd={edge.critical ? 'url(#cpm-arr-c)' : 'url(#cpm-arr)'}
                          />
                        )
                      })}

                      {/* Nodes */}
                      {displayTasks.map(task => {
                        const pos  = layout.get(task.id)
                        if (!pos) return null
                        const cpm  = cpmMap.get(task.id)
                        const crit = cpm?.critical ?? false
                        const title = task.itemText.length > 21
                          ? task.itemText.slice(0, 20) + '…'
                          : task.itemText

                        const fill   = crit ? nodeCritFill   : nodeFill
                        const border = crit ? nodeCritBorder : nodeBorder
                        const numColor = crit ? nodeCritBorder : textPrimary

                        return (
                          <g
                            key={task.id}
                            transform={`translate(${pos.x},${pos.y})`}
                            style={{ cursor: canEditTaskContent ? 'pointer' : 'default' }}
                            onClick={() => canEditTaskContent && openCpmEditor(task)}
                          >
                            {/* Shadow */}
                            <rect x={2} y={2} width={nw} height={nh} rx={5} fill={isDark ? '#000' : '#e2e8f0'} opacity={0.4} />

                            {/* Main rect */}
                            <rect x={0} y={0} width={nw} height={nh} rx={5}
                              fill={fill} stroke={border} strokeWidth={crit ? 2.5 : 1.5} />

                            {/* Critical left accent */}
                            {crit && <rect x={0} y={0} width={5} height={nh} rx={3} fill={nodeCritBorder} />}

                            {/* Inner grid: vertical dividers */}
                            <line x1={sw} y1={0} x2={sw} y2={nh} stroke={dividerColor} strokeWidth={0.75} />
                            <line x1={nw - sw} y1={0} x2={nw - sw} y2={nh} stroke={dividerColor} strokeWidth={0.75} />
                            {/* Inner grid: horizontal dividers */}
                            <line x1={0} y1={30} x2={nw} y2={30} stroke={dividerColor} strokeWidth={0.75} />
                            <line x1={0} y1={60} x2={nw} y2={60} stroke={dividerColor} strokeWidth={0.75} />

                            {/* ── Row 1: ES | title | EF ── */}
                            {/* tiny labels */}
                            <text x={4} y={9} fontSize={7} fill={textSecondary} fontFamily="system-ui,sans-serif">ES</text>
                            <text x={nw - sw + 3} y={9} fontSize={7} fill={textSecondary} fontFamily="system-ui,sans-serif">EF</text>
                            {/* values */}
                            <text x={sw / 2} y={23} textAnchor="middle" fontSize={14} fontWeight="700"
                              fill={numColor} fontFamily="system-ui,sans-serif">
                              {cpm?.es ?? 0}
                            </text>
                            <text x={sw + (nw - sw * 2) / 2} y={22} textAnchor="middle" fontSize={10} fontWeight="600"
                              fill={textPrimary} fontFamily="system-ui,sans-serif">
                              {title}
                            </text>
                            <text x={nw - sw / 2} y={23} textAnchor="middle" fontSize={14} fontWeight="700"
                              fill={numColor} fontFamily="system-ui,sans-serif">
                              {cpm?.ef ?? task.durationDays}
                            </text>

                            {/* ── Row 2: phase | duration ── */}
                            <text x={sw / 2} y={50} textAnchor="middle" fontSize={9.5} fontWeight="700"
                              fill={phaseChipText} fontFamily="system-ui,sans-serif">
                              F{task.phaseId}
                            </text>
                            <text x={sw + (nw - sw * 2) / 2} y={50} textAnchor="middle" fontSize={10}
                              fill={textData} fontFamily="system-ui,sans-serif">
                              D = {task.durationDays}d
                            </text>

                            {/* ── Row 3: LS | slack | LF ── */}
                            <text x={4} y={69} fontSize={7} fill={textSecondary} fontFamily="system-ui,sans-serif">LS</text>
                            <text x={nw - sw + 3} y={69} fontSize={7} fill={textSecondary} fontFamily="system-ui,sans-serif">LF</text>
                            <text x={sw / 2} y={83} textAnchor="middle" fontSize={14} fontWeight="700"
                              fill={numColor} fontFamily="system-ui,sans-serif">
                              {cpm?.ls ?? 0}
                            </text>
                            <text x={sw + (nw - sw * 2) / 2} y={83} textAnchor="middle"
                              fontSize={10} fontWeight={crit ? '700' : '400'}
                              fill={crit ? nodeCritBorder : textData} fontFamily="system-ui,sans-serif">
                              S = {cpm?.slack ?? 0}
                            </text>
                            <text x={nw - sw / 2} y={83} textAnchor="middle" fontSize={14} fontWeight="700"
                              fill={numColor} fontFamily="system-ui,sans-serif">
                              {cpm?.lf ?? task.durationDays}
                            </text>
                          </g>
                        )
                      })}
                    </g>
                  </svg>

                  {/* Zoom controls */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                    <button type="button" onClick={() => setCpmZoom(z => Math.min(4, z * 1.2))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-base font-bold text-slate-600 shadow-sm backdrop-blur-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                      +
                    </button>
                    <button type="button" onClick={() => setCpmZoom(z => Math.max(0.2, z / 1.2))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-base font-bold text-slate-600 shadow-sm backdrop-blur-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                      −
                    </button>
                    <button type="button" onClick={() => { setCpmZoom(0.85); setCpmPanX(24); setCpmPanY(24) }}
                      className="flex h-7 items-center rounded-lg border border-slate-200 bg-white/90 px-2 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400">
                      Reset
                    </button>
                    <span className="w-9 text-right text-[10px] tabular-nums text-slate-400 dark:text-slate-600">
                      {Math.round(cpmZoom * 100)}%
                    </span>
                  </div>

                  {/* Legend */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[10px] text-slate-500 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-4 rounded-sm" style={{ background: edgeCrit }} />
                      {tx('playbook.criticalPathLegend')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-4 rounded-sm" style={{ background: edgeNormal }} />
                      {tx('playbook.normalLegend')}
                    </span>
                    <span className="hidden sm:inline">ES·EF / D / LS·LF·S</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Mind Map view ── */}
          {!isStructureEditing && taskView === 'mindmap' && interactiveTasks.length > 0 && (
            <MindMapView
              phases={result.phases}
              tasksByNodeId={tasksByNodeId}
              objective={result.objective}
              sourceDisplayTitle={sourceDisplayTitle}
              onSelectTask={taskId => {
                const isSelected = selectedTaskId === taskId
                setSelectedTaskId(isSelected ? null : taskId)
                setActiveTaskId(isSelected ? null : taskId)
              }}
              onOpenTaskMobile={taskId => {
                setMobileSheetTaskId(taskId)
                setMobileSheetTab('gestion')
              }}
            />
          )}

          {/* ── Hierarchy / Org-chart / WBS view ── */}
          {!isStructureEditing && taskView === 'hierarchy' && interactiveTasks.length > 0 && (
            <HierarchyChartView
              phases={result.phases}
              tasksByNodeId={tasksByNodeId}
              objective={result.objective}
              sourceDisplayTitle={sourceDisplayTitle}
              onSelectTask={taskId => {
                const isSelected = selectedTaskId === taskId
                setSelectedTaskId(isSelected ? null : taskId)
                setActiveTaskId(isSelected ? null : taskId)
              }}
              onOpenTaskMobile={taskId => {
                setMobileSheetTaskId(taskId)
                setMobileSheetTab('gestion')
              }}
            />
          )}

          {/* ── Flowchart / Process Graph view ── */}
          {!isStructureEditing && taskView === 'flowchart' && interactiveTasks.length > 0 && result.id && (
            <>
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              <span className="text-base">🚧</span>
              <span>
                <strong>{tx('playbook.viewInDevelopmentTitle')}</strong>{' '}
                {tx('playbook.viewInDevelopmentBody')}
              </span>
            </div>
            <FlowchartView
              interactiveTasks={interactiveTasks}
              extractionId={result.id}
              canEdit={canEditTaskContent}
              onSelectTask={taskId => {
                const isSelected = selectedTaskId === taskId
                setSelectedTaskId(isSelected ? null : taskId)
                setActiveTaskId(isSelected ? null : taskId)
              }}
              onOpenTaskMobile={taskId => {
                setMobileSheetTaskId(taskId)
                setMobileSheetTab('gestion')
              }}
            />
            </>
          )}

          {!isStructureEditing && taskView === 'presentation' && result.id && (
            <PresentationView
              interactiveTasks={interactiveTasks}
              extractionId={result.id}
              canEdit={canEditTaskContent}
            />
          )}

          {!isStructureEditing && taskView === 'list' &&
            result.phases.map((phase: Phase) => {
              const isPhaseExpanded = activePhase === phase.id

              return (
                <div
                  key={phase.id}
                  className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:border-indigo-200 hover:shadow-sm group dark:border-slate-700 dark:hover:border-indigo-700"
                >
                  <button
                    onClick={() => onTogglePhase(phase.id)}
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          isPhaseExpanded
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-700 dark:text-slate-300 dark:group-hover:bg-indigo-900/40 dark:group-hover:text-indigo-300'
                        }`}
                      >
                        {phase.id}
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{phase.title}</span>
                    </div>
                    {isPhaseExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </button>

                  <div
                    aria-hidden={!isPhaseExpanded}
                    className={`grid transition-[grid-template-rows,opacity] duration-700 ease-out ${
                      isPhaseExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div
                        className={`border-t border-slate-100 bg-slate-50/50 p-4 pt-0 transition-transform duration-700 ease-out dark:border-slate-800 dark:bg-slate-800/40 ${
                          isPhaseExpanded ? 'translate-y-0' : '-translate-y-2 pointer-events-none'
                        }`}
                      >
                        <div className="mt-4 space-y-2">
                          {tasksLoading && (
                            <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <Loader2 size={13} className="animate-spin" />
                              {tx('playbook.syncingInteractiveChecklist')}
                            </p>
                          )}
                          {tasksError && (
                            <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{tasksError}</p>
                          )}
                          {!result.id && (
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {tx('playbook.mustBePersistedToSave')}
                            </p>
                          )}
                        </div>

                        <div className="mt-4">
                          <div className="mb-3 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-indigo-400 dark:text-indigo-500" />
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                              {tx('playbook.subitems')}
                            </p>
                          </div>
                          <ul className="space-y-3 md:ml-2 md:space-y-4 md:border-l-2 md:border-dashed md:border-slate-300 md:pl-4 md:dark:border-slate-700">
                            {flattenPhaseNodes(phase.id, phase.items).map((node, idx) => {
                              const itemText = node.text
                              const normalizedItemText =
                                typeof itemText === 'string' ? itemText : itemText == null ? '' : String(itemText)
                              const itemDisplayText = normalizedItemText.trim()
                                ? renderTextWithPlaybookReferences(normalizedItemText)
                                : tx('playbook.subitemWithoutText')
                              const subItemNumber = node.fullPath
                              const task =
                                tasksByNodeId.get(node.nodeId) ??
                                tasksByPhaseItem.get(`${phase.id}:${idx}`) ??
                                null
                              const isTaskMutating = task ? taskMutationLoadingId === task.id : false
                              const taskAttachments = task ? (taskAttachmentsByTaskId[task.id] ?? []) : []
                              const taskAttachmentError = task
                                ? (taskAttachmentErrorByTaskId[task.id] ?? null)
                                : null
                              const taskAttachmentFilter = task
                                ? (taskAttachmentFilterByTaskId[task.id] ?? 'all')
                                : 'all'
                              const taskEvidenceComposerMode = task
                                ? (taskEvidenceComposerModeByTaskId[task.id] ?? 'file')
                                : 'file'
                              const pendingTaskFile = task
                                ? (pendingTaskFileByTaskId[task.id] ?? null)
                                : null
                              const taskYoutubeDraft = task
                                ? (youtubeAttachmentDraftByTaskId[task.id] ?? '')
                                : ''
                              const isTaskAttachmentLoading = task
                                ? taskAttachmentLoadingId === task.id
                                : false
                              const isTaskAttachmentMutating = task
                                ? taskAttachmentMutationId === task.id
                                : false
                              const isTaskFileDropTarget = task
                                ? taskFileDropTargetId === task.id
                                : false
                              const taskAttachmentFilterOptions = buildAttachmentFilterOptions(
                                taskAttachments,
                                tx
                              )
                              const normalizedTaskAttachmentFilter = taskAttachmentFilterOptions.some(
                                (option) => option.key === taskAttachmentFilter
                              )
                                ? taskAttachmentFilter
                                : 'all'
                              const visibleTaskAttachments =
                                normalizedTaskAttachmentFilter === 'all'
                                  ? taskAttachments
                                  : taskAttachments.filter(
                                      (attachment) =>
                                        attachment.attachmentType === normalizedTaskAttachmentFilter
                                    )
                              const taskComments = task ? (taskCommentsByTaskId[task.id] ?? []) : []
                              const taskLikeSummary = task
                                ? (taskLikeSummaryByTaskId[task.id] ?? {
                                    taskId: task.id,
                                    extractionId: task.extractionId,
                                    likesCount: 0,
                                    likedByMe: false,
                                    sharesCount: 0,
                                    sharedByMe: false,
                                    followersCount: 0,
                                    followingByMe: false,
                                    viewsCount: 0,
                                    viewedByMe: false,
                                  })
                                : null
                              const taskCommentDraft = task ? (taskCommentDraftByTaskId[task.id] ?? '') : ''
                              const taskReplyDraft = task ? (taskReplyDraftByTaskId[task.id] ?? '') : ''
                              const taskReplyParentCommentId = task
                                ? (taskReplyParentByTaskId[task.id] ?? null)
                                : null
                              const isTaskShareCopied = task
                                ? (taskShareCopiedByTaskId[task.id] ?? false)
                                : false
                              const taskCommunityError = task
                                ? (taskCommunityErrorByTaskId[task.id] ?? null)
                                : null
                              const isTaskCommunityLoading = task
                                ? taskCommunityLoadingId === task.id
                                : false
                              const isTaskCommunityMutating = task
                                ? taskCommunityMutationId === task.id
                                : false
                              const openSection = task
                                ? (taskOpenSectionByTaskId[task.id] ?? null)
                                : null
                              const isTaskActivityExpanded = openSection === 'actividad'
                              const isTaskGestionExpanded = openSection === 'gestion'
                              // Community shows only for the selected task, and only if not hidden by user
                              const isTaskSelected = task ? task.id === selectedTaskId : false
                              const isTaskCommunityExpanded =
                                isTaskSelected && (taskCommunityOpenByTaskId[task?.id ?? ''] ?? false)
                              // Evidence shows only for the selected task, and only if not hidden by user
                              const isTaskEvidenceExpanded =
                                isTaskSelected && (taskEvidenceOpenByTaskId[task?.id ?? ''] ?? false)
                              // Auto-fetch community the first time the selected task's community becomes visible
                              if (isTaskCommunityExpanded && task && !(task.id in taskCommentsByTaskId) && !autoFetchedCommunityRef.current.has(task.id)) {
                                autoFetchedCommunityRef.current.add(task.id)
                                void fetchTaskCommunity(task.id)
                              }
                              const isTaskAddEvidenceExpanded = task
                                ? (taskAddEvidenceExpandedByTaskId[task.id] ?? false)
                                : false
                              const taskActivityCount = task?.events.length ?? 0
                              const taskEvidenceCount = taskAttachments.length
                              const taskCommentCount = taskComments.length
                              const taskCommunityCount =
                                taskCommentCount +
                                (taskLikeSummary?.likesCount ?? 0) +
                                (taskLikeSummary?.sharesCount ?? 0) +
                                (taskLikeSummary?.followersCount ?? 0) +
                                (taskLikeSummary?.viewsCount ?? 0)

                              return (
                                <li
                                  key={`${phase.id}-${node.nodeId}`}
                                  id={task ? `task-${task.id}` : undefined}
                                  className={`relative flex flex-col overflow-hidden rounded-xl border bg-white/90 shadow-sm ring-1 transition-all duration-200 dark:bg-slate-900/70 ${
                                    isTaskSelected
                                      ? 'border-indigo-300 ring-indigo-200 shadow-md dark:border-indigo-600 dark:ring-indigo-900/50'
                                      : 'border-slate-200/90 ring-slate-200/70 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:ring-slate-700/70 dark:hover:border-slate-600'
                                  }`}
                                  style={{ marginLeft: `${Math.max(0, node.depth - 1) * 10}px` }}
                                >
                                  <span
                                    aria-hidden="true"
                                    className="hidden md:block absolute -left-[1.1rem] top-5 h-2.5 w-2.5 rounded-full border-2 border-indigo-400 bg-white dark:border-indigo-500 dark:bg-slate-900"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className={`absolute inset-y-0 left-0 w-1 ${
                                      isTaskSelected
                                        ? 'bg-indigo-400 dark:bg-indigo-500'
                                        : 'bg-slate-200/80 dark:bg-slate-700/80'
                                    }`}
                                  />
                                  <div className="order-1 p-3">
                                    {/* Content column — full width */}
                                    <div className="min-w-0">
                                      {/* Top bar: checkbox + index + stats | activity/evidence + status */}
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        {/* ── Left: checkbox · number · community stats ── */}
                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                          <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={task?.checked ?? false}
                                            disabled={!task || !canEditTaskContent || isTaskMutating}
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              if (!task) return
                                              void handleTaskToggle(task, !task.checked)
                                            }}
                                            className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border-2 shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                                              task?.checked
                                                ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                                                : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-indigo-500'
                                            }`}
                                          >
                                            <Check
                                              size={11}
                                              strokeWidth={3}
                                              className={`text-white transition-all duration-150 ${task?.checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                                            />
                                          </button>
                                          <span className="inline-flex h-6 w-fit min-w-[2.3rem] items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 font-mono text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                            {subItemNumber}
                                          </span>
                                          {/* Community micro-stats */}
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title={tx('playbook.like')}>
                                              <ThumbsUp size={10} />
                                              {taskLikeSummary?.likesCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title={tx('common.shared')}>
                                              <Share2 size={10} />
                                              {taskLikeSummary?.sharesCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title={tx('playbook.followers')}>
                                              <Bell size={10} />
                                              {taskLikeSummary?.followersCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title={tx('playbook.views')}>
                                              <Eye size={10} />
                                              {taskLikeSummary?.viewsCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title={tx('playbook.comments')}>
                                              <MessageSquare size={10} />
                                              {taskCommentCount}
                                            </span>
                                          </div>
                                        </div>
                                        {/* ── Right: activity · evidence · status ── */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          {task && taskActivityCount > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Actividad">
                                              <Zap size={10} />
                                              {taskActivityCount}
                                            </span>
                                          )}
                                          {task && taskEvidenceCount > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title={tx('playbook.evidence')}>
                                              <ImageIcon size={10} />
                                              {taskEvidenceCount}
                                            </span>
                                          )}
                                          {task && taskCommentCount > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title={tx('playbook.participants')}>
                                              <Users size={10} />
                                              {taskCommentCount}
                                            </span>
                                          )}
                                          {task && (
                                            <>
                                              {/* Mobile: icono compacto con color de estado */}
                                              <span
                                                className={`md:hidden inline-flex items-center justify-center rounded-full border p-[3px] ${getTaskStatusChipClassName(task.status)}`}
                                                title={getTaskStatusLabel(task.status, tx)}
                                              >
                                                {renderTaskStatusIcon(task.status, 10)}
                                              </span>
                                              {/* Desktop: chip con texto */}
                                              <span className={`hidden md:inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                                {getTaskStatusLabel(task.status, tx)}
                                              </span>
                                            </>
                                          )}
                                          {onFocusItemForChat && (
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                onFocusItemForChat({
                                                  path: node.fullPath,
                                                  text: typeof node.text === 'string' ? node.text : '',
                                                  phaseTitle: phase.title,
                                                })
                                              }}
                                              className="flex h-6 w-6 items-center justify-center rounded-full transition-all hover:scale-110 hover:shadow-md"
                                              aria-label="Preguntar al asistente sobre este ítem"
                                              title="Preguntar al asistente IA"
                                            >
                                              <img src="/notes-aide-bot.png" alt="" className="h-5 w-5 rounded-full object-cover" />
                                            </button>
                                          )}
                                          {task && (
                                            <div className="relative hidden md:block" data-task-menu-root="true">
                                              <button
                                                type="button"
                                                onClick={() => setTaskMenuOpenId((prev) => (prev === task.id ? null : task.id))}
                                                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                aria-label="Abrir acciones rápidas del ítem"
                                              >
                                                <MoreHorizontal size={12} />
                                              </button>
                                              {taskMenuOpenId === task.id && (
                                                <div className="absolute right-0 top-full z-20 mt-1 min-w-[130px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setTaskMenuOpenId(null)
                                                      if (isMobileTaskViewport()) {
                                                        openTaskDetailSheet(task.id, 'actividad')
                                                        return
                                                      }
                                                      focusTask(task.id)
                                                      setExclusiveTaskPanel(task.id, 'actividad')
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                                  >
                                                    <MessageSquare size={10} className="text-slate-400" />
                                                    Actividad
                                                    {task.events.length > 0 && (
                                                      <span className="ml-auto rounded-full bg-slate-100 px-1.5 text-[9px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                                        {task.events.length}
                                                      </span>
                                                    )}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setTaskMenuOpenId(null)
                                                      if (isMobileTaskViewport()) {
                                                        openTaskDetailSheet(task.id, 'gestion')
                                                        return
                                                      }
                                                      focusTask(task.id)
                                                      setExclusiveTaskPanel(task.id, 'gestion')
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                                  >
                                                    <Zap size={10} className="text-slate-400" />
                                                    {tx('playbook.management')}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setTaskMenuOpenId(null)
                                                      focusTask(task.id)
                                                      setExclusiveTaskPanel(task.id, 'evidencias')
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                                  >
                                                    <ImageIcon size={10} className="text-slate-400" />
                                                    {tx('playbook.evidence')}
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Text — click to focus this task and reveal quick actions */}
                                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_max-content] items-start gap-3">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!task) return
                                            if (isMobileTaskViewport()) {
                                              if (mobileSheetTaskId === task.id) {
                                                setMobileSheetTaskId(null)
                                              } else {
                                                openTaskDetailSheet(task.id, 'gestion')
                                              }
                                            } else {
                                              if (isTaskSelected) {
                                                setSelectedTaskId(null)
                                                setActiveTaskId(null)
                                                setExclusiveTaskPanel(task.id, null)
                                              } else {
                                                focusTask(task.id)
                                                setExclusiveTaskPanel(task.id, null)
                                              }
                                            }
                                          }}
                                          className={`w-full min-w-0 text-left rounded-lg px-1 py-0.5 transition-colors ${
                                            isTaskSelected
                                              ? 'bg-violet-50 dark:bg-violet-900/20'
                                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                          }`}
                                        >
                                          <span className="text-slate-600 leading-relaxed text-sm dark:text-slate-300">
                                            {itemDisplayText}
                                          </span>
                                        </button>

                                        {task ? renderTaskNumericValueField(task, 'desktop') : null}
                                      </div>

                                      {task && isTaskSelected && (
                                        <div className="mt-2 rounded-lg border border-slate-200/80 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-slate-800/40">
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                              {tx('playbook.subitemQuickActions')}
                                            </p>
                                            <span className="inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                              {tx('playbook.current')}
                                            </span>
                                          </div>
                                          <div className="mt-1.5 grid grid-cols-2 gap-1 md:grid-cols-4">
                                            <button
                                              type="button"
                                              aria-pressed={isTaskSelected && isTaskEvidenceExpanded}
                                              title={tx('playbook.evidence')}
                                              onClick={() => {
                                                if (isMobileTaskViewport()) {
                                                  openTaskDetailSheet(task.id, 'evidencias')
                                                  return
                                                }
                                                focusTask(task.id)
                                                setExclusiveTaskPanel(
                                                  task.id,
                                                  isTaskSelected && isTaskEvidenceExpanded ? null : 'evidencias'
                                                )
                                                if (taskEvidenceCount === 0) {
                                                  setTaskAddEvidenceExpandedByTaskId((prev) => ({
                                                    ...prev,
                                                    [task.id]: true,
                                                  }))
                                                }
                                              }}
                                              className={`inline-flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                                isTaskSelected && isTaskEvidenceExpanded
                                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                              }`}
                                            >
                                              <span className="inline-flex min-w-0 items-center gap-1">
                                                <ImageIcon size={11} />
                                                <span className="truncate">{tx('playbook.evidence')}</span>
                                              </span>
                                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {taskEvidenceCount}
                                              </span>
                                            </button>
                                            <button
                                              type="button"
                                              aria-pressed={isTaskActivityExpanded}
                                              title={tx('playbook.activity')}
                                              onClick={() => {
                                                if (isMobileTaskViewport()) {
                                                  openTaskDetailSheet(task.id, 'actividad')
                                                  return
                                                }
                                                focusTask(task.id)
                                                setExclusiveTaskPanel(
                                                  task.id,
                                                  isTaskActivityExpanded ? null : 'actividad'
                                                )
                                              }}
                                              className={`inline-flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                                isTaskActivityExpanded
                                                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                              }`}
                                            >
                                              <span className="inline-flex min-w-0 items-center gap-1">
                                                <Zap size={11} />
                                                <span className="truncate">{tx('playbook.activity')}</span>
                                              </span>
                                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {taskActivityCount}
                                              </span>
                                            </button>
                                            <button
                                              type="button"
                                              aria-pressed={isTaskGestionExpanded}
                                              title={tx('playbook.management')}
                                              onClick={() => {
                                                if (isMobileTaskViewport()) {
                                                  openTaskDetailSheet(task.id, 'gestion')
                                                  return
                                                }
                                                focusTask(task.id)
                                                setExclusiveTaskPanel(
                                                  task.id,
                                                  isTaskGestionExpanded ? null : 'gestion'
                                                )
                                              }}
                                              className={`inline-flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                                isTaskGestionExpanded
                                                  ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                              }`}
                                            >
                                              <span className="inline-flex min-w-0 items-center gap-1">
                                                <PenLine size={11} />
                                                <span className="truncate">{tx('playbook.management')}</span>
                                              </span>
                                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {getTaskStatusLabel(task.status, tx)}
                                              </span>
                                            </button>
                                            <button
                                              type="button"
                                              aria-pressed={isTaskSelected && isTaskCommunityExpanded}
                                              title={tx('playbook.community')}
                                              onClick={() => {
                                                if (isMobileTaskViewport()) {
                                                  openTaskDetailSheet(task.id, 'comunidad')
                                                  return
                                                }
                                                focusTask(task.id)
                                                setExclusiveTaskPanel(
                                                  task.id,
                                                  isTaskSelected && isTaskCommunityExpanded ? null : 'comunidad'
                                                )
                                              }}
                                              className={`inline-flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                                                isTaskSelected && isTaskCommunityExpanded
                                                  ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                              }`}
                                            >
                                              <span className="inline-flex min-w-0 items-center gap-1">
                                                <MessageSquare size={11} />
                                                <span className="truncate">{tx('playbook.community')}</span>
                                              </span>
                                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {taskCommunityCount}
                                              </span>
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {isTaskMutating && (
                                        <Loader2 size={14} className="mt-1 animate-spin text-indigo-500 dark:text-indigo-300" />
                                      )}
                                    </div>
                                  </div>{/* p-3 wrapper */}

                                  {/* Actividad inline collapsible (desktop only) */}
                                  <div
                                    aria-hidden={!isTaskActivityExpanded || !task}
                                    className={`order-2 hidden md:grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                                      isTaskActivityExpanded && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div
                                        className={`border-t border-slate-200 p-3 transition-transform duration-500 ease-out dark:border-slate-700 ${
                                          isTaskActivityExpanded && task
                                            ? 'translate-y-0'
                                            : '-translate-y-1 pointer-events-none'
                                        }`}
                                      >
                                        {task && (
                                          <>
                                            <div className="mb-2 flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() => setExclusiveTaskPanel(task.id, null)}
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                aria-label={tx('playbook.closeActivity')}
                                                title={tx('playbook.closeActivity')}
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                                              <p className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                {tx('playbook.logInActivity')}
                                              </p>
                                              <input
                                                type="text"
                                                value={eventDraftContent}
                                                onChange={(event) => setEventDraftContent(event.target.value)}
                                                onKeyDown={(event) => {
                                                  if (event.key === 'Enter' && !event.shiftKey && eventDraftContent.trim()) {
                                                    void handleAddTaskEvent(task, 'note')
                                                  }
                                                }}
                                                placeholder={tx('playbook.writeObservationActionBlocker')}
                                                disabled={!canEditTaskContent || isTaskMutating}
                                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                              />
                                              <div className="mt-2 flex flex-wrap gap-1.5">
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'note')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil size={11} />{getTaskEventTypeLabel('note', tx)}</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'pending_action')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"><Clock size={11} />{getTaskEventTypeLabel('pending_action', tx)}</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'blocker')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"><AlertTriangle size={11} />{getTaskEventTypeLabel('blocker', tx)}</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'resolved')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"><CheckCircle2 size={11} />{getTaskEventTypeLabel('resolved', tx)}</button>
                                              </div>
                                            </div>
                                            {task.events.length === 0 ? (
                                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {tx('playbook.noEventsYet')}
                                              </p>
                                            ) : (
                                              <ul className="space-y-2">
                                                {task.events.map((event) => (
                                                  <li
                                                    key={event.id}
                                                    className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                                                  >
                                                    <div className="flex items-start gap-2">
                                                      {event.eventType === 'blocker' ? (
                                                        <AlertTriangle size={13} className="mt-0.5 text-rose-500 dark:text-rose-300" />
                                                      ) : event.eventType === 'pending_action' ? (
                                                        <Clock size={13} className="mt-0.5 text-amber-500 dark:text-amber-400" />
                                                      ) : event.eventType === 'resolved' ? (
                                                        <CheckCircle2 size={13} className="mt-0.5 text-emerald-500 dark:text-emerald-400" />
                                                      ) : (
                                                        <Pencil size={13} className="mt-0.5 text-slate-400 dark:text-slate-500" />
                                                      )}
                                                      <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                          {getTaskEventTypeLabel(event.eventType, tx)}
                                                        </p>
                                                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                                          {event.content}
                                                        </p>
                                                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                                          <span className="font-medium text-slate-500 dark:text-slate-400">
                                                            {event.userName?.trim() || event.userEmail?.trim() || 'Usuario'}
                                                          </span>
                                                          {' · '}
                                                          {formatTaskEventDate(
                                                            event.createdAt,
                                                            localeTag,
                                                            tx('playbook.unknownDate')
                                                          )}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Gestión inline collapsible (desktop only) */}
                                  <div
                                    aria-hidden={!isTaskGestionExpanded || !task}
                                    className={`order-3 hidden md:grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                      isTaskGestionExpanded && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
                                        {task && (
                                          <>
                                            <div className="mb-2 flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() => setExclusiveTaskPanel(task.id, null)}
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                aria-label={tx('playbook.closeManagement')}
                                                title={tx('playbook.closeManagement')}
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                  {tx('playbook.statusLabel')}
                                                </span>
                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                                  {getTaskStatusLabel(task.status, tx)}
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-1.5 pt-2">
                                                {taskStatusOptions.map((option) => {
                                                  const isActive = task.status === option.value
                                                  return (
                                                    <button
                                                      key={option.value}
                                                      type="button"
                                                      onClick={() => void handleTaskStatusChange(task, option.value)}
                                                      disabled={!canEditTaskContent || isTaskMutating || isActive}
                                                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-all disabled:cursor-not-allowed ${
                                                        isActive
                                                          ? option.chipClassName + ' shadow-sm'
                                                          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:text-slate-300'
                                                      }`}
                                                    >
                                                      {renderTaskStatusIcon(option.value, 11)}
                                                      {option.label}
                                                    </button>
                                                  )
                                                })}
                                              </div>
                                              {renderTaskStatusCatalogSection(task, 'desktop')}
                                              {renderTaskNumericFormulaSection(task, 'desktop')}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Comunidad — solo visible cuando el ítem está seleccionado y el panel está abierto (desktop only) */}
                                  {isTaskSelected && task && isTaskCommunityExpanded && (
                                    <div className="order-5 hidden md:block border-t border-slate-100 dark:border-slate-800">
                                      {/* Header de comunidad visible solo mientras el panel está abierto */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 pb-1">
                                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExclusiveTaskPanel(
                                                task.id,
                                                isTaskCommunityExpanded ? null : 'comunidad'
                                              )
                                            }}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 transition-colors"
                                          >
                                            <MessageSquare size={12} />
                                            {tx('playbook.community')}
                                            {isTaskCommunityExpanded ? (
                                              <ChevronUp size={10} className="opacity-60" />
                                            ) : (
                                              <ChevronDown size={10} className="opacity-60" />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExclusiveTaskPanel(task.id, 'comunidad')
                                              handleCancelTaskReply(task.id)
                                            }}
                                            className="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                          >
                                            <MessageSquare size={11} />
                                            {tx('playbook.comment')}
                                            <span className="rounded bg-indigo-100/80 px-1 py-0.5 text-[10px] dark:bg-indigo-800/70">
                                              {taskCommentCount}
                                            </span>
                                          </button>
                                          {taskLikeSummary && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => void handleToggleTaskLike(task)}
                                                disabled={isTaskCommunityMutating}
                                                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                  taskLikeSummary.likedByMe
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50'
                                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <ThumbsUp size={11} />
                                                {tx('playbook.like')}
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.likesCount}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void handleShareTask(task)}
                                                disabled={isTaskCommunityMutating}
                                                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                  isTaskShareCopied
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
                                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <Share2 size={11} />
                                                {isTaskShareCopied ? tx('common.copied') : tx('common.share')}
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.sharesCount ?? 0}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void handleToggleTaskFollow(task)}
                                                disabled={isTaskCommunityMutating || isGuestExtraction}
                                                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                  taskLikeSummary.followingByMe
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50'
                                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <Bell size={11} />
                                                {taskLikeSummary.followingByMe
                                                  ? tx('playbook.following')
                                                  : tx('playbook.follow')}
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.followersCount ?? 0}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void fetchTaskCommunity(task.id)}
                                                disabled={isTaskCommunityLoading || isTaskCommunityMutating}
                                                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                                              >
                                                <Eye size={11} />
                                                {tx('playbook.views')}
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.viewsCount ?? 0}
                                                </span>
                                              </button>
                                            </>
                                          )}
                                        </div>
                                        {(isTaskCommunityLoading || isTaskCommunityMutating) && (
                                          <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            <Loader2 size={12} className="animate-spin" />
                                            {tx('playbook.updating')}
                                          </p>
                                        )}
                                      </div>

                                      {/* Contenido colapsable */}
                                      <div
                                        aria-hidden={!isTaskCommunityExpanded}
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                          isTaskCommunityExpanded
                                            ? 'grid-rows-[1fr] opacity-100'
                                            : 'grid-rows-[0fr] opacity-0'
                                        }`}
                                      >
                                        <div className="overflow-hidden">
                                          <div className="px-3 pb-3">
                                            {taskCommunityError && (
                                              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                                                {taskCommunityError}
                                              </p>
                                            )}

                                            <div className="mt-2 flex gap-2">
                                              <input
                                                type="text"
                                                value={taskCommentDraft}
                                                onChange={(event) =>
                                                  handleTaskCommentDraftChange(task.id, event.target.value)
                                                }
                                                placeholder={tx('playbook.writeCommentForSubitem')}
                                                disabled={isTaskCommunityMutating}
                                                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => void handleAddTaskComment(task)}
                                                disabled={isTaskCommunityMutating || taskCommentDraft.trim().length === 0}
                                                className="inline-flex h-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                              >
                                                {tx('playbook.comment')}
                                              </button>
                                            </div>

                                            {isTaskCommunityLoading ? (
                                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                {tx('common.loading')}
                                              </p>
                                            ) : taskComments.length === 0 ? (
                                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                {tx('playbook.noCommentsYetForSubitem')}
                                              </p>
                                            ) : (
                                              renderTaskCommentThread({
                                                task,
                                                comments: taskComments,
                                                isCommunityMutating: isTaskCommunityMutating,
                                                replyParentCommentId: taskReplyParentCommentId,
                                                replyDraft: taskReplyDraft,
                                                compact: false,
                                              })
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Evidencias inline collapsible (desktop only) */}
                                  <div
                                    aria-hidden={!isTaskSelected || !task || !isTaskEvidenceExpanded}
                                    className={`order-4 hidden md:grid transition-[grid-template-rows,opacity] duration-700 ease-out ${
                                      isTaskSelected && task && isTaskEvidenceExpanded
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div
                                        className={`border-t border-slate-200 bg-slate-100/60 p-3 transition-transform duration-700 ease-out dark:border-slate-700 dark:bg-slate-900/80 ${
                                          isTaskSelected && task && isTaskEvidenceExpanded
                                            ? 'translate-y-0'
                                            : '-translate-y-2 pointer-events-none'
                                        }`}
                                      >
                                        {task && (
                                          <>
                                            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 pb-3 pt-3 dark:border-slate-700 dark:bg-slate-900/70">

                                              {taskAttachmentError && (
                                                <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                                                  {taskAttachmentError}
                                                </p>
                                              )}

                                              <div className="mt-3 flex items-center justify-between gap-3">
                                                <div>
                                                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                                    {tx('playbook.evidenceLibrary')}
                                                  </p>
                                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                    {taskAttachments.length > 0
                                                      ? `${taskAttachments.length} ${tx('playbook.evidence').toLowerCase()}`
                                                      : tx('playbook.evidenceEmptyHint')}
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setTaskAddEvidenceExpandedByTaskId((prev) => ({
                                                      ...prev,
                                                      [task.id]: !isTaskAddEvidenceExpanded,
                                                    }))
                                                  }
                                                disabled={!canEditTaskContent}
                                                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/10 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
                                                >
                                                  <Plus size={12} className="text-indigo-600 dark:text-indigo-400" />
                                                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                                    {tx('playbook.addEvidence')}
                                                  </span>
                                                  {isTaskAddEvidenceExpanded ? (
                                                    <ChevronUp size={13} className="text-indigo-400" />
                                                  ) : (
                                                    <ChevronDown size={13} className="text-indigo-400" />
                                                  )}
                                                </button>
                                              </div>

                                              {taskAttachments.length === 0 && !isTaskAddEvidenceExpanded && (
                                                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
                                                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    {tx('playbook.evidenceEmptyTitle')}
                                                  </p>
                                                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {tx('playbook.evidenceEmptyHint')}
                                                  </p>
                                                  <div className="mt-3 flex flex-wrap gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSelectTaskEvidenceMode(task.id, 'file')}
                                                      disabled={!canEditTaskContent}
                                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                    >
                                                      <Upload size={12} />
                                                      {tx('playbook.evidenceSourceFile')}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSelectTaskEvidenceMode(task.id, 'note')}
                                                      disabled={!canEditTaskContent}
                                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                    >
                                                      <Pencil size={12} />
                                                      {tx('playbook.evidenceSourceNote')}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSelectTaskEvidenceMode(task.id, 'youtube')}
                                                      disabled={!canEditTaskContent}
                                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                    >
                                                      <Link2 size={12} />
                                                      {tx('playbook.evidenceSourceYoutube')}
                                                    </button>
                                                  </div>
                                                </div>
                                              )}

                                              <div
                                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                                  isTaskAddEvidenceExpanded
                                                    ? 'grid-rows-[1fr] opacity-100'
                                                    : 'grid-rows-[0fr] opacity-0'
                                                }`}
                                              >
                                                <div className="overflow-hidden">
                                                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
                                                    <div className="grid gap-2 md:grid-cols-3">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleSelectTaskEvidenceMode(task.id, 'file')}
                                                        disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                                          taskEvidenceComposerMode === 'file'
                                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <Upload size={14} />
                                                          <span className="text-xs font-semibold">{tx('playbook.evidenceSourceFile')}</span>
                                                        </div>
                                                        <p className="mt-1 text-[11px] opacity-80">
                                                          {tx('playbook.evidenceSourceFileHint')}
                                                        </p>
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleSelectTaskEvidenceMode(task.id, 'note')}
                                                        disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                                          taskEvidenceComposerMode === 'note'
                                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <Pencil size={14} />
                                                          <span className="text-xs font-semibold">{tx('playbook.evidenceSourceNote')}</span>
                                                        </div>
                                                        <p className="mt-1 text-[11px] opacity-80">
                                                          {tx('playbook.evidenceSourceNoteHint')}
                                                        </p>
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleSelectTaskEvidenceMode(task.id, 'youtube')}
                                                        disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                                          taskEvidenceComposerMode === 'youtube'
                                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <Link2 size={14} />
                                                          <span className="text-xs font-semibold">{tx('playbook.evidenceSourceYoutube')}</span>
                                                        </div>
                                                        <p className="mt-1 text-[11px] opacity-80">
                                                          {tx('playbook.evidenceSourceYoutubeHint')}
                                                        </p>
                                                      </button>
                                                    </div>

                                                    <input
                                                      ref={(node) => {
                                                        taskFileInputRefs.current[task.id] = node
                                                      }}
                                                      type="file"
                                                      accept=".pdf,application/pdf,image/*,audio/*"
                                                      className="hidden"
                                                      disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                      onChange={(event) => {
                                                        handleTaskFileCandidate(
                                                          task.id,
                                                          event.target.files?.[0] ?? null
                                                        )
                                                      }}
                                                    />

                                                    {taskEvidenceComposerMode === 'file' ? (
                                                      <div className="mt-3 space-y-3">
                                                        <button
                                                          type="button"
                                                          onClick={() => handleOpenTaskFilePicker(task.id)}
                                                          onDragOver={(event) => {
                                                            event.preventDefault()
                                                            if (!canEditTaskContent || isTaskAttachmentMutating) return
                                                            setTaskFileDropTargetId(task.id)
                                                          }}
                                                          onDragLeave={(event) => {
                                                            event.preventDefault()
                                                            if (
                                                              event.currentTarget.contains(
                                                                event.relatedTarget as Node | null
                                                              )
                                                            ) {
                                                              return
                                                            }
                                                            setTaskFileDropTargetId((previous) =>
                                                              previous === task.id ? null : previous
                                                            )
                                                          }}
                                                          onDrop={(event) => {
                                                            event.preventDefault()
                                                            setTaskFileDropTargetId((previous) =>
                                                              previous === task.id ? null : previous
                                                            )
                                                            handleTaskFileCandidate(
                                                              task.id,
                                                              event.dataTransfer.files?.[0] ?? null
                                                            )
                                                          }}
                                                          disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                          className={`flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
                                                            isTaskFileDropTarget
                                                              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                              : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                                                          } disabled:cursor-not-allowed disabled:opacity-60`}
                                                        >
                                                          <Upload size={18} />
                                                          <p className="mt-2 text-sm font-semibold">
                                                            {tx('playbook.evidenceDropTitle')}
                                                          </p>
                                                          <p className="mt-1 text-xs opacity-80">
                                                            {tx('playbook.evidenceDropHint')}
                                                          </p>
                                                        </button>

                                                        {pendingTaskFile && (
                                                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                                                            <div className="flex items-start justify-between gap-3">
                                                              <div className="min-w-0">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                  {tx('playbook.evidenceSelectedFile')}
                                                                </p>
                                                                <p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                                  {pendingTaskFile.name}
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                  {formatAttachmentSize(pendingTaskFile.size) ?? tx('playbook.evidenceSourceFile')}
                                                                </p>
                                                              </div>
                                                              <div className="flex flex-wrap justify-end gap-2">
                                                                <button
                                                                  type="button"
                                                                  onClick={() => handleOpenTaskFilePicker(task.id)}
                                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                                >
                                                                  {tx('playbook.evidenceChooseAnotherFile')}
                                                                </button>
                                                                <button
                                                                  type="button"
                                                                  onClick={() => clearPendingTaskFile(task.id)}
                                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                                >
                                                                  {tx('playbook.evidenceRemovePendingFile')}
                                                                </button>
                                                                <button
                                                                  type="button"
                                                                  onClick={() => void handleUploadPendingTaskFile(task)}
                                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                                >
                                                                  <Upload size={11} />
                                                                  {tx('playbook.evidenceUploadFile')}
                                                                </button>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    ) : taskEvidenceComposerMode === 'note' ? (
                                                      <div className="mt-3 space-y-1.5">
                                                        <textarea
                                                          value={noteDraftByTaskId[task.id] ?? ''}
                                                          onChange={(event) =>
                                                            setNoteDraftByTaskId((previous) => ({
                                                              ...previous,
                                                              [task.id]: event.target.value,
                                                            }))
                                                          }
                                                          placeholder={tx('playbook.task.notePlaceholder')}
                                                          disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                          style={{ minHeight: '5.25rem' }}
                                                          onInput={(event) => {
                                                            const el = event.currentTarget
                                                            el.style.height = 'auto'
                                                            el.style.height = `${el.scrollHeight}px`
                                                          }}
                                                          className="w-full resize-none overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/40"
                                                        />
                                                        <div className="flex justify-end">
                                                          <button
                                                            type="button"
                                                            onClick={() => void handleAddTaskNote(task)}
                                                            disabled={
                                                              !canEditTaskContent ||
                                                              isTaskAttachmentMutating ||
                                                              !(noteDraftByTaskId[task.id] ?? '').trim()
                                                            }
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                          >
                                                            <Save size={11} />
                                                            {tx('playbook.task.saveNote')}
                                                          </button>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <div className="mt-3 space-y-1.5">
                                                        <div className="flex gap-2">
                                                          <input
                                                            type="text"
                                                            value={taskYoutubeDraft}
                                                            onChange={(event) =>
                                                              handleTaskYoutubeDraftChange(task.id, event.target.value)
                                                            }
                                                            placeholder={tx('playbook.evidenceYoutubePlaceholder')}
                                                            disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                            className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800"
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() => void handleAddTaskYoutubeLink(task)}
                                                            disabled={
                                                              !canEditTaskContent ||
                                                              isTaskAttachmentMutating ||
                                                              taskYoutubeDraft.trim().length === 0
                                                            }
                                                            className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                          >
                                                            <Plus size={11} />
                                                            {tx('common.add')}
                                                          </button>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              {isTaskAttachmentLoading ? (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                  {tx('common.loading')}
                                                </p>
                                              ) : taskAttachments.length === 0 ? (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                  {tx('playbook.subitemHasNoEvidenceYet')}
                                                </p>
                                              ) : (
                                                <>
                                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {taskAttachmentFilterOptions.map((option) => {
                                                      const isActive = normalizedTaskAttachmentFilter === option.key
                                                      return (
                                                        <button
                                                          key={option.key}
                                                          type="button"
                                                          onClick={() =>
                                                            setTaskAttachmentFilterByTaskId((previous) => ({
                                                              ...previous,
                                                              [task.id]: option.key,
                                                            }))
                                                          }
                                                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                                                            isActive
                                                              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                                                          }`}
                                                        >
                                                          {option.label}
                                                          <span className="ml-1 opacity-70">{option.count}</span>
                                                        </button>
                                                      )
                                                    })}
                                                  </div>

                                                  {visibleTaskAttachments.length === 0 ? (
                                                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                                      {tx('playbook.subitemHasNoEvidenceYet')}
                                                    </p>
                                                  ) : (
                                                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                  {visibleTaskAttachments.map((attachment) => {
                                                    const attachmentLabel = getAttachmentTypeLabel(
                                                      attachment.attachmentType,
                                                      tx
                                                    )
                                                    const attachmentSize = formatAttachmentSize(
                                                      attachment.sizeBytes
                                                    )
                                                    const previewUrl =
                                                      attachment.attachmentType === 'image' ||
                                                      attachment.attachmentType === 'youtube_link'
                                                        ? attachment.thumbnailUrl || attachment.url
                                                        : resolvePdfPreviewUrl(attachment)

                                                    const isNote = attachment.attachmentType === 'note'
                                                    const noteContent =
                                                      isNote
                                                        ? (attachment.metadata?.content as string | undefined) ??
                                                          attachment.title ??
                                                          ''
                                                        : ''

                                                    return (
                                                      <li
                                                        key={attachment.id}
                                                        className="relative group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                                                      >
                                                        {isNote ? (
                                                          <div className="flex-1 bg-amber-50 px-3 py-2.5 dark:bg-amber-950/20">
                                                            <p className="line-clamp-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                                                              {noteContent || tx('playbook.emptyNote')}
                                                            </p>
                                                          </div>
                                                        ) : previewUrl ? (
                                                          <a
                                                            href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
                                                          >
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                              src={previewUrl}
                                                              alt={attachment.title || attachmentLabel}
                                                              className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                                                            />
                                                          </a>
                                                        ) : (
                                                          <div className="flex aspect-video w-full items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                                            {attachment.attachmentType === 'audio' ? (
                                                              <Music2 size={22} />
                                                            ) : attachment.attachmentType === 'youtube_link' ? (
                                                              <Link2 size={22} />
                                                            ) : attachment.attachmentType === 'image' ? (
                                                              <ImageIcon size={22} />
                                                            ) : (
                                                              <FileText size={22} />
                                                            )}
                                                          </div>
                                                        )}

                                                        <div className="flex flex-shrink-0 flex-col p-2">
                                                          {!isNote && (
                                                            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                              {attachment.title?.trim() ||
                                                                attachment.url ||
                                                                attachmentLabel}
                                                            </p>
                                                          )}
                                                          <div className={`flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 ${isNote ? '' : 'mt-1'}`}>
                                                            <span className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">
                                                              {attachmentLabel}
                                                            </span>
                                                            {attachmentSize && <span>{attachmentSize}</span>}
                                                          </div>
                                                          <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-slate-500">
                                                            {attachment.userName?.trim() || attachment.userEmail?.trim() || 'Usuario'}
                                                            {' · '}
                                                            {formatTaskEventDate(
                                                              attachment.createdAt,
                                                              localeTag,
                                                              tx('playbook.unknownDate')
                                                            )}
                                                          </p>
                                                          {attachment.attachmentType === 'audio' && (
                                                            <audio
                                                              controls
                                                              preload="none"
                                                              src={attachment.url}
                                                              className="mt-2 w-full"
                                                            />
                                                          )}
                                                        </div>

                                                        {/* Botón flotante ··· */}
                                                        <div className="absolute right-1.5 top-1.5 z-30">
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setOpenAttachmentMenuId((previous) =>
                                                                previous === attachment.id ? null : attachment.id
                                                              )
                                                            }
                                                            className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all duration-150 ${
                                                              isNote
                                                                ? openAttachmentMenuId === attachment.id
                                                                  ? 'bg-amber-800/70 text-white'
                                                                  : 'bg-amber-800/25 text-amber-900 opacity-70 hover:bg-amber-800/45 hover:opacity-100 group-hover:opacity-100 dark:bg-amber-200/20 dark:text-amber-200'
                                                                : openAttachmentMenuId === attachment.id
                                                                  ? 'bg-black/70 text-white backdrop-blur-sm'
                                                                  : 'bg-black/30 text-white opacity-60 hover:bg-black/55 hover:opacity-100 group-hover:opacity-100 backdrop-blur-sm'
                                                            }`}
                                                            aria-label={tx('playbook.evidenceMenuLabel')}
                                                          >
                                                            <MoreHorizontal size={13} />
                                                          </button>

                                                          {openAttachmentMenuId === attachment.id && (
                                                            <>
                                                              <div
                                                                className="fixed inset-0 z-40"
                                                                aria-hidden="true"
                                                                onClick={() => setOpenAttachmentMenuId(null)}
                                                              />
                                                              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                                                {!isNote && (
                                                                  <>
                                                                    <a
                                                                      href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                                                      target="_blank"
                                                                      rel="noreferrer"
                                                                      onClick={() => setOpenAttachmentMenuId(null)}
                                                                      className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                    >
                                                                      <ExternalLink size={13} className="flex-shrink-0 text-slate-400" />
                                                                      {tx('playbook.source.openInNewTab')}
                                                                    </a>
                                                                    <a
                                                                      href={attachment.url}
                                                                      download
                                                                      onClick={() => setOpenAttachmentMenuId(null)}
                                                                      className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                    >
                                                                      <Download size={13} className="flex-shrink-0 text-slate-400" />
                                                                      {tx('playbook.source.download')}
                                                                    </a>
                                                                  </>
                                                                )}
                                                                <button
                                                                  type="button"
                                                                  onClick={() => {
                                                                    handleCopyAttachmentLink(
                                                                      attachment.id,
                                                                      isNote ? noteContent : attachment.url
                                                                    )
                                                                    setOpenAttachmentMenuId(null)
                                                                  }}
                                                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                >
                                                                  {copiedAttachmentId === attachment.id ? (
                                                                    <>
                                                                      <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-500" />
                                                                      <span className="text-emerald-600 dark:text-emerald-400">
                                                                        {tx('common.copied')}
                                                                      </span>
                                                                    </>
                                                                  ) : (
                                                                    <>
                                                                      <Share2 size={13} className="flex-shrink-0 text-slate-400" />
                                                                      {isNote
                                                                        ? tx('playbook.copyNote')
                                                                        : tx('playbook.shareLink')}
                                                                    </>
                                                                  )}
                                                                </button>
                                                                <div className="mx-3 border-t border-slate-100 dark:border-slate-800" />
                                                                <button
                                                                  type="button"
                                                                  onClick={() => {
                                                                    setOpenAttachmentMenuId(null)
                                                                    void handleDeleteTaskAttachment(task, attachment)
                                                                  }}
                                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-900/20"
                                                                >
                                                                  <Trash2 size={13} className="flex-shrink-0" />
                                                                  {tx('playbook.removeEvidence')}
                                                                </button>
                                                              </div>
                                                            </>
                                                          )}
                                                        </div>
                                                      </li>
                                                    )
                                                  })}
                                                </ul>
                                                  )}
                                                </>
                                              )}
                                            </div>{/* Evidencias card */}

                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleCopyPhase(phase)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              {copiedPhaseId === phase.id ? (
                                <><Check size={11} className="text-emerald-500" /> {tx('common.copied')}</>
                              ) : (
                                <><Copy size={11} /> {tx('playbook.copyPhase')}</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        <div className="mx-6 mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-4 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="text-amber-500 flex-shrink-0 mt-1 dark:text-amber-300">
            <Zap size={24} fill="currentColor" className="opacity-20" />
          </div>
          <div>
            <h4 className="font-bold text-amber-800 mb-1 text-sm dark:text-amber-200">
              {tx('playbook.proTipTitle')}
            </h4>
            <p className="text-sm text-amber-700 leading-relaxed italic dark:text-amber-300">
              &ldquo;{result.proTip}&rdquo;
            </p>
          </div>
        </div>

        <div className="mx-6 mb-5 mt-1 flex justify-end">
          <p
            title={`${tx('playbook.ownerTitle')}: ${playbookOwnerSignature}`}
            className="paper-playbook-owner-signature"
          >
            {playbookOwnerSignature}
          </p>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════
          MOBILE BOTTOM SHEET — sub-item detail (md:hidden)
          ══════════════════════════════════════════════════ */}
      {(() => {
        if (!mobileSheetTaskId) return null
        const sheetTask = interactiveTasks.find((t) => t.id === mobileSheetTaskId) ?? null
        if (!sheetTask) return null

        const sheetTaskAttachments = taskAttachmentsByTaskId[sheetTask.id] ?? []
        const sheetTaskAttachmentError = taskAttachmentErrorByTaskId[sheetTask.id] ?? null
        const sheetTaskAttachmentFilter = taskAttachmentFilterByTaskId[sheetTask.id] ?? 'all'
        const sheetEvidenceComposerMode = taskEvidenceComposerModeByTaskId[sheetTask.id] ?? 'file'
        const sheetPendingTaskFile = pendingTaskFileByTaskId[sheetTask.id] ?? null
        const sheetTaskYoutubeDraft = youtubeAttachmentDraftByTaskId[sheetTask.id] ?? ''
        const sheetIsAttachmentLoading = taskAttachmentLoadingId === sheetTask.id
        const sheetIsAttachmentMutating = taskAttachmentMutationId === sheetTask.id
        const sheetIsFileDropTarget = taskFileDropTargetId === sheetTask.id
        const sheetAttachmentFilterOptions = buildAttachmentFilterOptions(sheetTaskAttachments, tx)
        const normalizedSheetAttachmentFilter = sheetAttachmentFilterOptions.some(
          (option) => option.key === sheetTaskAttachmentFilter
        )
          ? sheetTaskAttachmentFilter
          : 'all'
        const visibleSheetTaskAttachments =
          normalizedSheetAttachmentFilter === 'all'
            ? sheetTaskAttachments
            : sheetTaskAttachments.filter(
                (attachment) => attachment.attachmentType === normalizedSheetAttachmentFilter
              )
        const sheetTaskComments = taskCommentsByTaskId[sheetTask.id] ?? []
        const sheetTaskLikeSummary = taskLikeSummaryByTaskId[sheetTask.id] ?? {
          taskId: sheetTask.id,
          extractionId: sheetTask.extractionId,
          likesCount: 0,
          likedByMe: false,
          sharesCount: 0,
          sharedByMe: false,
          followersCount: 0,
          followingByMe: false,
          viewsCount: 0,
          viewedByMe: false,
        }
        const sheetCommentDraft = taskCommentDraftByTaskId[sheetTask.id] ?? ''
        const sheetReplyDraft = taskReplyDraftByTaskId[sheetTask.id] ?? ''
        const sheetReplyParentCommentId = taskReplyParentByTaskId[sheetTask.id] ?? null
        const sheetIsShareCopied = taskShareCopiedByTaskId[sheetTask.id] ?? false
        const sheetCommunityError = taskCommunityErrorByTaskId[sheetTask.id] ?? null
        const sheetIsCommunityLoading = taskCommunityLoadingId === sheetTask.id
        const sheetIsCommunityMutating = taskCommunityMutationId === sheetTask.id
        const sheetIsTaskMutating = taskMutationLoadingId === sheetTask.id
        const sheetAddEvidenceExpanded = taskAddEvidenceExpandedByTaskId[sheetTask.id] ?? false
        const sheetNoteContent = noteDraftByTaskId[sheetTask.id] ?? ''
        const sheetTaskDisplayText =
          typeof sheetTask.itemText === 'string'
            ? sheetTask.itemText.trim()
              ? renderTextWithPlaybookReferences(sheetTask.itemText)
              : tx('playbook.subitemWithoutText')
            : sheetTask.itemText == null
              ? tx('playbook.subitemWithoutText')
              : renderTextWithPlaybookReferences(String(sheetTask.itemText))

        const TABS = [
          { key: 'gestion', label: tx('playbook.management') },
          { key: 'actividad', label: tx('playbook.activity') },
          { key: 'evidencias', label: tx('playbook.evidence') },
          { key: 'comunidad', label: tx('playbook.community') },
        ] as const

        return createPortal(
            <div
              className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-900 md:hidden"
            >
              {/* Header */}
              <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {sheetTask.positionPath?.trim() || `${sheetTask.phaseId}.${sheetTask.itemIndex + 1}`}
                    <span className={`ml-2 rounded-md border px-1.5 py-0.5 text-[10px] ${getTaskStatusChipClassName(sheetTask.status)}`}>
                      {getTaskStatusLabel(sheetTask.status, tx)}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {sheetTaskDisplayText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSheetTaskId(null)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMobileSheetTab(tab.key)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                      mobileSheetTab === tab.key
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scrollable content */}
              <div key={`${mobileSheetTaskId}-${mobileSheetTab}`} className="flex-1 overflow-y-auto overscroll-contain p-4">

                {/* ── TAB: GESTIÓN ── */}
                {mobileSheetTab === 'gestion' && (
                  <div className="space-y-4">
                    {/* Checkbox + Estado */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={sheetTask.checked}
                        disabled={!canEditTaskContent || sheetIsTaskMutating}
                        onClick={() => void handleTaskToggle(sheetTask, !sheetTask.checked)}
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] border-2 shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                          sheetTask.checked
                            ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                            : 'border-slate-300 bg-white hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900'
                        }`}
                      >
                        <Check
                          size={13}
                          strokeWidth={3}
                          className={`text-white transition-all duration-150 ${sheetTask.checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                        />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {sheetTask.checked
                          ? tx('playbook.markedAsCompleted')
                          : tx('playbook.pendingToComplete')}
                      </span>
                    </div>

                    {renderTaskNumericValueField(sheetTask, 'mobile')}
                    {renderTaskNumericFormulaSection(sheetTask, 'mobile')}

                    {/* Estado selector */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {tx('playbook.statusLabel')}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusChipClassName(sheetTask.status)}`}>
                          {getTaskStatusLabel(sheetTask.status, tx)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {taskStatusOptions.map((option) => {
                          const isActive = sheetTask.status === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => void handleTaskStatusChange(sheetTask, option.value)}
                              disabled={!canEditTaskContent || sheetIsTaskMutating || isActive}
                              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                                isActive
                                  ? option.chipClassName + ' shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                              }`}
                            >
                              {renderTaskStatusIcon(option.value, 13)}
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                      {renderTaskStatusCatalogSection(sheetTask, 'mobile')}
                    </div>

                  </div>
                )}

                {/* ── TAB: ACTIVIDAD ── */}
                {mobileSheetTab === 'actividad' && (
                  <div>
                    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {tx('playbook.logInActivity')}
                      </p>
                      <input
                        type="text"
                        value={eventDraftContent}
                        onChange={(event) => setEventDraftContent(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey && eventDraftContent.trim()) {
                            void handleAddTaskEvent(sheetTask, 'note')
                          }
                        }}
                        placeholder={tx('playbook.writeObservationActionBlocker')}
                        disabled={!canEditTaskContent || sheetIsTaskMutating}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                      />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'note')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil size={12} />{getTaskEventTypeLabel('note', tx)}</button>
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'pending_action')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><Clock size={12} />{getTaskEventTypeLabel('pending_action', tx)}</button>
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'blocker')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"><AlertTriangle size={12} />{getTaskEventTypeLabel('blocker', tx)}</button>
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'resolved')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"><CheckCircle2 size={12} />{getTaskEventTypeLabel('resolved', tx)}</button>
                      </div>
                    </div>
                    {sheetTask.events.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {tx('playbook.noEventsYet')}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {sheetTask.events.map((event) => (
                          <li
                            key={event.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                          >
                            <div className="flex items-start gap-3">
                              {event.eventType === 'blocker' ? (
                                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-rose-500 dark:text-rose-300" />
                              ) : event.eventType === 'pending_action' ? (
                                <Clock size={14} className="mt-0.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                              ) : event.eventType === 'resolved' ? (
                                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Pencil size={14} className="mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  {getTaskEventTypeLabel(event.eventType, tx)}
                                </p>
                                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                  {event.content}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  <span className="font-medium text-slate-500 dark:text-slate-400">
                                    {event.userName?.trim() || event.userEmail?.trim() || 'Usuario'}
                                  </span>
                                  {' · '}
                                  {formatTaskEventDate(
                                    event.createdAt,
                                    localeTag,
                                    tx('playbook.unknownDate')
                                  )}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* ── TAB: EVIDENCIAS ── */}
                {mobileSheetTab === 'evidencias' && (
                  <div>
                    {sheetTaskAttachmentError && (
                      <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                        {sheetTaskAttachmentError}
                      </p>
                    )}

                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {tx('playbook.evidenceLibrary')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {sheetTaskAttachments.length > 0
                            ? `${sheetTaskAttachments.length} ${tx('playbook.evidence').toLowerCase()}`
                            : tx('playbook.evidenceEmptyHint')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTaskAddEvidenceExpandedByTaskId((prev) => ({
                            ...prev,
                            [sheetTask.id]: !sheetAddEvidenceExpanded,
                          }))
                        }
                        disabled={!canEditTaskContent}
                        className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2 transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-900/10"
                      >
                        <Plus size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {tx('playbook.addEvidence')}
                        </span>
                        {sheetAddEvidenceExpanded ? <ChevronUp size={13} className="text-indigo-400" /> : <ChevronDown size={13} className="text-indigo-400" />}
                      </button>
                    </div>

                    {sheetTaskAttachments.length === 0 && !sheetAddEvidenceExpanded && (
                      <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {tx('playbook.evidenceEmptyTitle')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {tx('playbook.evidenceEmptyHint')}
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => handleSelectTaskEvidenceMode(sheetTask.id, 'file')} disabled={!canEditTaskContent} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"><Upload size={12} />{tx('playbook.evidenceSourceFile')}</button>
                          <button type="button" onClick={() => handleSelectTaskEvidenceMode(sheetTask.id, 'note')} disabled={!canEditTaskContent} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"><Pencil size={12} />{tx('playbook.evidenceSourceNote')}</button>
                          <button type="button" onClick={() => handleSelectTaskEvidenceMode(sheetTask.id, 'youtube')} disabled={!canEditTaskContent} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"><Link2 size={12} />{tx('playbook.evidenceSourceYoutube')}</button>
                        </div>
                      </div>
                    )}

                    {sheetAddEvidenceExpanded && (
                      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => handleSelectTaskEvidenceMode(sheetTask.id, 'file')} disabled={!canEditTaskContent || sheetIsAttachmentMutating} className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition-colors ${sheetEvidenceComposerMode === 'file' ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'} disabled:opacity-60`}><Upload size={12} className="mx-auto mb-1" />{tx('playbook.evidenceSourceFile')}</button>
                          <button type="button" onClick={() => handleSelectTaskEvidenceMode(sheetTask.id, 'note')} disabled={!canEditTaskContent || sheetIsAttachmentMutating} className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition-colors ${sheetEvidenceComposerMode === 'note' ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'} disabled:opacity-60`}><Pencil size={12} className="mx-auto mb-1" />{tx('playbook.evidenceSourceNote')}</button>
                          <button type="button" onClick={() => handleSelectTaskEvidenceMode(sheetTask.id, 'youtube')} disabled={!canEditTaskContent || sheetIsAttachmentMutating} className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition-colors ${sheetEvidenceComposerMode === 'youtube' ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'} disabled:opacity-60`}><Link2 size={12} className="mx-auto mb-1" />{tx('playbook.evidenceSourceYoutube')}</button>
                        </div>

                        <input
                          ref={(node) => { taskFileInputRefs.current[sheetTask.id] = node }}
                          type="file"
                          accept=".pdf,application/pdf,image/*,audio/*"
                          className="hidden"
                          disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                          onChange={(event) => {
                            handleTaskFileCandidate(sheetTask.id, event.target.files?.[0] ?? null)
                          }}
                        />

                        {sheetEvidenceComposerMode === 'file' ? (
                          <div className="mt-3 space-y-3">
                            <button
                              type="button"
                              onClick={() => handleOpenTaskFilePicker(sheetTask.id)}
                              onDragOver={(event) => {
                                event.preventDefault()
                                if (!canEditTaskContent || sheetIsAttachmentMutating) return
                                setTaskFileDropTargetId(sheetTask.id)
                              }}
                              onDragLeave={(event) => {
                                event.preventDefault()
                                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                                setTaskFileDropTargetId((previous) => (previous === sheetTask.id ? null : previous))
                              }}
                              onDrop={(event) => {
                                event.preventDefault()
                                setTaskFileDropTargetId((previous) => (previous === sheetTask.id ? null : previous))
                                handleTaskFileCandidate(sheetTask.id, event.dataTransfer.files?.[0] ?? null)
                              }}
                              disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                              className={`flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                                sheetIsFileDropTarget
                                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-300'
                                  : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                              } disabled:opacity-60`}
                            >
                              <Upload size={18} />
                              <p className="mt-2 text-sm font-semibold">{tx('playbook.evidenceDropTitle')}</p>
                              <p className="mt-1 text-xs opacity-80">{tx('playbook.evidenceDropHint')}</p>
                            </button>

                            {sheetPendingTaskFile && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {tx('playbook.evidenceSelectedFile')}
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {sheetPendingTaskFile.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {formatAttachmentSize(sheetPendingTaskFile.size) ?? tx('playbook.evidenceSourceFile')}
                                </p>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  <button type="button" onClick={() => handleOpenTaskFilePicker(sheetTask.id)} disabled={!canEditTaskContent || sheetIsAttachmentMutating} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{tx('playbook.evidenceChooseAnotherFile')}</button>
                                  <button type="button" onClick={() => clearPendingTaskFile(sheetTask.id)} disabled={!canEditTaskContent || sheetIsAttachmentMutating} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{tx('playbook.evidenceRemovePendingFile')}</button>
                                  <button type="button" onClick={() => void handleUploadPendingTaskFile(sheetTask)} disabled={!canEditTaskContent || sheetIsAttachmentMutating} className="rounded-lg bg-indigo-600 px-2 py-2 text-[11px] font-semibold text-white disabled:opacity-40">{tx('playbook.evidenceUploadFile')}</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : sheetEvidenceComposerMode === 'note' ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={sheetNoteContent}
                              onChange={(event) =>
                                setNoteDraftByTaskId((prev) => ({ ...prev, [sheetTask.id]: event.target.value }))
                              }
                              placeholder={tx('playbook.task.notePlaceholder')}
                              disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                              style={{ minHeight: '5rem' }}
                              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => void handleAddTaskNote(sheetTask)}
                                disabled={!canEditTaskContent || sheetIsAttachmentMutating || !sheetNoteContent.trim()}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Save size={12} />{tx('playbook.task.saveNote')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={sheetTaskYoutubeDraft}
                                onChange={(event) => handleTaskYoutubeDraftChange(sheetTask.id, event.target.value)}
                                placeholder={tx('playbook.evidenceYoutubePlaceholder')}
                                disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
                              />
                              <button
                                type="button"
                                onClick={() => void handleAddTaskYoutubeLink(sheetTask)}
                                disabled={!canEditTaskContent || sheetIsAttachmentMutating || sheetTaskYoutubeDraft.trim().length === 0}
                                className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
                              >
                                <Plus size={12} />{tx('common.add')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {sheetIsAttachmentLoading ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {tx('common.loading')}
                      </p>
                    ) : sheetTaskAttachments.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {tx('playbook.subitemHasNoEvidenceYet')}
                      </p>
                    ) : (
                      <>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {sheetAttachmentFilterOptions.map((option) => {
                            const isActive = normalizedSheetAttachmentFilter === option.key
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() =>
                                  setTaskAttachmentFilterByTaskId((previous) => ({
                                    ...previous,
                                    [sheetTask.id]: option.key,
                                  }))
                                }
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                                  isActive
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                                }`}
                              >
                                {option.label}
                                <span className="ml-1 opacity-70">{option.count}</span>
                              </button>
                            )
                          })}
                        </div>
                        {visibleSheetTaskAttachments.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {tx('playbook.subitemHasNoEvidenceYet')}
                          </p>
                        ) : (
                      <ul className="grid grid-cols-2 gap-3">
                        {visibleSheetTaskAttachments.map((attachment) => {
                          const attachmentLabel = getAttachmentTypeLabel(attachment.attachmentType, tx)
                          const attachmentSize = formatAttachmentSize(attachment.sizeBytes)
                          const previewUrl =
                            attachment.attachmentType === 'image' || attachment.attachmentType === 'youtube_link'
                              ? attachment.thumbnailUrl || attachment.url
                              : resolvePdfPreviewUrl(attachment)
                          const isNote = attachment.attachmentType === 'note'
                          const noteContent = isNote
                            ? (attachment.metadata?.content as string | undefined) ?? attachment.title ?? ''
                            : ''

                          return (
                            <li
                              key={attachment.id}
                              className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                            >
                              {isNote ? (
                                <div className="flex-1 bg-amber-50 px-3 py-2.5 dark:bg-amber-950/20">
                                  <p className="line-clamp-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                                    {noteContent || tx('playbook.emptyNote')}
                                  </p>
                                </div>
                              ) : previewUrl ? (
                                <a
                                  href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={previewUrl} alt={attachment.title || attachmentLabel} className="h-full w-full object-cover" />
                                </a>
                              ) : (
                                <a
                                  href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex aspect-video w-full items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                                >
                                  {attachment.attachmentType === 'pdf' ? (
                                    <FileText size={28} />
                                  ) : (
                                    <Music2 size={28} />
                                  )}
                                </a>
                              )}
                              <div className="px-2 py-1.5">
                                <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                  {attachment.title || attachmentLabel}
                                </p>
                                {attachmentSize && (
                                  <p className="text-[10px] text-slate-400">{attachmentSize}</p>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── TAB: COMUNIDAD ── */}
                {mobileSheetTab === 'comunidad' && (
                  <div>
                    {sheetCommunityError && (
                      <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                        {sheetCommunityError}
                      </p>
                    )}

                    {/* Like / Compartir / Seguir / Visualizaciones */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleTaskLike(sheetTask)}
                        disabled={sheetIsCommunityMutating}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          sheetTaskLikeSummary.likedByMe
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                        }`}
                      >
                        <ThumbsUp size={14} />
                        {sheetTaskLikeSummary.likedByMe
                          ? tx('playbook.youLikeThis')
                          : tx('playbook.like')}
                        <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-xs dark:bg-slate-700/80">
                          {sheetTaskLikeSummary.likesCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleShareTask(sheetTask)}
                        disabled={sheetIsCommunityMutating}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          sheetIsShareCopied
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                        }`}
                      >
                        <Share2 size={14} />
                        {sheetIsShareCopied ? tx('common.copied') : tx('common.share')}
                        <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-xs dark:bg-slate-700/80">
                          {sheetTaskLikeSummary.sharesCount ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleTaskFollow(sheetTask)}
                        disabled={sheetIsCommunityMutating || isGuestExtraction}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          sheetTaskLikeSummary.followingByMe
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                        }`}
                      >
                        <Bell size={14} />
                        {sheetTaskLikeSummary.followingByMe
                          ? tx('playbook.following')
                          : tx('playbook.follow')}
                        <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-xs dark:bg-slate-700/80">
                          {sheetTaskLikeSummary.followersCount ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void fetchTaskCommunity(sheetTask.id)}
                        disabled={sheetIsCommunityLoading || sheetIsCommunityMutating}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Eye size={14} />
                        {sheetTaskLikeSummary.viewsCount ?? 0}
                      </button>
                    </div>

                    {/* Comentar */}
                    <div className="mb-4 flex gap-2">
                      <input
                        type="text"
                        value={sheetCommentDraft}
                        onChange={(event) => handleTaskCommentDraftChange(sheetTask.id, event.target.value)}
                        placeholder={tx('playbook.writeComment')}
                        disabled={sheetIsCommunityMutating}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddTaskComment(sheetTask)}
                        disabled={sheetIsCommunityMutating || sheetCommentDraft.trim().length === 0}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300"
                      >
                        {tx('playbook.comment')}
                        <span className="rounded bg-indigo-100/80 px-1.5 py-0.5 text-xs dark:bg-indigo-800/70">
                          {sheetTaskComments.length}
                        </span>
                      </button>
                    </div>

                    {sheetIsCommunityLoading ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {tx('common.loading')}
                      </p>
                    ) : sheetTaskComments.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {tx('playbook.noCommentsYetForSubitem')}
                      </p>
                    ) : (
                      renderTaskCommentThread({
                        task: sheetTask,
                        comments: sheetTaskComments,
                        isCommunityMutating: sheetIsCommunityMutating,
                        replyParentCommentId: sheetReplyParentCommentId,
                        replyDraft: sheetReplyDraft,
                        compact: true,
                      })
                    )}
                  </div>
                )}

              </div>
            </div>,
          typeof document !== 'undefined' ? document.body : null as unknown as Element
        )
      })()}

      {showPageTurnLeaf && pageTurnSnapshot && (
        <div
          aria-hidden="true"
          className={`paper-playbook-page-turn${isPageTurnAtBend ? ' paper-playbook-page-turn-active' : ''}`}
          style={{
            transform: pageTurnTransform,
            borderRadius: pageTurnBorderRadius,
            boxShadow: pageTurnShadow,
          }}
        >
          <div className="paper-playbook-page-turn-sheet">
            <div className="flex h-full flex-col" style={{ marginInline: '4.5%' }}>
              <div className="border-b border-slate-200/70 px-0 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    Tiempo: {pageTurnSnapshot.savedTime}
                  </span>
                  <span className="rounded-md border border-orange-200/80 bg-orange-50/70 px-2 py-1 text-[10px] font-semibold text-orange-700">
                    Dificultad: {pageTurnSnapshot.difficulty}
                  </span>
                  <span className="rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                    Modo: {pageTurnSnapshot.modeLabel}
                  </span>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {pageTurnSnapshot.sourceSectionLabel}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-700">
                  {pageTurnSnapshot.sourceDisplayTitle}
                </p>
              </div>

              <div className="border-b border-slate-200/70 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Objetivo del resultado
                </p>
                <p className="mt-1 line-clamp-4 text-[12px] leading-5 text-slate-700">
                  {pageTurnSnapshot.objective || tx('playbook.noObjective')}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden py-3">
                <div className="space-y-2">
                  {pageTurnSnapshot.phases.slice(0, 5).map((phase) => (
                    <div key={phase.id} className="rounded-md border border-slate-200/60 bg-white/35 px-2.5 py-2">
                      <p className="truncate text-[11px] font-semibold text-slate-700">{phase.title}</p>
                      <ul className="mt-1 space-y-0.5">
                        {flattenItemsAsText(phase.items).slice(0, 2).map((item, itemIndex) => (
                          <li key={`${phase.id}-${itemIndex}`} className="line-clamp-1 text-[10px] text-slate-600">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <span className="paper-playbook-page-turn-crease" />
          </div>
        </div>
      )}

      {showBookCover && (
        <div
          aria-hidden="true"
          className="paper-playbook-cover"
          style={{
            transition:
              coverMotion === 'closing'
                ? 'transform 1.35s cubic-bezier(0.2, 0.75, 0.2, 1)'
                : 'transform 0.9s cubic-bezier(0.24, 0.7, 0.28, 1)',
            transform: coverOpenedToLeft
              ? 'perspective(2400px) rotateY(-104deg) rotateX(0.5deg)'
              : 'perspective(2400px) rotateY(0deg) rotateX(0deg)',
          }}
        >
          <p className="paper-playbook-cover-kicker">Carpeta activa</p>
          <p className="paper-playbook-cover-title">{coverFolderLabel}</p>
        </div>
      )}

      {/* ── Source Text Modal ──────────────────────────────────────────────── */}
      {showSourceTextModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tx('playbook.source.textViewer')}
          className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSourceTextModal(false) }}
        >
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {tx('playbook.source.textViewer')}
                </p>
                {(result.sourceLabel ?? result.videoTitle) && (
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {result.sourceLabel ?? result.videoTitle}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySourceText}
                  disabled={!sourceTextContent}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label={tx('playbook.source.copyText')}
                >
                  {sourceTextCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {sourceTextCopied ? tx('playbook.source.copied') : tx('playbook.source.copyText')}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSourceText}
                  disabled={!sourceTextContent}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label={tx('playbook.source.downloadTxt')}
                >
                  <Download size={13} />
                  {tx('playbook.source.downloadTxt')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSourceTextModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  aria-label={tx('playbook.close')}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {sourceTextContent ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {sourceTextContent}
                </pre>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">
                  {tx('playbook.source.noSourceText')}
                </p>
              )}
            </div>
            {/* Footer: char count */}
            {sourceTextContent && (
              <div className="shrink-0 border-t border-slate-100 px-5 py-2 dark:border-slate-800">
                <p className="text-[11px] text-slate-400">
                  {sourceTextContent.length.toLocaleString()} chars
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
