import { NextRequest, NextResponse } from 'next/server'
import { normalizePlaybookPhases } from '@/lib/playbook-tree'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'
import { extractVideoId } from '@/lib/extract-core'
import { extractWebContent } from '@/lib/content-extractor'
import { resolveYoutubeTranscriptWithFallback } from '@/lib/youtube-transcript-fallback'
import {
  createExtractionAdditionalSourceForUser,
  findExtractionAccessForUser,
  getExtractionSourceData,
  getVideoCacheTranscript,
  listExtractionAdditionalSources,
  markExtractionAdditionalSourcesAnalyzedForUser,
  syncExtractionTasksForUser,
  updateExtractionGeneratedContentForUser,
  type DbExtraction,
  type DbExtractionAdditionalSource,
} from '@/lib/db'
import { createExtraction } from '@/lib/db/extractions'
import { getUserFromRequest } from '@/lib/auth'
import {
  buildCombinedPlaybookSourceText,
  generatePlaybookFromSourceText,
  type CombinedPlaybookSource,
} from '@/lib/playbook-source-analysis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AnalyzeTargetMode = 'update_current' | 'create_new'

function normalizeId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function toErrorResponse(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown; status?: unknown }
    const message =
      typeof candidate.message === 'string' && candidate.message.trim()
        ? candidate.message
        : fallback
    const status =
      typeof candidate.status === 'number' && Number.isFinite(candidate.status)
        ? Math.trunc(candidate.status)
        : 500
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ error: fallback }, { status: 500 })
}

async function resolvePrimarySourceText(source: Awaited<ReturnType<typeof getExtractionSourceData>>) {
  if (!source) return null

  if (source.sourceType === 'youtube') {
    const videoId = source.videoId?.trim() || (source.url ? extractVideoId(source.url) : null)
    if (!videoId) return null

    const cached = await getVideoCacheTranscript(videoId)
    if (cached?.trim()) {
      return cached.trim()
    }

    const transcriptResolution = await resolveYoutubeTranscriptWithFallback(videoId)
    return transcriptResolution.segments.map((segment) => segment.text).join(' ').trim()
  }

  if (source.sourceType === 'web_url' && source.url) {
    if (source.sourceText?.trim()) {
      return source.sourceText.trim()
    }
    const webContent = await extractWebContent(source.url)
    return webContent.text.trim()
  }

  return source.sourceText?.trim() || null
}

async function resolveAdditionalSourceText(source: DbExtractionAdditionalSource) {
  if (source.source_type === 'youtube') {
    const videoId = source.url ? extractVideoId(source.url) : null
    if (!videoId) {
      throw new Error('Una fuente de YouTube no tiene una URL válida.')
    }
    const cached = await getVideoCacheTranscript(videoId)
    if (cached?.trim()) return cached.trim()
    const transcriptResolution = await resolveYoutubeTranscriptWithFallback(videoId)
    return transcriptResolution.segments.map((segment) => segment.text).join(' ').trim()
  }

  if (source.source_type === 'web_url') {
    if (source.source_text?.trim()) {
      return source.source_text.trim()
    }
    if (!source.url) {
      throw new Error('Una fuente web adicional no tiene URL.')
    }
    const webContent = await extractWebContent(source.url)
    return webContent.text.trim()
  }

  return source.source_text?.trim() || null
}

