import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { extractPdfContent, extractDocxContent } from '@/lib/content-extractor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PDF_BYTES = 10 * 1024 * 1024  // 10 MB
const MAX_DOCX_BYTES = 5 * 1024 * 1024  // 5 MB

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo enviado.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No se proporcionó ningún archivo.' }, { status: 400 })
  }

  const filename = file.name ?? 'archivo'
  const lower = filename.toLowerCase()

  let sourceType: 'pdf' | 'docx'
  let maxBytes: number

  if (lower.endsWith('.pdf')) {
    sourceType = 'pdf'
    maxBytes = MAX_PDF_BYTES
  } else if (lower.endsWith('.docx')) {
    sourceType = 'docx'
    maxBytes = MAX_DOCX_BYTES
  } else {
    return NextResponse.json(
      { error: 'Formato no soportado. Solo se aceptan archivos .pdf y .docx.' },
      { status: 400 }
    )
  }

  if (file.size > maxBytes) {
    const limitMb = maxBytes / (1024 * 1024)
    return NextResponse.json(
      { error: `El archivo supera el límite de ${limitMb} MB para archivos ${sourceType.toUpperCase()}.` },
      { status: 413 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let extracted: { text: string; title: string | null; charCount: number }
  try {
    if (sourceType === 'pdf') {
      extracted = await extractPdfContent(buffer, filename)
    } else {
      extracted = await extractDocxContent(buffer, filename)
    }
  } catch (err: unknown) {
    console.error('[upload] extraction error:', err)
    return NextResponse.json(
      { error: 'No se pudo leer el contenido del archivo. Verifica que no esté protegido o dañado.' },
      { status: 422 }
    )
  }

  if (!extracted.text.trim()) {
    return NextResponse.json(
      { error: 'El archivo no contiene texto legible.' },
      { status: 422 }
    )
  }

  return NextResponse.json({
    text: extracted.text,
    charCount: extracted.charCount,
    sourceLabel: extracted.title ?? filename,
    sourceType,
  })
}
