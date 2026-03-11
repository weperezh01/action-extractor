export type TaskNumericFormulaOperation = 'sum' | 'subtract' | 'multiply' | 'divide'

export interface TaskNumericFormula {
  operation: TaskNumericFormulaOperation
  sourceTaskIds: string[]
}

interface TaskNumericFormulaValueSource {
  id: string
  manualNumericValue: number | null
  numericFormula: TaskNumericFormula | null
}

interface TaskNumericFormulaReferenceSource {
  id: string
  numericFormula: TaskNumericFormula | null
}

const TASK_NUMERIC_FORMULA_OPERATIONS = new Set<TaskNumericFormulaOperation>([
  'sum',
  'subtract',
  'multiply',
  'divide',
])

function sanitizeTaskNumericFormulaSourceIds(raw: unknown) {
  if (!Array.isArray(raw)) return []

  const uniqueIds: string[] = []
  const seen = new Set<string>()

  for (const value of raw) {
    if (typeof value !== 'string') continue
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    uniqueIds.push(normalized)
  }

  return uniqueIds
}

function normalizeTaskNumericFormula(raw: unknown): TaskNumericFormula | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const operation = (raw as { operation?: unknown }).operation
  if (!TASK_NUMERIC_FORMULA_OPERATIONS.has(operation as TaskNumericFormulaOperation)) {
    return null
  }

  const sourceTaskIds = sanitizeTaskNumericFormulaSourceIds(
    (raw as { sourceTaskIds?: unknown }).sourceTaskIds
  )
  if (sourceTaskIds.length === 0) return null

  return {
    operation: operation as TaskNumericFormulaOperation,
    sourceTaskIds,
  }
}

export function parseTaskNumericFormulaJson(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return null

  try {
    return normalizeTaskNumericFormula(JSON.parse(raw))
  } catch {
    return null
  }
}

export function parseTaskNumericFormulaInput(raw: unknown) {
  return normalizeTaskNumericFormula(raw)
}

export function serializeTaskNumericFormula(formula: TaskNumericFormula | null) {
  if (!formula) return '{}'
  return JSON.stringify({
    operation: formula.operation,
    sourceTaskIds: sanitizeTaskNumericFormulaSourceIds(formula.sourceTaskIds),
  })
}

export function taskNumericFormulaCreatesCycle<T extends TaskNumericFormulaReferenceSource>(
  tasks: T[],
  taskId: string,
  nextFormula: TaskNumericFormula | null
) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visitTask = (currentTaskId: string): boolean => {
    if (visiting.has(currentTaskId)) return true
    if (visited.has(currentTaskId)) return false

    const task = tasksById.get(currentTaskId)
    const formula = currentTaskId === taskId ? nextFormula : task?.numericFormula ?? null
    if (!formula) {
      visited.add(currentTaskId)
      return false
    }

    visiting.add(currentTaskId)
    for (const sourceTaskId of formula.sourceTaskIds) {
      if (!tasksById.has(sourceTaskId)) continue
      if (visitTask(sourceTaskId)) {
        visiting.delete(currentTaskId)
        return true
      }
    }
    visiting.delete(currentTaskId)
    visited.add(currentTaskId)
    return false
  }

  return visitTask(taskId)
}

export function resolveTaskNumericValues<T extends TaskNumericFormulaValueSource>(tasks: T[]) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const resolvedValues = new Map<string, number | null>()
  const visiting = new Set<string>()

  const resolveTaskValue = (taskId: string): number | null => {
    if (resolvedValues.has(taskId)) {
      return resolvedValues.get(taskId) ?? null
    }

    const task = tasksById.get(taskId)
    if (!task) {
      resolvedValues.set(taskId, null)
      return null
    }

    if (!task.numericFormula) {
      resolvedValues.set(taskId, task.manualNumericValue)
      return task.manualNumericValue
    }

    if (visiting.has(taskId)) {
      resolvedValues.set(taskId, null)
      return null
    }

    visiting.add(taskId)

    const sourceValues = task.numericFormula.sourceTaskIds.map((sourceTaskId) =>
      resolveTaskValue(sourceTaskId)
    )
    let nextValue: number | null = null

    if (sourceValues.every((value): value is number => typeof value === 'number' && Number.isFinite(value))) {
      if (task.numericFormula.operation === 'sum') {
        nextValue = sourceValues.reduce((total, value) => total + value, 0)
      } else if (task.numericFormula.operation === 'subtract') {
        nextValue = sourceValues.slice(1).reduce((total, value) => total - value, sourceValues[0] ?? 0)
      } else if (task.numericFormula.operation === 'multiply') {
        nextValue = sourceValues.reduce((total, value) => total * value, 1)
      } else {
        nextValue = sourceValues[0] ?? null
        for (const value of sourceValues.slice(1)) {
          if (value === 0) {
            nextValue = null
            break
          }
          nextValue = nextValue === null ? null : nextValue / value
        }
      }
    }

    visiting.delete(taskId)
    resolvedValues.set(taskId, nextValue)
    return nextValue
  }

  for (const task of tasks) {
    resolveTaskValue(task.id)
  }

  return resolvedValues
}
