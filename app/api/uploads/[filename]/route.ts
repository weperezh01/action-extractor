import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { pool, ensureDbReady } from '@/lib/db'
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
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const filename = params.filename
  // Prevent path traversal
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Nombre de archivo inválido.' }, { status: 400 })
  }

  // Verify the file belongs to this user
  await ensureDbReady()
  const { rows } = await pool.query<{ source_file_mime_type: string | null; source_file_name: string | null }>(
    `SELECT source_file_mime_type, source_file_name FROM extractions
     WHERE user_id = $1 AND source_file_url = $2 LIMIT 1`,
    [user.id, `/api/uploads/${filename}`]
  )

  if (!rows[0]) {
    return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })
  }

  const filePath = path.join(UPLOADS_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Archivo no disponible en el servidor.' }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(filePath)
  const mimeType = rows[0].source_file_mime_type ?? 'application/octet-stream'
  const originalName = rows[0].source_file_name ?? filename

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
      'Content-Length': String(fileBuffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
