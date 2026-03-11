export type BuiltInTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'

export const DEFAULT_TASK_STATUS_VALUES: BuiltInTaskStatus[] = [
  'pending',
  'in_progress',
  'blocked',
  'completed',
]

export const MAX_TASK_STATUS_LENGTH = 48

export const DEFAULT_TASK_STATUS_CHIP_CLASS_NAMES: Record<BuiltInTaskStatus, string> = {
  pending:
    'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300',
  blocked:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300',
  completed:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300',
}

const CUSTOM_TASK_STATUS_CHIP_CLASS_NAMES = [
  'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/25 dark:text-violet-300',
  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-300',
  'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/25 dark:text-cyan-300',
  'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-900/25 dark:text-fuchsia-300',
  'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-900/25 dark:text-teal-300',
  'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/25 dark:text-orange-300',
]

export function isBuiltInTaskStatus(status: string): status is BuiltInTaskStatus {
  return DEFAULT_TASK_STATUS_VALUES.includes(status as BuiltInTaskStatus)
}

export function normalizeTaskStatusInput(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, ' ').trim()
}

function normalizeTaskStatusCatalogValue(raw: unknown) {
  const normalized = normalizeTaskStatusInput(raw).slice(0, MAX_TASK_STATUS_LENGTH)
  if (!normalized || isBuiltInTaskStatus(normalized)) return ''
  return normalized
}

function getTaskStatusIdentityKey(status: string) {
  return normalizeTaskStatusInput(status).toLocaleLowerCase()
}

function hashTaskStatus(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

export function getTaskStatusChipClassName(status: string) {
  if (isBuiltInTaskStatus(status)) {
    return DEFAULT_TASK_STATUS_CHIP_CLASS_NAMES[status]
  }

  if (!status.trim()) {
    return DEFAULT_TASK_STATUS_CHIP_CLASS_NAMES.pending
  }

  return CUSTOM_TASK_STATUS_CHIP_CLASS_NAMES[
    hashTaskStatus(status.trim().toLocaleLowerCase()) % CUSTOM_TASK_STATUS_CHIP_CLASS_NAMES.length
  ]
}

export function compareTaskStatusValues(a: string, b: string) {
  const aBuiltIn = isBuiltInTaskStatus(a)
  const bBuiltIn = isBuiltInTaskStatus(b)

  if (aBuiltIn && bBuiltIn) {
    return DEFAULT_TASK_STATUS_VALUES.indexOf(a) - DEFAULT_TASK_STATUS_VALUES.indexOf(b)
  }
  if (aBuiltIn) return -1
  if (bBuiltIn) return 1

  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function sanitizeCustomTaskStatusCatalog(rawCatalog: unknown) {
  if (!Array.isArray(rawCatalog)) return []

  const sanitized: string[] = []
  const seen = new Set<string>()

  for (const rawStatus of rawCatalog) {
    const normalized = normalizeTaskStatusCatalogValue(rawStatus)
    if (!normalized) continue

    const key = getTaskStatusIdentityKey(normalized)
    if (seen.has(key)) continue

    seen.add(key)
    sanitized.push(normalized)
  }

  return sanitized
}

export function parseTaskStatusCatalogFromMetadataJson(metadataJson: unknown) {
  if (typeof metadataJson !== 'string' || !metadataJson.trim()) return []

  try {
    const parsed = JSON.parse(metadataJson) as { taskStatusCatalog?: unknown } | null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return sanitizeCustomTaskStatusCatalog(parsed.taskStatusCatalog)
  } catch {
    return []
  }
}

export function writeTaskStatusCatalogToMetadataJson(
  metadataJson: unknown,
  taskStatusCatalog: Iterable<string>
) {
  let metadataRecord: Record<string, unknown> = {}

  if (typeof metadataJson === 'string' && metadataJson.trim()) {
    try {
      const parsed = JSON.parse(metadataJson) as Record<string, unknown> | null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadataRecord = { ...parsed }
      }
    } catch {
      metadataRecord = {}
    }
  }

  const sanitizedCatalog = sanitizeCustomTaskStatusCatalog(Array.from(taskStatusCatalog))

  if (sanitizedCatalog.length > 0) {
    metadataRecord.taskStatusCatalog = sanitizedCatalog
  } else {
    delete metadataRecord.taskStatusCatalog
  }

  return JSON.stringify(metadataRecord)
}

export function buildOrderedTaskStatusValues(input: {
  catalog?: Iterable<string>
  usedStatuses?: Iterable<string>
}) {
  const ordered: string[] = [...DEFAULT_TASK_STATUS_VALUES]
  const seen = new Set<string>(DEFAULT_TASK_STATUS_VALUES.map((status) => getTaskStatusIdentityKey(status)))

  for (const status of sanitizeCustomTaskStatusCatalog(Array.from(input.catalog ?? []))) {
    const key = getTaskStatusIdentityKey(status)
    if (seen.has(key)) continue
    seen.add(key)
    ordered.push(status)
  }

  const remainingCustomStatuses: string[] = []
  for (const rawStatus of Array.from(input.usedStatuses ?? [])) {
    const normalized = normalizeTaskStatusInput(rawStatus).slice(0, MAX_TASK_STATUS_LENGTH)
    if (!normalized) continue

    const key = getTaskStatusIdentityKey(normalized)
    if (seen.has(key)) continue

    seen.add(key)
    remainingCustomStatuses.push(normalized)
  }

  remainingCustomStatuses.sort(compareTaskStatusValues)
  return ordered.concat(remainingCustomStatuses)
}

export function mergeTaskStatusValues(statuses: Iterable<string>) {
  return buildOrderedTaskStatusValues({ usedStatuses: statuses })
}
