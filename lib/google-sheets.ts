const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

export class GoogleSheetsApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'GoogleSheetsApiError'
    this.status = status
    this.details = details
  }
}

async function parseResponseJson(response: Response) {
  return (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null
}

export async function createGoogleSheetFromCsv(input: {
  accessToken: string
  title: string
  csvContent: string
}) {
  const boundary = `action-extractor-${Date.now().toString(36)}`
  const metadata = JSON.stringify({
    name: input.title.slice(0, 120) || 'Action Extractor Sheet',
    mimeType: 'application/vnd.google-apps.spreadsheet',
  })

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/csv; charset=UTF-8',
    '',
    input.csvContent,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as
    | { id?: unknown; webViewLink?: unknown; error?: unknown }
    | null

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      typeof payload.error === 'object'
        ? 'Google rechazó la creación de la hoja.'
        : 'No se pudo crear la hoja en Google Sheets.'
    throw new GoogleSheetsApiError(message, response.status, payload)
  }

  const spreadsheetId = payload && typeof payload.id === 'string' ? payload.id : null
  if (!spreadsheetId) {
    throw new GoogleSheetsApiError(
      'Google Sheets devolvió una respuesta incompleta al crear la hoja.',
      502,
      payload
    )
  }

  return {
    spreadsheetId,
    spreadsheetUrl:
      typeof payload?.webViewLink === 'string' && payload.webViewLink.trim()
        ? payload.webViewLink
        : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`,
  }
}
