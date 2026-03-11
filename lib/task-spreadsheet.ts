import type { TaskNumericFormula } from '@/lib/task-numeric-formulas'
import { normalizeTaskStatusInput } from '@/lib/task-statuses'

export interface TaskSpreadsheetSource {
  id: string
  phaseTitle: string
  itemText: string
  positionPath?: string | null
  phaseId: number
  itemIndex: number
  status: string
  checked: boolean
  numericValue: number | null
  manualNumericValue: number | null
  numericFormula: TaskNumericFormula | null
  dueAt: string | null
  completedAt: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  durationDays: number
  predecessorIds: string[]
  flowNodeType: string
  depth?: number
}

export interface TaskSpreadsheetRow {
  id: string
  phase: string
  position: string
  item: string
  status: string
  checked: boolean
  numericValue: number | null
  manualNumericValue: number | null
  formula: string
  scheduledStartAt: string
  scheduledEndAt: string
  dueAt: string
  completedAt: string
  durationDays: number
  predecessors: string
  nodeType: string
  depth: number
}

type SpreadsheetCellValue = string | number | boolean | null

export function taskSpreadsheetRowToCells(row: TaskSpreadsheetRow): SpreadsheetCellValue[] {
  return [
    row.phase,
    row.position,
    row.item,
    row.status,
    row.checked,
    row.numericValue,
    row.manualNumericValue,
    row.formula,
    row.scheduledStartAt,
    row.scheduledEndAt,
    row.dueAt,
    row.completedAt,
    row.durationDays,
    row.predecessors,
    row.nodeType,
    row.depth,
  ]
}

function getTaskSpreadsheetPosition(task: TaskSpreadsheetSource) {
  return task.positionPath?.trim() || `${task.phaseId}.${task.itemIndex + 1}`
}

function formatTaskSpreadsheetFormula(
  formula: TaskNumericFormula | null,
  tasksById: Map<string, TaskSpreadsheetSource>
) {
  if (!formula) return ''

  const operationLabel = formula.operation.toUpperCase()
  const sourceLabels = formula.sourceTaskIds.map((sourceTaskId) => {
    const sourceTask = tasksById.get(sourceTaskId)
    return sourceTask ? getTaskSpreadsheetPosition(sourceTask) : sourceTaskId
  })

  return `${operationLabel}(${sourceLabels.join(', ')})`
}

function stringifySpreadsheetCellValue(value: SpreadsheetCellValue) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

function escapeCsvCell(value: SpreadsheetCellValue) {
  const stringValue = stringifySpreadsheetCellValue(value)
  if (!/[",\n\r]/.test(stringValue)) return stringValue
  return `"${stringValue.replace(/"/g, '""')}"`
}

function escapeHtml(value: SpreadsheetCellValue) {
  return stringifySpreadsheetCellValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildTaskSpreadsheetRows(tasks: TaskSpreadsheetSource[]): TaskSpreadsheetRow[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))

  return tasks.map((task) => {
    const predecessors = task.predecessorIds
      .map((predecessorId) => {
        const predecessorTask = tasksById.get(predecessorId)
        return predecessorTask ? getTaskSpreadsheetPosition(predecessorTask) : predecessorId
      })
      .join(', ')

    return {
      id: task.id,
      phase: task.phaseTitle,
      position: getTaskSpreadsheetPosition(task),
      item: task.itemText.trim(),
      status: normalizeTaskStatusInput(task.status) || task.status,
      checked: task.checked,
      numericValue: task.numericValue,
      manualNumericValue: task.manualNumericValue,
      formula: formatTaskSpreadsheetFormula(task.numericFormula, tasksById),
      scheduledStartAt: task.scheduledStartAt ?? '',
      scheduledEndAt: task.scheduledEndAt ?? '',
      dueAt: task.dueAt ?? '',
      completedAt: task.completedAt ?? '',
      durationDays: task.durationDays,
      predecessors,
      nodeType: task.flowNodeType,
      depth: typeof task.depth === 'number' && Number.isFinite(task.depth) ? task.depth : 1,
    }
  })
}

export function buildTaskSpreadsheetCsv(
  headers: string[],
  rows: Array<SpreadsheetCellValue[]>
) {
  return [
    headers.map((header) => escapeCsvCell(header)).join(','),
    ...rows.map((row) => row.map((value) => escapeCsvCell(value)).join(',')),
  ].join('\n')
}

export function buildTaskSpreadsheetExcelHtml(input: {
  title: string
  headers: string[]
  rows: Array<SpreadsheetCellValue[]>
}) {
  const headerCells = input.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('')
  const bodyRows = input.rows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=UTF-8" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body>
    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  </body>
</html>`
}
