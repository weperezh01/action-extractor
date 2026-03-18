import { randomUUID } from 'node:crypto'
import {
  ensureDbReady,
  ensureDefaultExtractionFoldersForUser,
  pool,
  type DbExtractionAdditionalSource,
  type DbExtraction,
  type DbExtractionTag,
  type DbVideoCache,
  type ExtractionClonePermission,
  type ExtractionShareVisibility,
} from '@/lib/db'
import { buildSystemExtractionFolderIdForUser } from '@/lib/extraction-folders'

interface DbExtractionRow {
  id: string
  user_id: string
  parent_extraction_id?: string | null
  url: string | null
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  share_visibility?: string | null
  clone_permission?: string | null
  order_number?: number | string
  created_at: Date | string
  source_type?: string | null
  source_label?: string | null
  folder_id?: string | null
  is_starred?: boolean | null
  tags_json?: string | null
  source_text?: string | null
  source_file_url?: string | null
  source_file_name?: string | null
  source_file_size_bytes?: number | string | null
  source_file_mime_type?: string | null
  has_source_text?: boolean | null
  transcript_source?: string | null
}

interface DbVideoCacheRow {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  transcript_text: string | null
  prompt_version: string
  model: string
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbExtractionAdditionalSourceRow {
  id: string
  extraction_id: string
  created_by_user_id: string
  source_type: 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text'
  source_label: string | null
  url: string | null
  source_text: string | null
  source_file_url: string | null
  source_file_name: string | null
  source_file_size_bytes: number | string | null
  source_file_mime_type: string | null
  analysis_status: string | null
  analyzed_at: Date | string | null
  created_at: Date | string
}

interface DbExtractionOrderNumberRow {
  order_number: number | string
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseDbInteger(value: unknown) {
  return Number.parseInt(String(value ?? 0), 10) || 0
}

function normalizeExtractionShareVisibility(value: unknown): ExtractionShareVisibility {
  return value === 'circle' || value === 'unlisted' || value === 'public' ? value : 'private'
}

function normalizeExtractionClonePermission(value: unknown): ExtractionClonePermission {
  return value === 'template_only' || value === 'full' ? value : 'disabled'
}

function mapExtractionRow(row: DbExtractionRow): DbExtraction {
  const orderNumber =
    row.order_number === null || row.order_number === undefined
      ? undefined
      : parseDbInteger(row.order_number)
  const shareVisibility = normalizeExtractionShareVisibility(row.share_visibility)
  const clonePermission = normalizeExtractionClonePermission(row.clone_permission)

  return {
    id: row.id,
    user_id: row.user_id,
    parent_extraction_id: row.parent_extraction_id ?? null,
    url: row.url ?? null,
    video_id: row.video_id,
    video_title: row.video_title,
    thumbnail_url: row.thumbnail_url,
    extraction_mode: row.extraction_mode || 'action_plan',
    objective: row.objective,
    phases_json: row.phases_json,
    pro_tip: row.pro_tip,
    metadata_json: row.metadata_json,
    share_visibility: shareVisibility,
    clone_permission: clonePermission,
    order_number: orderNumber,
    created_at: toIso(row.created_at),
    source_type: row.source_type ?? 'youtube',
    source_label: row.source_label ?? null,
    folder_id: row.folder_id ?? null,
    is_starred: row.is_starred === true,
    tags: (() => {
      try {
        const parsed = row.tags_json ? JSON.parse(row.tags_json) : []
        return Array.isArray(parsed) ? (parsed as DbExtractionTag[]) : []
      } catch {
        return []
      }
    })(),
    source_text: row.source_text ?? null,
    source_file_url: row.source_file_url ?? null,
    source_file_name: row.source_file_name ?? null,
    source_file_size_bytes: row.source_file_size_bytes != null ? Number(row.source_file_size_bytes) : null,
    source_file_mime_type: row.source_file_mime_type ?? null,
    has_source_text: row.has_source_text === true || !!(row.source_text && row.source_text.length > 0),
    transcript_source: row.transcript_source ?? null,
  }
}

function mapVideoCacheRow(row: DbVideoCacheRow): DbVideoCache {
  return {
    video_id: row.video_id,
    video_title: row.video_title,
    thumbnail_url: row.thumbnail_url,
    objective: row.objective,
    phases_json: row.phases_json,
    pro_tip: row.pro_tip,
    metadata_json: row.metadata_json,
    transcript_text: row.transcript_text,
    prompt_version: row.prompt_version,
    model: row.model,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapExtractionAdditionalSourceRow(row: DbExtractionAdditionalSourceRow): DbExtractionAdditionalSource {
  return {
    id: row.id,
    extraction_id: row.extraction_id,
    created_by_user_id: row.created_by_user_id,
    source_type: row.source_type,
    source_label: row.source_label ?? null,
    url: row.url ?? null,
    source_text: row.source_text ?? null,
    source_file_url: row.source_file_url ?? null,
    source_file_name: row.source_file_name ?? null,
    source_file_size_bytes: row.source_file_size_bytes != null ? Number(row.source_file_size_bytes) : null,
    source_file_mime_type: row.source_file_mime_type ?? null,
    analysis_status: row.analysis_status === 'analyzed' ? 'analyzed' : 'pending',
    analyzed_at: row.analyzed_at ? toIso(row.analyzed_at) : null,
    created_at: toIso(row.created_at),
  }
}

export async function createExtraction(input: {
  id?: string
  userId: string
  parentExtractionId?: string | null
  url: string | null
  videoId: string | null
  videoTitle: string | null
  thumbnailUrl: string | null
  extractionMode: string
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
  sourceType?: string
  sourceLabel?: string | null
  sourceText?: string | null
  sourceFileUrl?: string | null
  sourceFileName?: string | null
  sourceFileSizeBytes?: number | null
  sourceFileMimeType?: string | null
  transcriptSource?: string | null
  folderId?: string | null
  shareVisibility?: ExtractionShareVisibility
  clonePermission?: ExtractionClonePermission
}) {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(input.userId)
  const id = input.id ?? randomUUID()
  const sourceType = input.sourceType ?? 'youtube'
  const defaultFolderId = buildSystemExtractionFolderIdForUser({
    userId: input.userId,
    key: 'general',
  })
  const resolvedFolderId = input.folderId?.trim() || defaultFolderId
  const resolvedShareVisibility = input.shareVisibility ?? 'private'
  const resolvedClonePermission = input.clonePermission ?? 'disabled'
  const { rows } = await pool.query<DbExtractionRow>(
    `
      INSERT INTO extractions (
        id,
        user_id,
        parent_extraction_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        share_visibility,
        clone_permission,
        source_type,
        source_label,
        folder_id,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        transcript_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING
        id,
        user_id,
        parent_extraction_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        share_visibility,
        clone_permission,
        created_at,
        source_type,
        source_label,
        folder_id,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        transcript_source
    `,
    [
      id,
      input.userId,
      input.parentExtractionId ?? null,
      input.url,
      input.videoId,
      input.videoTitle,
      input.thumbnailUrl,
      input.extractionMode,
      input.objective,
      input.phasesJson,
      input.proTip,
      input.metadataJson,
      resolvedShareVisibility,
      resolvedClonePermission,
      sourceType,
      input.sourceLabel ?? null,
      resolvedFolderId,
      input.sourceText ?? null,
      input.sourceFileUrl ?? null,
      input.sourceFileName ?? null,
      input.sourceFileSizeBytes ?? null,
      input.sourceFileMimeType ?? null,
      input.transcriptSource ?? null,
    ]
  )

  return mapExtractionRow(rows[0])
}

export async function getExtractionSourceData(input: {
  extractionId: string
  requestingUserId: string | null
}): Promise<{
  sourceType: string
  sourceLabel: string | null
  url: string | null
  videoId: string | null
  thumbnailUrl: string | null
  videoTitle: string | null
  sourceText: string | null
  sourceFileUrl: string | null
  sourceFileName: string | null
  sourceFileSizeBytes: number | null
  sourceFileMimeType: string | null
  shareVisibility: ExtractionShareVisibility
  userId: string
} | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{
    id: string
    user_id: string
    url: string | null
    video_id: string | null
    video_title: string | null
    thumbnail_url: string | null
    share_visibility: string | null
    source_type: string | null
    source_label: string | null
    source_text: string | null
    source_file_url: string | null
    source_file_name: string | null
    source_file_size_bytes: number | null
    source_file_mime_type: string | null
    has_access: boolean
  }>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.share_visibility,
        e.source_type,
        e.source_label,
        e.source_text,
        e.source_file_url,
        e.source_file_name,
        e.source_file_size_bytes,
        e.source_file_mime_type,
        (
          e.user_id = $2
          OR e.share_visibility IN ('public', 'unlisted')
          OR EXISTS (
            SELECT 1 FROM extraction_members m
            WHERE m.extraction_id = e.id AND m.user_id = $2
          )
        ) AS has_access
      FROM extractions e
      WHERE e.id = $1
      LIMIT 1
    `,
    [input.extractionId, input.requestingUserId ?? '']
  )

  if (!rows[0] || !rows[0].has_access) return null

  const row = rows[0]
  return {
    sourceType: row.source_type ?? 'youtube',
    sourceLabel: row.source_label ?? null,
    url: row.url ?? null,
    videoId: row.video_id ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    videoTitle: row.video_title ?? null,
    sourceText: row.source_text ?? null,
    sourceFileUrl: row.source_file_url ?? null,
    sourceFileName: row.source_file_name ?? null,
    sourceFileSizeBytes: row.source_file_size_bytes != null ? Number(row.source_file_size_bytes) : null,
    sourceFileMimeType: row.source_file_mime_type ?? null,
    shareVisibility: normalizeExtractionShareVisibility(row.share_visibility),
    userId: row.user_id,
  }
}

export async function getVideoCacheTranscript(videoId: string): Promise<string | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{ transcript_text: string | null }>(
    `SELECT transcript_text FROM video_cache WHERE video_id = $1 LIMIT 1`,
    [videoId]
  )
  return rows[0]?.transcript_text ?? null
}

export async function findExtractionOrderNumberForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionOrderNumberRow>(
    `
      SELECT
        1 + COUNT(*) FILTER (
          WHERE created_at < target.created_at OR (created_at = target.created_at AND id <= target.id)
        ) AS order_number
      FROM extractions, (
        SELECT created_at, id
        FROM extractions
        WHERE id = $1 AND user_id = $2
      ) AS target
      WHERE user_id = $2
    `,
    [input.id, input.userId]
  )
  const row = rows[0]
  return row ? parseDbInteger(row.order_number) : null
}

export async function findExtractionByIdForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        id,
        user_id,
        parent_extraction_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        share_visibility,
        created_at,
        clone_permission,
        source_type,
        source_label,
        folder_id,
        is_starred,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        (source_text IS NOT NULL AND source_text <> '') AS has_source_text,
        transcript_source,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name),
            '[]'::jsonb
          )
          FROM extraction_tag_assignments eta
          JOIN extraction_tags t ON t.id = eta.tag_id
          WHERE eta.extraction_id = extractions.id
        )::text AS tags_json
      FROM extractions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [input.id, input.userId]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function listExtractionAdditionalSources(input: {
  extractionId: string
  requestingUserId: string | null
}): Promise<DbExtractionAdditionalSource[] | null> {
  await ensureDbReady()
  const { rows } = await pool.query<
    DbExtractionAdditionalSourceRow & { has_access: boolean }
  >(
    `
      SELECT
        s.id,
        s.extraction_id,
        s.created_by_user_id,
        s.source_type,
        s.source_label,
        s.url,
        s.source_text,
        s.source_file_url,
        s.source_file_name,
        s.source_file_size_bytes,
        s.source_file_mime_type,
        s.analysis_status,
        s.analyzed_at,
        s.created_at,
        (
          e.user_id = $2
          OR e.share_visibility IN ('public', 'unlisted')
          OR EXISTS (
            SELECT 1 FROM extraction_members m
            WHERE m.extraction_id = e.id AND m.user_id = $2
          )
        ) AS has_access
      FROM extraction_additional_sources s
      INNER JOIN extractions e ON e.id = s.extraction_id
      WHERE s.extraction_id = $1
      ORDER BY s.created_at ASC
    `,
    [input.extractionId, input.requestingUserId ?? '']
  )

  if (rows.length === 0) {
    const accessCheck = await pool.query<{ has_access: boolean }>(
      `
        SELECT (
          e.user_id = $2
          OR e.share_visibility IN ('public', 'unlisted')
          OR EXISTS (
            SELECT 1 FROM extraction_members m
            WHERE m.extraction_id = e.id AND m.user_id = $2
          )
        ) AS has_access
        FROM extractions e
        WHERE e.id = $1
        LIMIT 1
      `,
      [input.extractionId, input.requestingUserId ?? '']
    )

    if (!accessCheck.rows[0]?.has_access) return null
    return []
  }

  if (!rows[0].has_access) return null
  return rows.map(mapExtractionAdditionalSourceRow)
}

export async function createExtractionAdditionalSourceForUser(input: {
  extractionId: string
  userId: string
  sourceType: 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text'
  sourceLabel: string | null
  url: string | null
  sourceText?: string | null
  sourceFileUrl?: string | null
  sourceFileName?: string | null
  sourceFileSizeBytes?: number | null
  sourceFileMimeType?: string | null
  analysisStatus?: 'pending' | 'analyzed'
  analyzedAt?: string | null
}): Promise<DbExtractionAdditionalSource | null> {
  await ensureDbReady()
  const id = randomUUID()
  const resolvedAnalysisStatus = input.analysisStatus ?? 'pending'
  const { rows } = await pool.query<DbExtractionAdditionalSourceRow>(
    `
      INSERT INTO extraction_additional_sources (
        id,
        extraction_id,
        created_by_user_id,
        source_type,
        source_label,
        url,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        analysis_status,
        analyzed_at
      )
      SELECT
        $1,
        e.id,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      FROM extractions e
      WHERE e.id = $13 AND e.user_id = $2
      ON CONFLICT (extraction_id, url) DO NOTHING
      RETURNING
        id,
        extraction_id,
        created_by_user_id,
        source_type,
        source_label,
        url,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        analysis_status,
        analyzed_at,
        created_at
    `,
    [
      id,
      input.userId,
      input.sourceType,
      input.sourceLabel ?? null,
      input.url ?? null,
      input.sourceText ?? null,
      input.sourceFileUrl ?? null,
      input.sourceFileName ?? null,
      input.sourceFileSizeBytes ?? null,
      input.sourceFileMimeType ?? null,
      resolvedAnalysisStatus,
      resolvedAnalysisStatus === 'analyzed' ? (input.analyzedAt ?? new Date().toISOString()) : null,
      input.extractionId,
    ]
  )

  return rows[0] ? mapExtractionAdditionalSourceRow(rows[0]) : null
}

export async function markExtractionAdditionalSourcesAnalyzedForUser(input: {
  extractionId: string
  userId: string
  sourceIds: string[]
}) {
  await ensureDbReady()
  const normalizedIds = Array.from(new Set(input.sourceIds.map((value) => value.trim()).filter(Boolean)))
  if (normalizedIds.length === 0) return []

  const { rows } = await pool.query<DbExtractionAdditionalSourceRow>(
    `
      UPDATE extraction_additional_sources s
      SET
        analysis_status = 'analyzed',
        analyzed_at = COALESCE(s.analyzed_at, NOW())
      FROM extractions e
      WHERE
        s.extraction_id = $1
        AND s.id = ANY($2::text[])
        AND e.id = s.extraction_id
        AND e.user_id = $3
      RETURNING
        s.id,
        s.extraction_id,
        s.created_by_user_id,
        s.source_type,
        s.source_label,
        s.url,
        s.source_text,
        s.source_file_url,
        s.source_file_name,
        s.source_file_size_bytes,
        s.source_file_mime_type,
        s.analysis_status,
        s.analyzed_at,
        s.created_at
    `,
    [input.extractionId, normalizedIds, input.userId]
  )

  return rows.map(mapExtractionAdditionalSourceRow)
}

export async function findVideoCacheByVideoId(input: {
  videoId: string
  promptVersion: string
  model: string
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbVideoCacheRow>(
    `
      SELECT
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model,
        created_at,
        updated_at,
        last_used_at
      FROM video_cache
      WHERE video_id = $1
        AND prompt_version = $2
        AND model = $3
      LIMIT 1
    `,
    [input.videoId, input.promptVersion, input.model]
  )

  const row = rows[0]
  if (!row) return null

  const touchedAt = new Date().toISOString()
  void pool
    .query(
      `
        UPDATE video_cache
        SET last_used_at = NOW()
        WHERE video_id = $1
      `,
      [input.videoId]
    )
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown video cache touch error'
      console.error(`[db] Failed to update video cache last_used_at for ${input.videoId}: ${message}`)
    })

  return mapVideoCacheRow({
    ...row,
    last_used_at: touchedAt,
  })
}

export async function findAnyVideoCacheByVideoId(videoId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbVideoCacheRow>(
    `
      SELECT
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model,
        created_at,
        updated_at,
        last_used_at
      FROM video_cache
      WHERE video_id = $1
      LIMIT 1
    `,
    [videoId]
  )

  const row = rows[0]
  if (!row) return null

  const touchedAt = new Date().toISOString()
  void pool
    .query(
      `
        UPDATE video_cache
        SET last_used_at = NOW()
        WHERE video_id = $1
      `,
      [videoId]
    )
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown video cache touch error'
      console.error(`[db] Failed to update video cache last_used_at for ${videoId}: ${message}`)
    })

  return mapVideoCacheRow({
    ...row,
    last_used_at: touchedAt,
  })
}

export async function upsertVideoCache(input: {
  videoId: string
  videoTitle: string | null
  thumbnailUrl: string | null
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
  transcriptText?: string | null
  promptVersion: string
  model: string
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbVideoCacheRow>(
    `
      INSERT INTO video_cache (
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (video_id)
      DO UPDATE SET
        video_title = EXCLUDED.video_title,
        thumbnail_url = EXCLUDED.thumbnail_url,
        objective = EXCLUDED.objective,
        phases_json = EXCLUDED.phases_json,
        pro_tip = EXCLUDED.pro_tip,
        metadata_json = EXCLUDED.metadata_json,
        transcript_text = COALESCE(EXCLUDED.transcript_text, video_cache.transcript_text),
        prompt_version = EXCLUDED.prompt_version,
        model = EXCLUDED.model,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model,
        created_at,
        updated_at,
        last_used_at
    `,
    [
      input.videoId,
      input.videoTitle,
      input.thumbnailUrl,
      input.objective,
      input.phasesJson,
      input.proTip,
      input.metadataJson,
      input.transcriptText ?? null,
      input.promptVersion,
      input.model,
    ]
  )

  return mapVideoCacheRow(rows[0])
}

export async function updateExtractionGeneratedContentForUser(input: {
  id: string
  userId: string
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions e
      SET
        objective = $1,
        phases_json = $2,
        pro_tip = $3,
        metadata_json = $4
      WHERE e.id = $5 AND e.user_id = $6
      RETURNING
        id,
        user_id,
        parent_extraction_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        share_visibility,
        clone_permission,
        created_at,
        source_type,
        source_label,
        folder_id,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        transcript_source
    `,
    [
      input.objective,
      input.phasesJson,
      input.proTip,
      input.metadataJson,
      input.id,
      input.userId,
    ]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}
