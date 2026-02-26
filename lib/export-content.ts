import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { flattenItemsAsText, normalizePlaybookPhases, type PlaybookNode } from '@/lib/playbook-tree'

export interface ExportPhase {
  id: number
  title: string
  items: PlaybookNode[]
}

export interface ExportMetadata {
  difficulty: string
  readingTime: string
  originalTime: string
  savedTime: string
}

export interface BuildExportContentInput {
  extractionMode: string
  objective: string
  phases: ExportPhase[]
  proTip: string
  metadata: ExportMetadata
  videoTitle: string | null
  videoUrl: string
}

function cleanLine(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

export function buildExportTitle(input: BuildExportContentInput) {
  const modeLabel = getExtractionModeLabel(normalizeExtractionMode(input.extractionMode))
  const base = input.videoTitle?.trim() || input.objective.trim() || 'Extracción'
  return cleanLine(`${modeLabel} | ${base}`)
}

export function buildExtractionMarkdown(input: BuildExportContentInput) {
  const modeLabel = getExtractionModeLabel(normalizeExtractionMode(input.extractionMode))
  const lines: string[] = [
    `# ${buildExportTitle(input)}`,
    '',
    `**Modo:** ${modeLabel}`,
    `**Objetivo:** ${cleanLine(input.objective)}`,
    `**Dificultad:** ${cleanLine(input.metadata.difficulty)}`,
    `**Lectura estimada:** ${cleanLine(input.metadata.readingTime)}`,
    `**Tiempo ahorrado:** ${cleanLine(input.metadata.savedTime)}`,
    '',
  ]

  for (const phase of input.phases) {
    lines.push(`## ${phase.id}. ${cleanLine(phase.title)}`)
    for (const item of flattenItemsAsText(phase.items)) {
      lines.push(`- ${cleanLine(item)}`)
    }
    lines.push('')
  }

  lines.push(`**Consejo Pro:** ${cleanLine(input.proTip)}`)
  lines.push('')
  lines.push(`**Fuente:** ${input.videoUrl.trim()}`)

  return lines.join('\n')
}

export function normalizeExportPhases(payload: unknown, fallback: ExportPhase[] = []): ExportPhase[] {
  const normalized = normalizePlaybookPhases(payload)
  return normalized.length > 0 ? normalized : fallback
}
