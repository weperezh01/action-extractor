'use client'

import { useCallback, useState } from 'react'
import { buildExtractionMarkdown } from '@/lib/export-content'
import { normalizeExtractionMode, type ExtractionMode } from '@/lib/extraction-modes'
import { ResultPanel } from '@/app/home/components/ResultPanel'
import {
  getShareVisibilityChangeNotice,
  isShareVisibilityShareable,
  normalizeShareVisibility,
} from '@/app/home/lib/share-visibility'
import type { ExtractResult, HistoryItem, Phase, ShareVisibility } from '@/app/home/lib/types'

interface ExtractionFeedCardProps {
  item: HistoryItem
  viewerUserId?: string | null
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

  onConnectNotion: () => void | Promise<void>
  onConnectTrello: () => void | Promise<void>
  onConnectTodoist: () => void | Promise<void>
  onConnectGoogleDocs: () => void | Promise<void>

  onExportToNotion: (extractionId: string) => void | Promise<void>
  onExportToTrello: (extractionId: string) => void | Promise<void>
  onExportToTodoist: (extractionId: string) => void | Promise<void>
  onExportToGoogleDocs: (extractionId: string) => void | Promise<void>

  onError: (msg: string) => void
  onNotice: (msg: string) => void
  onUnauthorized: () => void
  onScrollToExtractor: () => void
  onReExtractMode: (url: string, mode: ExtractionMode) => void
}

function normalizePersistedPhases(payload: unknown, fallback: Phase[]): Phase[] {
  if (!Array.isArray(payload)) return fallback
  const normalized = payload
    .map((phase, index) => {
      if (!phase || typeof phase !== 'object') return null
      const rawTitle = (phase as { title?: unknown }).title
      const rawItems = (phase as { items?: unknown }).items
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
      const items = Array.isArray(rawItems)
        ? rawItems.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
        : []
      if (!title || items.length === 0) return null
      return { id: index + 1, title, items }
    })
    .filter((phase): phase is Phase => Boolean(phase))
  return normalized.length > 0 ? normalized : fallback
}

