import { ExportMetadata, ExportPhase } from '@/lib/export-content'

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function parseExtractionPhases(phasesJson: string): ExportPhase[] {
  const raw = safeParse<
    Array<{ id?: unknown; title?: unknown; items?: unknown }>
  >(phasesJson, [])

  const parsed = raw
    .map((phase, index) => {
      const id =
        typeof phase.id === 'number' && Number.isFinite(phase.id)
          ? phase.id
          : index + 1
      const title =
        typeof phase.title === 'string' && phase.title.trim()
          ? phase.title.trim()
          : `Bloque ${index + 1}`
      const items = Array.isArray(phase.items)
        ? phase.items.filter(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0
          )
        : []

      return {
        id,
        title,
        items,
      } satisfies ExportPhase
    })
    .filter((phase) => phase.items.length > 0)

  return parsed
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
