import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { listExtractionsByUser } from '@/lib/db'
import { normalizeExtractionMode } from '@/lib/extraction-modes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function flattenPhaseItems(phases: Array<{ title: string; items: unknown[] }>): string[] {
  const result: string[] = []
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (typeof node === 'string') {
        result.push(node)
      } else if (node && typeof node === 'object') {
        const text = (node as { text?: string }).text
        if (typeof text === 'string' && text.trim()) result.push(text.trim())
        const children = (node as { children?: unknown[] }).children
        if (Array.isArray(children)) walk(children)
      }
    }
  }
  for (const phase of phases) {
    walk(phase.items)
  }
  return result
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'json'

    const rows = await listExtractionsByUser(user.id, 500)

    const records = rows.map((row) => {
      const phases = safeParse<Array<{ title: string; items: unknown[] }>>(row.phases_json, [])
      const metadata = safeParse<Record<string, string>>(row.metadata_json, {})
      const mode = normalizeExtractionMode(row.extraction_mode)

      return {
        id: row.id,
        orderNumber: row.order_number ?? 0,
        mode,
        url: row.url ?? '',
        sourceType: row.source_type ?? 'youtube',
        sourceLabel: row.source_label ?? '',
        videoTitle: row.video_title ?? '',
        objective: row.objective,
        proTip: row.pro_tip,
        phases: phases.map((p) => ({ title: p.title, items: flattenPhaseItems([p]) })),
        readingTime: metadata.readingTime ?? '',
        difficulty: metadata.difficulty ?? '',
        originalTime: metadata.originalTime ?? '',
        savedTime: metadata.savedTime ?? '',
        shareVisibility: row.share_visibility,
        isStarred: row.is_starred,
        folderId: row.folder_id ?? '',
        createdAt: row.created_at,
      }
    })

    if (format === 'json') {
      const body = JSON.stringify({ exportedAt: new Date().toISOString(), count: records.length, extractions: records }, null, 2)
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="roi-extractions-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      })
    }

    // CSV format
    const csvHeaders = [
      'id', 'orderNumber', 'mode', 'url', 'sourceType', 'sourceLabel',
      'videoTitle', 'objective', 'proTip', 'readingTime', 'difficulty',
      'originalTime', 'savedTime', 'shareVisibility', 'isStarred', 'folderId', 'createdAt',
    ]

    const escapeCsv = (value: unknown): string => {
      const str = value === null || value === undefined ? '' : String(value)
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvRows = [
      csvHeaders.join(','),
      ...records.map((r) =>
        csvHeaders.map((h) => escapeCsv(r[h as keyof typeof r])).join(',')
      ),
    ]

    const body = csvRows.join('\n')
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="roi-extractions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] account export GET error:', message)
    return NextResponse.json({ error: 'No se pudo exportar el historial.' }, { status: 500 })
  }
}
