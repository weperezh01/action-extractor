import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getExtractionSourceData } from '@/lib/db'

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

  // Sanitize URL before returning (only allow http/https)
  const safeUrl = data.url && /^https?:\/\//i.test(data.url) ? data.url : null
  const safeFileUrl =
    data.sourceFileUrl && (/^https?:\/\//i.test(data.sourceFileUrl) || data.sourceFileUrl.startsWith('/api/uploads/'))
      ? data.sourceFileUrl
      : null

  return NextResponse.json({
    sourceType: data.sourceType,
    sourceLabel: data.sourceLabel,
    url: safeUrl,
    videoId: data.videoId,
    thumbnailUrl: data.thumbnailUrl,
    videoTitle: data.videoTitle,
    hasSourceText: !!(data.sourceText && data.sourceText.length > 0),
    textLength: data.sourceText ? data.sourceText.length : 0,
    sourceFileUrl: safeFileUrl,
    sourceFileName: data.sourceFileName,
    sourceFileSizeBytes: data.sourceFileSizeBytes,
    sourceFileMimeType: data.sourceFileMimeType,
  })
}
