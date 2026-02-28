import { useCallback, useEffect } from 'react'
import type { ExtractionMode } from '@/lib/extraction-modes'

const MODE_BY_KEY: Partial<Record<string, ExtractionMode>> = {
  '1': 'action_plan',
  '2': 'executive_summary',
  '3': 'business_ideas',
  '4': 'key_quotes',
  '5': 'concept_map',
}

interface UseKeyboardShortcutsOptions {
  onExtract: () => void
  onModeChange: (mode: ExtractionMode) => void
  onDownloadPdf: () => void
  onCopyMarkdown: () => void
  onShowHelp: () => void
  isProcessing: boolean
  hasResult: boolean
}

export function useKeyboardShortcuts({
  onExtract,
  onModeChange,
  onDownloadPdf,
  onCopyMarkdown,
  onShowHelp,
  isProcessing,
  hasResult,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase() ?? ''
      const isInInput =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable === true

      const isMeta = event.metaKey || event.ctrlKey

      // Cmd/Ctrl+K — focus extraction input
      if (isMeta && !event.shiftKey && !event.altKey && event.key === 'k') {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>('[data-extraction-input]')
        if (input) {
          input.focus()
          input.select()
        }
        return
      }

      // Cmd/Ctrl+Enter — trigger extraction
      if (isMeta && !event.shiftKey && !event.altKey && event.key === 'Enter' && !isProcessing) {
        event.preventDefault()
        onExtract()
        return
      }

      // Cmd/Ctrl+D — download PDF (only when there is a result)
      if (isMeta && !event.shiftKey && !event.altKey && event.key === 'd' && hasResult) {
        event.preventDefault()
        onDownloadPdf()
        return
      }

      // Cmd/Ctrl+Shift+C — copy as Markdown (only when there is a result)
      if (isMeta && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'c' && hasResult) {
        event.preventDefault()
        onCopyMarkdown()
        return
      }

      // Shortcuts that must NOT fire when the user is typing in an input
      if (isInInput) return

      // 1–5 — change extraction mode
      if (!isMeta && !event.altKey && !event.shiftKey && event.key in MODE_BY_KEY) {
        const mode = MODE_BY_KEY[event.key]
        if (mode) onModeChange(mode)
        return
      }

      // ? — show keyboard shortcuts help
      if (event.key === '?' && !isMeta && !event.altKey) {
        event.preventDefault()
        onShowHelp()
      }
    },
    [onExtract, onModeChange, onDownloadPdf, onCopyMarkdown, onShowHelp, isProcessing, hasResult]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
