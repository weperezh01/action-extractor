import { ExportMetadata, ExportPhase } from '@/lib/export-content'
import { normalizePlaybookPhases } from '@/lib/playbook-tree'

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function parseExtractionPhases(phasesJson: string): ExportPhase[] {
  const raw = safeParse<unknown>(phasesJson, [])
  const parsed = normalizePlaybookPhases(raw)
  return parsed.filter((phase) => phase.items.length > 0)
}

export function parseExtractionMetadata(metadataJson: string): ExportMetadata {
  const raw = safeParse<{
    difficulty?: unknown
    readingTime?: unknown
    originalTime?: unknown
    savedTime?: unknown
  }>(metadataJson, {})

  return {
    difficulty:
      typeof raw.difficulty === 'string' && raw.difficulty.trim()
        ? raw.difficulty
        : 'Media',
    readingTime:
      typeof raw.readingTime === 'string' && raw.readingTime.trim()
        ? raw.readingTime
        : '3 min',
    originalTime:
      typeof raw.originalTime === 'string' && raw.originalTime.trim()
        ? raw.originalTime
        : '0m',
    savedTime:
      typeof raw.savedTime === 'string' && raw.savedTime.trim()
        ? raw.savedTime
        : '0m',
  }
}