export function ExtractionFeedCard({
  item,
  viewerUserId = null,
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
  onConnectNotion,
  onConnectTrello,
  onConnectTodoist,
  onConnectGoogleDocs,
  onExportToNotion,
  onExportToTrello,
  onExportToTodoist,
  onExportToGoogleDocs,
  onError,
  onNotice,
  onUnauthorized,
  onScrollToExtractor,
  onReExtractMode,
}: ExtractionFeedCardProps) {
  const extractionMode = normalizeExtractionMode(item.mode)

  const [localResult, setLocalResult] = useState<ExtractResult>({
    id: item.id,
    orderNumber: item.orderNumber,
    shareVisibility: normalizeShareVisibility(item.shareVisibility),
    createdAt: item.createdAt,
    url: item.url,
    videoId: item.videoId ?? null,
    videoTitle: item.videoTitle ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
    mode: extractionMode,
    objective: item.objective,
    phases: item.phases,
    proTip: item.proTip,
    metadata: item.metadata,
  })

  const [activePhase, setActivePhase] = useState<number | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareVisibilityLoading, setShareVisibilityLoading] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const togglePhase = (id: number) => {
    setActivePhase((prev) => (prev === id ? null : id))
  }

  const handleCopyMarkdown = useCallback(async () => {
    const markdown = buildExtractionMarkdown({
      extractionMode,
      objective: localResult.objective,
      phases: localResult.phases,
      proTip: localResult.proTip,
      metadata: localResult.metadata,
      videoTitle: localResult.videoTitle ?? null,
      videoUrl: (localResult.url ?? '').trim(),
    })
    await navigator.clipboard.writeText(markdown)
    onNotice('Contenido copiado como Markdown.')
  }, [extractionMode, localResult, onNotice])

  const handleCopyShareLink = useCallback(async () => {
    const extractionId = localResult.id?.trim()
    if (!extractionId || shareLoading) return
    if (!isShareVisibilityShareable(normalizeShareVisibility(localResult.shareVisibility))) {
      onError('Este contenido no es compartible. Cámbialo a Público o Solo con enlace.')
      return
    }

    setShareLoading(true)
    setShareCopied(false)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId }),
      })

      if (res.status === 401) {
        onUnauthorized()
        onError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      const data = (await res.json().catch(() => null)) as { token?: unknown; error?: unknown } | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : res.status === 409
              ? 'Este contenido no es compartible. Cámbialo a Público o Solo con enlace.'
              : 'No se pudo generar el enlace compartible.'
        onError(message)
        return
      }

      const token = typeof data?.token === 'string' ? data.token : ''
      if (!token) {
        onError('No se pudo generar el enlace compartible.')
        return
      }

      const shareUrl = `${window.location.origin}/share/${token}`
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2500)
    } catch {
      onError('No se pudo copiar el enlace compartible. Intenta de nuevo.')
    } finally {
      setShareLoading(false)
    }
  }, [localResult, shareLoading, onError, onUnauthorized])

  const handleShareVisibilityChange = useCallback(
    async (nextVisibility: ShareVisibility) => {
      const extractionId = localResult.id?.trim()
      if (!extractionId || shareVisibilityLoading) return

      const currentVisibility = normalizeShareVisibility(localResult.shareVisibility)
      if (currentVisibility === nextVisibility) return

      setShareVisibilityLoading(true)
      setLocalResult((prev) => ({ ...prev, shareVisibility: nextVisibility }))

      try {
        const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/visibility`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareVisibility: nextVisibility }),
        })

        if (res.status === 401) {
          onUnauthorized()
          onError('Tu sesión expiró. Vuelve a iniciar sesión.')
          setLocalResult((prev) => ({ ...prev, shareVisibility: currentVisibility }))
          return
        }

        const data = (await res.json().catch(() => null)) as
          | { shareVisibility?: unknown; error?: unknown }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo actualizar la visibilidad del contenido.'
          onError(message)
          setLocalResult((prev) => ({ ...prev, shareVisibility: currentVisibility }))
          return
        }

        const persistedVisibility = normalizeShareVisibility(data?.shareVisibility)

        setLocalResult((prev) => ({ ...prev, shareVisibility: persistedVisibility }))
        if (!isShareVisibilityShareable(persistedVisibility)) setShareCopied(false)
        onNotice(getShareVisibilityChangeNotice(persistedVisibility))
      } catch {
        onError('No se pudo actualizar la visibilidad. Intenta nuevamente.')
        setLocalResult((prev) => ({ ...prev, shareVisibility: currentVisibility }))
      } finally {
        setShareVisibilityLoading(false)
      }
    },
    [localResult, shareVisibilityLoading, onError, onNotice, onUnauthorized]
  )

  const handleSavePhases = useCallback(
    async (phases: Phase[]) => {
      const extractionId = localResult.id?.trim()
      if (!extractionId) {
        onError('No se puede guardar: esta extracción no está en historial.')
        return false
      }

      try {
        const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/content`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phases }),
        })

        if (res.status === 401) {
          onUnauthorized()
          onError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return false
        }

        const data = (await res.json().catch(() => null)) as
          | { phases?: unknown; error?: unknown }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo guardar la edición del contenido.'
          onError(message)
          return false
        }

        const persistedPhases = normalizePersistedPhases(data?.phases, phases)
        setLocalResult((prev) => ({ ...prev, phases: persistedPhases }))
        setActivePhase(null)
        onNotice('Contenido actualizado correctamente.')
        return true
      } catch {
        onError('No se pudo guardar la edición del contenido.')
        return false
      }
    },
    [localResult, onError, onNotice, onUnauthorized]
  )

  const handleSaveMeta = useCallback(
    async (meta: { title: string; thumbnailUrl: string | null; objective: string }) => {
      const extractionId = localResult.id?.trim()
      if (!extractionId) return false
      try {
        const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/meta`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: meta.title, thumbnailUrl: meta.thumbnailUrl, objective: meta.objective }),
        })
        if (res.status === 401) { onUnauthorized(); return false }
        const data = (await res.json().catch(() => null)) as {
          videoTitle?: string
          sourceLabel?: string
          thumbnailUrl?: string | null
          objective?: string
          error?: string
        } | null
        if (!res.ok) { onError(data?.error ?? 'No se pudo guardar.'); return false }
        setLocalResult((prev) => ({
          ...prev,
          videoTitle: data?.videoTitle ?? meta.title,
          sourceLabel: data?.sourceLabel ?? meta.title,
          thumbnailUrl: data?.thumbnailUrl ?? meta.thumbnailUrl,
          objective: data?.objective ?? meta.objective,
        }))
        onNotice('Información actualizada correctamente.')
        return true
      } catch {
        onError('Error de conexión al guardar.')
        return false
      }
    },
    [localResult, onError, onNotice, onUnauthorized]
  )

  const handleDownloadPdf = useCallback(async () => {
    if (isExportingPdf) return
    setIsExportingPdf(true)
    try {
      const { getExtractionModeLabel } = await import('@/lib/extraction-modes')
      const exportModeLabel = getExtractionModeLabel(extractionMode)
      const modeFilenamePartByMode: Record<ExtractionMode, string> = {
        action_plan: 'plan-de-accion',
        executive_summary: 'resumen-ejecutivo',
        business_ideas: 'ideas-de-negocio',
        key_quotes: 'frases-clave',
      }

      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginX = 14
      const marginTop = 16
      const marginBottom = 14
      const maxWidth = pageWidth - marginX * 2
      let y = marginTop

      const ensureSpace = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - marginBottom) {
          pdf.addPage()
          y = marginTop
        }
      }

      const addWrappedText = (
        text: string,
        options: {
          fontSize?: number
          fontStyle?: 'normal' | 'bold'
          x?: number
          width?: number
          lineHeight?: number
          spacingAfter?: number
        } = {}
      ) => {
        const {
          fontSize = 11,
          fontStyle = 'normal',
          x = marginX,
          width = maxWidth,
          lineHeight = 5,
          spacingAfter = 3,
        } = options
        pdf.setFont('helvetica', fontStyle)
        pdf.setFontSize(fontSize)
        const content = text.trim() ? text : '-'
        const lines = pdf.splitTextToSize(content, width) as string[]
        ensureSpace(lines.length * lineHeight + spacingAfter)
        pdf.text(lines, x, y)
        y += lines.length * lineHeight + spacingAfter
      }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text(`ActionExtractor - ${exportModeLabel}`, marginX, y)
      y += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const generatedAt = new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())
      pdf.text(`Generado: ${generatedAt}`, marginX, y)
      y += 6

      const sourceUrl = (localResult.url ?? '').trim()
      if (sourceUrl) {
        addWrappedText(`Video: ${sourceUrl}`, { fontSize: 9.5, spacingAfter: 4 })
      } else {
        y += 2
      }

      addWrappedText('Objetivo Estrategico', { fontSize: 13, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(localResult.objective, { fontSize: 11, lineHeight: 5.6, spacingAfter: 4 })

      addWrappedText('Resumen', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(`Dificultad: ${localResult.metadata.difficulty}`, { fontSize: 10.5, spacingAfter: 1.5 })
      addWrappedText(`Tiempo original: ${localResult.metadata.originalTime}`, { fontSize: 10.5, spacingAfter: 1.5 })
      addWrappedText(`Tiempo de lectura: ${localResult.metadata.readingTime}`, { fontSize: 10.5, spacingAfter: 1.5 })
      addWrappedText(`Tiempo ahorrado: ${localResult.metadata.savedTime}`, { fontSize: 10.5, spacingAfter: 4 })

      addWrappedText('Fases y Acciones', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      localResult.phases.forEach((phase, phaseIndex) => {
        addWrappedText(`${phaseIndex + 1}. ${phase.title}`, { fontSize: 11.5, fontStyle: 'bold', spacingAfter: 1.5 })
        phase.items.forEach((item) => {
          addWrappedText(`- ${item}`, { fontSize: 10.5, x: marginX + 2, width: maxWidth - 2, spacingAfter: 1.2 })
        })
        y += 1
      })

      addWrappedText('Consejo Pro', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(localResult.proTip, { fontSize: 10.8, lineHeight: 5.4, spacingAfter: 0 })

      const safeDate = new Date().toISOString().slice(0, 10)
      const filename = `action-extractor-${modeFilenamePartByMode[extractionMode]}-${safeDate}.pdf`
      pdf.save(filename)
    } catch {
      onError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setIsExportingPdf(false)
    }
  }, [isExportingPdf, extractionMode, localResult, onError])

  return (
    <div className="border-b border-slate-100 pb-10 pt-6 dark:border-slate-800/60 last:border-b-0">
      <ResultPanel
        result={localResult}
        viewerUserId={viewerUserId}
        url={localResult.url ?? ''}
        extractionMode={extractionMode}
        isProcessing={isProcessing}
        activePhase={activePhase}
        onTogglePhase={togglePhase}
        isExportingPdf={isExportingPdf}
        shareLoading={shareLoading}
        shareCopied={shareCopied}
        shareVisibility={normalizeShareVisibility(localResult.shareVisibility)}
        shareVisibilityLoading={shareVisibilityLoading}
        notionConfigured={notionConfigured}
        notionConnected={notionConnected}
        notionWorkspaceName={notionWorkspaceName}
        notionLoading={notionLoading}
        notionExportLoading={notionExportLoading}
        trelloConfigured={trelloConfigured}
        trelloConnected={trelloConnected}
        trelloUsername={trelloUsername}
        trelloLoading={trelloLoading}
        trelloExportLoading={trelloExportLoading}
        todoistConfigured={todoistConfigured}
        todoistConnected={todoistConnected}
        todoistUserLabel={todoistUserLabel}
        todoistLoading={todoistLoading}
        todoistExportLoading={todoistExportLoading}
        googleDocsConfigured={googleDocsConfigured}
        googleDocsConnected={googleDocsConnected}
        googleDocsUserEmail={googleDocsUserEmail}
        googleDocsLoading={googleDocsLoading}
        googleDocsExportLoading={googleDocsExportLoading}
        onDownloadPdf={handleDownloadPdf}
        onCopyShareLink={handleCopyShareLink}
        onCopyMarkdown={handleCopyMarkdown}
        onShareVisibilityChange={handleShareVisibilityChange}
        onSavePhases={handleSavePhases}
        onSaveMeta={handleSaveMeta}
        onExportToNotion={() => onExportToNotion(localResult.id!)}
        onConnectNotion={onConnectNotion}
        onExportToTrello={() => onExportToTrello(localResult.id!)}
        onConnectTrello={onConnectTrello}
        onExportToTodoist={() => onExportToTodoist(localResult.id!)}
        onConnectTodoist={onConnectTodoist}
        onExportToGoogleDocs={() => onExportToGoogleDocs(localResult.id!)}
        onConnectGoogleDocs={onConnectGoogleDocs}
        onReExtractMode={(mode) => {
          onScrollToExtractor()
          onReExtractMode(localResult.url ?? '', mode)
        }}
      />
    </div>
  )
}
