import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteGoogleDocsConnectionByUserId,
  findExtractionByIdForUser,
  findGoogleDocsConnectionByUserId,
  upsertGoogleDocsConnection,
} from '@/lib/db'
import {
  listExtractionTaskDependencies,
  listExtractionTasksWithEventsForUser,
} from '@/lib/db/extractions'
import { refreshGoogleAccessToken } from '@/lib/google-docs'
import { createGoogleSheetFromCsv, GoogleSheetsApiError } from '@/lib/google-sheets'
import { parseTaskNumericFormulaJson, resolveTaskNumericValues } from '@/lib/task-numeric-formulas'
import {
  buildTaskSpreadsheetCsv,
  buildTaskSpreadsheetRows,
  taskSpreadsheetRowToCells,
} from '@/lib/task-spreadsheet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isTokenExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  const value = new Date(expiresAt).getTime()
  if (!Number.isFinite(value)) return false
  return value <= Date.now() + 30_000
}

function shouldUseSpanish(req: NextRequest) {
  const header = req.headers.get('accept-language')?.toLowerCase() ?? ''
  return header.includes('es')
}

function getSheetHeaders(spanish: boolean) {
  if (spanish) {
    return [
      'Fase',
      'Posicion',
      'Item',
      'Estado',
      'Completado',
      'Valor numerico',
      'Valor manual',
      'Formula',
      'Inicio programado',
      'Fin programado',
      'Vence',
      'Completado en',
      'Duracion (dias)',
      'Predecesores',
      'Tipo',
      'Profundidad',
    ]
  }

  return [
    'Phase',
    'Position',
    'Item',
    'Status',
    'Completed',
    'Numeric value',
    'Manual value',
    'Formula',
    'Scheduled start',
    'Scheduled end',
    'Due at',
    'Completed at',
    'Duration (days)',
    'Predecessors',
    'Type',
    'Depth',
  ]
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { extractionId?: unknown }
    | null

  const extractionId =
    typeof body?.extractionId === 'string' ? body.extractionId.trim() : ''
  if (!extractionId) {
    return NextResponse.json({ error: 'extractionId es requerido.' }, { status: 400 })
  }

  const connection = await findGoogleDocsConnectionByUserId(user.id)
  if (!connection) {
    return NextResponse.json(
      { error: 'Primero conecta tu cuenta de Google.' },
      { status: 409 }
    )
  }

  const extraction = await findExtractionByIdForUser({
    id: extractionId,
    userId: user.id,
  })

  if (!extraction) {
    return NextResponse.json(
      { error: 'No se encontró la extracción seleccionada.' },
      { status: 404 }
    )
  }

  let accessToken = connection.access_token

  if (isTokenExpired(connection.token_expires_at)) {
    if (!connection.refresh_token) {
      await deleteGoogleDocsConnectionByUserId(user.id)
      return NextResponse.json(
        {
          error:
            'La conexión con Google expiró y no se pudo renovar automáticamente. Vuelve a conectar tu cuenta.',
        },
        { status: 401 }
      )
    }

    try {
      const refreshed = await refreshGoogleAccessToken(connection.refresh_token)
      accessToken = refreshed.access_token

      await upsertGoogleDocsConnection({
        userId: user.id,
        accessToken,
        refreshToken: refreshed.refresh_token ?? connection.refresh_token,
        tokenExpiresAt: refreshed.token_expires_at ?? connection.token_expires_at,
        scope: refreshed.scope ?? connection.scope,
        googleUserId: connection.google_user_id,
        userEmail: connection.user_email,
      })
    } catch (error: unknown) {
      await deleteGoogleDocsConnectionByUserId(user.id)
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo renovar la sesión de Google.'
      return NextResponse.json(
        {
          error: `${message} Vuelve a conectar tu cuenta.`,
        },
        { status: 401 }
      )
    }
  }

  const [tasks, depsMap] = await Promise.all([
    listExtractionTasksWithEventsForUser({ extractionId }),
    listExtractionTaskDependencies(extractionId),
  ])

  if (tasks.length === 0) {
    return NextResponse.json(
      { error: 'No hay tareas para exportar en esta hoja.' },
      { status: 400 }
    )
  }

  const spreadsheetTasks = tasks.map((task) => ({
    id: task.id,
    phaseTitle: task.phase_title,
    itemText: task.item_text,
    positionPath: task.position_path,
    phaseId: task.phase_id,
    itemIndex: task.item_index,
    status: task.status,
    checked: task.checked,
    numericValue: task.numeric_value,
    manualNumericValue: task.numeric_value,
    numericFormula: parseTaskNumericFormulaJson(task.numeric_formula_json),
    dueAt: task.due_at,
    completedAt: task.completed_at,
    scheduledStartAt: task.scheduled_start_at,
    scheduledEndAt: task.scheduled_end_at,
    durationDays: task.duration_days,
    predecessorIds: depsMap.get(task.id) ?? [],
    flowNodeType: task.flow_node_type ?? 'process',
    depth: task.depth,
  }))

  const resolvedValues = resolveTaskNumericValues(spreadsheetTasks)
  const spreadsheetRows = buildTaskSpreadsheetRows(
    spreadsheetTasks.map((task) => ({
      ...task,
      numericValue: resolvedValues.get(task.id) ?? null,
    }))
  )

  const headers = getSheetHeaders(shouldUseSpanish(req))
  const csv = buildTaskSpreadsheetCsv(
    headers,
    spreadsheetRows.map((row) => taskSpreadsheetRowToCells(row))
  )

  const baseTitle =
    extraction.video_title?.trim() ||
    extraction.objective.trim() ||
    'Action Extractor Sheet'

  try {
    const exported = await createGoogleSheetFromCsv({
      accessToken,
      title: `${baseTitle} - Sheets`,
      csvContent: csv,
    })

    return NextResponse.json({
      spreadsheetId: exported.spreadsheetId,
      spreadsheetUrl: exported.spreadsheetUrl,
    })
  } catch (error: unknown) {
    if (error instanceof GoogleSheetsApiError) {
      if (error.status === 401) {
        await deleteGoogleDocsConnectionByUserId(user.id)
        return NextResponse.json(
          {
            error:
              'La conexión con Google expiró o fue revocada. Vuelve a conectar tu cuenta.',
          },
          { status: 401 }
        )
      }

      if (error.status === 403) {
        return NextResponse.json(
          {
            error:
              'Google rechazó la exportación. Si conectaste tu cuenta antes de habilitar Sheets, vuelve a conectarla.',
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          error: error.message || 'No se pudo exportar a Google Sheets.',
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }

    const message =
      error instanceof Error ? error.message : 'No se pudo exportar a Google Sheets.'
    console.error('[ActionExtractor] google sheets export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