function buildResultPayload(extraction: DbExtraction) {
  const phases = normalizePlaybookPhases(JSON.parse(extraction.phases_json))
  const metadata = JSON.parse(extraction.metadata_json) as {
    readingTime?: string
    difficulty?: string
    originalTime?: string
    savedTime?: string
  }

  return {
    id: extraction.id,
    shareVisibility: extraction.share_visibility,
    clonePermission: extraction.clone_permission,
    createdAt: extraction.created_at,
    url: extraction.url,
    videoId: extraction.video_id,
    videoTitle: extraction.video_title,
    thumbnailUrl: extraction.thumbnail_url || (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : null),
    mode: normalizeExtractionMode(extraction.extraction_mode),
    objective: extraction.objective,
    phases,
    proTip: extraction.pro_tip,
    metadata: {
      readingTime: typeof metadata.readingTime === 'string' ? metadata.readingTime : '3 min',
      difficulty: typeof metadata.difficulty === 'string' ? metadata.difficulty : 'Media',
      originalTime: typeof metadata.originalTime === 'string' ? metadata.originalTime : '0m',
      savedTime: typeof metadata.savedTime === 'string' ? metadata.savedTime : '0m',
    },
    sourceType: extraction.source_type ?? 'text',
    transcriptSource: extraction.transcript_source ?? null,
    sourceLabel: extraction.source_label ?? null,
    sourceFileUrl: extraction.source_file_url ?? null,
    sourceFileName: extraction.source_file_name ?? null,
    hasSourceText: extraction.has_source_text === true,
    folderId: extraction.folder_id ?? null,
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = normalizeId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'ID de extracción requerido.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const targetModeRaw = (body as { targetMode?: unknown } | null)?.targetMode
    const targetMode: AnalyzeTargetMode =
      targetModeRaw === 'update_current' || targetModeRaw === 'create_new'
        ? targetModeRaw
        : 'create_new'
    const selectedSourceIds = Array.isArray((body as { sourceIds?: unknown } | null)?.sourceIds)
      ? Array.from(
          new Set(
            ((body as { sourceIds: unknown[] }).sourceIds)
              .map((value) => normalizeId(value))
              .filter(Boolean)
          )
        )
      : []

    if (selectedSourceIds.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos una fuente pendiente.' }, { status: 400 })
    }

    const access = await findExtractionAccessForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!access.extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }
    if (access.role !== 'owner') {
      return NextResponse.json({ error: 'Solo el dueño puede analizar fuentes del playbook.' }, { status: 403 })
    }

    const [primarySource, additionalSources] = await Promise.all([
      getExtractionSourceData({
        extractionId,
        requestingUserId: user.id,
      }),
      listExtractionAdditionalSources({
        extractionId,
        requestingUserId: user.id,
      }),
    ])

    if (!primarySource || additionalSources === null) {
      return NextResponse.json({ error: 'No se pudo cargar la información de las fuentes.' }, { status: 404 })
    }

    const pendingSourceMap = new Map(
      additionalSources
        .filter((source) => source.analysis_status === 'pending')
        .map((source) => [source.id, source] as const)
    )
    const analyzedSources = additionalSources.filter((source) => source.analysis_status === 'analyzed')
    const selectedPendingSources = selectedSourceIds
      .map((sourceId) => pendingSourceMap.get(sourceId))
      .filter((source): source is DbExtractionAdditionalSource => Boolean(source))

    if (selectedPendingSources.length !== selectedSourceIds.length) {
      return NextResponse.json(
        { error: 'Solo puedes analizar fuentes adicionales pendientes.' },
        { status: 400 }
      )
    }

    const primaryText = await resolvePrimarySourceText(primarySource)
    const resolvedAdditionalSources = await Promise.all(
      [...analyzedSources, ...selectedPendingSources].map(async (source) => {
        const text = await resolveAdditionalSourceText(source)
        if (!text?.trim()) return null
        return {
          source,
          text: text.trim(),
        }
      })
    )

    const combinedSources: CombinedPlaybookSource[] = []
    if (primaryText?.trim()) {
      combinedSources.push({
        id: `${extractionId}:primary`,
        kind: 'primary',
        sourceType: primarySource.sourceType,
        sourceLabel: primarySource.sourceLabel ?? primarySource.videoTitle ?? null,
        url: primarySource.url,
        sourceFileName: primarySource.sourceFileName,
        text: primaryText.trim(),
      })
    }

    for (const item of resolvedAdditionalSources) {
      if (!item) continue
      combinedSources.push({
        id: item.source.id,
        kind: 'additional',
        sourceType: item.source.source_type,
        sourceLabel: item.source.source_label,
        url: item.source.url,
        sourceFileName: item.source.source_file_name,
        text: item.text,
      })
    }

    if (combinedSources.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo obtener texto utilizable de las fuentes seleccionadas.' },
        { status: 422 }
      )
    }

    const combinedText = buildCombinedPlaybookSourceText(combinedSources)
    const generated = await generatePlaybookFromSourceText({
      transcript: combinedText,
      mode: normalizeExtractionMode(access.extraction.extraction_mode),
      requestedOutputLanguage: 'auto',
      userId: user.id,
      sourceType: 'multi_source',
    })

    let persistedExtraction: DbExtraction | null = null
    if (targetMode === 'create_new') {
      persistedExtraction = await createExtraction({
        userId: user.id,
        parentExtractionId: extractionId,
        url: primarySource.url,
        videoId: primarySource.videoId,
        videoTitle: access.extraction.video_title,
        thumbnailUrl: access.extraction.thumbnail_url,
        extractionMode: access.extraction.extraction_mode,
        objective: generated.objective,
        phasesJson: JSON.stringify(generated.phases),
        proTip: generated.proTip,
        metadataJson: JSON.stringify(generated.metadata),
        sourceType: primarySource.sourceType,
        sourceLabel: primarySource.sourceLabel ?? access.extraction.source_label,
        sourceText: primarySource.sourceText,
        sourceFileUrl: primarySource.sourceFileUrl,
        sourceFileName: primarySource.sourceFileName,
        sourceFileSizeBytes: primarySource.sourceFileSizeBytes,
        sourceFileMimeType: primarySource.sourceFileMimeType,
        transcriptSource: access.extraction.transcript_source,
        folderId: access.extraction.folder_id,
        shareVisibility: access.extraction.share_visibility,
      })

      for (const source of additionalSources) {
        const shouldMarkAnalyzed =
          source.analysis_status === 'analyzed' || selectedSourceIds.includes(source.id)
        await createExtractionAdditionalSourceForUser({
          extractionId: persistedExtraction.id,
          userId: user.id,
          sourceType: source.source_type,
          sourceLabel: source.source_label,
          url: source.url,
          sourceText: source.source_text,
          sourceFileUrl: source.source_file_url,
          sourceFileName: source.source_file_name,
          sourceFileSizeBytes: source.source_file_size_bytes,
          sourceFileMimeType: source.source_file_mime_type,
          analysisStatus: shouldMarkAnalyzed ? 'analyzed' : 'pending',
          analyzedAt: shouldMarkAnalyzed ? source.analyzed_at ?? new Date().toISOString() : null,
        })
      }

      await syncExtractionTasksForUser({
        userId: user.id,
        extractionId: persistedExtraction.id,
        phases: generated.phases,
      })
    } else {
      persistedExtraction = await updateExtractionGeneratedContentForUser({
        id: extractionId,
        userId: user.id,
        objective: generated.objective,
        phasesJson: JSON.stringify(generated.phases),
        proTip: generated.proTip,
        metadataJson: JSON.stringify(generated.metadata),
      })

      if (persistedExtraction) {
        await syncExtractionTasksForUser({
          userId: user.id,
          extractionId: persistedExtraction.id,
          phases: generated.phases,
        })
      }
    }

    if (!persistedExtraction) {
      return NextResponse.json({ error: 'No se pudo guardar el playbook regenerado.' }, { status: 500 })
    }

    await markExtractionAdditionalSourcesAnalyzedForUser({
      extractionId,
      userId: user.id,
      sourceIds: selectedSourceIds,
    })

    return NextResponse.json({
      item: buildResultPayload(persistedExtraction),
      targetMode,
    })
  } catch (error: unknown) {
    console.error('[ActionExtractor] playbook sources analyze POST error:', error)
    return toErrorResponse(error, 'No se pudieron analizar las fuentes seleccionadas.')
  }
}
