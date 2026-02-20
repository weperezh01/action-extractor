import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'

export interface ExportPhase {
  id: number
  title: string
  items: string[]
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
    for (const item of phase.items) {
      lines.push(`- ${cleanLine(item)}`)
    }
    lines.push('')
  }

  lines.push(`**Consejo Pro:** ${cleanLine(input.proTip)}`)
  lines.push('')
  lines.push(`**Fuente:** ${input.videoUrl.trim()}`)

  return lines.join('\n')
}
