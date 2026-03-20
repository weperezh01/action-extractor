import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findReadableUploadFileByUrl } from '@/lib/db/extractions'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const user = await getUserFromRequest(req)

  const filename = params.filename
  // Prevent path traversal
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Nombre de archivo inválido.' }, { status: 400 })
  }

  const fileRecord = await findReadableUploadFileByUrl({
    fileUrl: `/api/uploads/${filename}`,
    requestingUserId: user?.id ?? null,
  })

  if (!fileRecord) {
    return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })
  }

  const filePath = path.join(UPLOADS_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Archivo no disponible en el servidor.' }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(filePath)
  const mimeType = fileRecord.sourceFileMimeType ?? 'application/octet-stream'
  const originalName = fileRecord.sourceFileName ?? filename
  const isPublicFile =
    fileRecord.shareVisibility === 'public' || fileRecord.shareVisibility === 'unlisted'

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
      'Content-Length': String(fileBuffer.length),
      'Cache-Control': isPublicFile ? 'public, max-age=3600' : 'private, max-age=3600',
    },
  })
}
