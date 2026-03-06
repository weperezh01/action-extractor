import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getExtractionSourceData, getVideoCacheTranscript } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  const user = await getUserFromRequest(req)
  const extractionId = params.extractionId

  if (!extractionId) {
    return NextResponse.json({ error: 'ID de extracción requerido.' }, { status: 400 })
  }

  const data = await getExtractionSourceData({
    extractionId,
    requestingUserId: user?.id ?? null,
  })

  if (!data) {
    return NextResponse.json({ error: 'Extracción no encontrada o sin acceso.' }, { status: 404 })
  }

  let text: string | null = null

  if (data.sourceType === 'youtube' && data.videoId) {
    // YouTube transcript lives in the shared video_cache table
    text = await getVideoCacheTranscript(data.videoId)
  } else {
    text = data.sourceText
  }

  if (!text) {
    return NextResponse.json(
      { error: 'No hay texto de fuente disponible para esta extracción.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    text,
    length: text.length,
    sourceType: data.sourceType,
    sourceLabel: data.sourceLabel,
  })
}
