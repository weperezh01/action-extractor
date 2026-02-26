import { randomUUID } from 'node:crypto'
import { pool, ensureDbReady } from '@/lib/db'
import { flattenPlaybookPhases, normalizePlaybookPhases } from '@/lib/playbook-tree'
import type {
  ExtractionTaskStatus,
  ExtractionTaskEventType,
  ExtractionTaskAttachmentType,
  ExtractionTaskAttachmentStorageProvider,
} from '@/lib/db'

// ── Types ──────────────────────────────────────────────────────────────────

export interface GuestTask {
  id: string
  guestId: string
  phaseId: number
  phaseTitle: string
  itemIndex: number
  itemText: string
  checked: boolean
  status: ExtractionTaskStatus
  createdAt: string
  updatedAt: string
  events: GuestTaskEvent[]
}

export interface GuestTaskEvent {
  id: string
  taskId: string
  eventType: ExtractionTaskEventType
  content: string
  metadataJson: string
  createdAt: string
}

export interface GuestTaskComment {
  id: string
  taskId: string
  guestId: string
  parentCommentId: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface GuestTaskAttachment {
  id: string
  taskId: string
  guestId: string
  attachmentType: ExtractionTaskAttachmentType
  storageProvider: ExtractionTaskAttachmentStorageProvider
  url: string
  thumbnailUrl: string | null
  title: string | null
  mimeType: string | null
  metadataJson: string
  createdAt: string
  updatedAt: string
}

// ── Internal helpers ───────────────────────────────────────────────────────

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value as string)
  if (Number.isNaN(parsed.getTime())) return value as string
  return parsed.toISOString()
}

// ── Task operations ────────────────────────────────────────────────────────

export async function syncGuestTasks(input: {
  guestId: string
  phases: unknown
}): Promise<void> {
  await ensureDbReady()
  const { guestId } = input
  const phases = normalizePlaybookPhases(input.phases)
  const rows = flattenPlaybookPhases(phases)
  const rowsByPhase = new Map<number, typeof rows>()
  for (const row of rows) {
    const bucket = rowsByPhase.get(row.phaseId) ?? []
    bucket.push(row)
    rowsByPhase.set(row.phaseId, bucket)
  }

  for (const phase of phases) {
    const phaseRows = rowsByPhase.get(phase.id) ?? []
    for (const row of phaseRows) {
      await pool.query(
        `INSERT INTO guest_tasks (id, guest_id, phase_id, phase_title, item_index, item_text)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (guest_id, phase_id, item_index)
         DO UPDATE SET
           phase_title = EXCLUDED.phase_title,
           item_text = EXCLUDED.item_text,
           updated_at = NOW()`,
        [randomUUID(), guestId, row.phaseId, row.phaseTitle, row.itemIndex, row.itemText]
      )
    }
  }
}

export async function listGuestTasksWithEvents(guestId: string): Promise<GuestTask[]> {
  await ensureDbReady()

  const { rows: taskRows } = await pool.query<{
    id: string
    guest_id: string
    phase_id: number | string
    phase_title: string
    item_index: number | string
    item_text: string
    checked: boolean
    status: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `SELECT id, guest_id, phase_id, phase_title, item_index, item_text, checked, status, created_at, updated_at
     FROM guest_tasks
     WHERE guest_id = $1
     ORDER BY phase_id ASC, item_index ASC`,
    [guestId]
  )

  if (taskRows.length === 0) return []

  const taskIds = taskRows.map((r) => r.id)
  const { rows: eventRows } = await pool.query<{
    id: string
    task_id: string
    event_type: string
    content: string
    metadata_json: string
    created_at: Date | string
  }>(
    `SELECT id, task_id, event_type, content, metadata_json, created_at
     FROM guest_task_events
     WHERE task_id = ANY($1)
     ORDER BY created_at ASC`,
    [taskIds]
  )

  const eventsByTaskId = new Map<string, GuestTaskEvent[]>()
  for (const e of eventRows) {
    const arr = eventsByTaskId.get(e.task_id) ?? []
    arr.push({
      id: e.id,
      taskId: e.task_id,
      eventType: e.event_type as ExtractionTaskEventType,
      content: e.content,
      metadataJson: e.metadata_json,
      createdAt: toIso(e.created_at),
    })
    eventsByTaskId.set(e.task_id, arr)
  }

  return taskRows.map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    phaseId: Number(r.phase_id),
    phaseTitle: r.phase_title,
    itemIndex: Number(r.item_index),
    itemText: r.item_text,
    checked: r.checked,
    status: r.status as ExtractionTaskStatus,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    events: eventsByTaskId.get(r.id) ?? [],
  }))
}

export async function findGuestTaskById(input: {
  guestId: string
  taskId: string
}): Promise<GuestTask | null> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    id: string
    guest_id: string
    phase_id: number | string
    phase_title: string
    item_index: number | string
    item_text: string
    checked: boolean
    status: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `SELECT id, guest_id, phase_id, phase_title, item_index, item_text, checked, status, created_at, updated_at
     FROM guest_tasks WHERE id = $1 AND guest_id = $2`,
    [input.taskId, input.guestId]
  )

  if (!rows[0]) return null
  const r = rows[0]

  const { rows: eventRows } = await pool.query<{
    id: string
    task_id: string
    event_type: string
    content: string
    metadata_json: string
    created_at: Date | string
  }>(
    `SELECT id, task_id, event_type, content, metadata_json, created_at
     FROM guest_task_events WHERE task_id = $1 ORDER BY created_at ASC`,
    [r.id]
  )

  return {
    id: r.id,
    guestId: r.guest_id,
    phaseId: Number(r.phase_id),
    phaseTitle: r.phase_title,
    itemIndex: Number(r.item_index),
    itemText: r.item_text,
    checked: r.checked,
    status: r.status as ExtractionTaskStatus,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    events: eventRows.map((e) => ({
      id: e.id,
      taskId: e.task_id,
      eventType: e.event_type as ExtractionTaskEventType,
      content: e.content,
      metadataJson: e.metadata_json,
      createdAt: toIso(e.created_at),
    })),
  }
}

export async function updateGuestTask(input: {
  guestId: string
  taskId: string
  checked: boolean
  status: ExtractionTaskStatus
}): Promise<GuestTask | null> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    id: string
    guest_id: string
    phase_id: number | string
    phase_title: string
    item_index: number | string
    item_text: string
    checked: boolean
    status: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `UPDATE guest_tasks
     SET checked = $3, status = $4, updated_at = NOW()
     WHERE id = $1 AND guest_id = $2
     RETURNING id, guest_id, phase_id, phase_title, item_index, item_text, checked, status, created_at, updated_at`,
    [input.taskId, input.guestId, input.checked, input.status]
  )

  if (!rows[0]) return null
  const r = rows[0]

  return {
    id: r.id,
    guestId: r.guest_id,
    phaseId: Number(r.phase_id),
    phaseTitle: r.phase_title,
    itemIndex: Number(r.item_index),
    itemText: r.item_text,
    checked: r.checked,
    status: r.status as ExtractionTaskStatus,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    events: [],
  }
}

export async function addGuestTaskEvent(input: {
  guestId: string
  taskId: string
  eventType: ExtractionTaskEventType
  content: string
  metadataJson: string
}): Promise<boolean> {
  await ensureDbReady()

  const { rows: checkRows } = await pool.query<{ id: string }>(
    `SELECT id FROM guest_tasks WHERE id = $1 AND guest_id = $2`,
    [input.taskId, input.guestId]
  )
  if (!checkRows[0]) return false

  await pool.query(
    `INSERT INTO guest_task_events (id, task_id, guest_id, event_type, content, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), input.taskId, input.guestId, input.eventType, input.content, input.metadataJson]
  )
  return true
}

// ── Attachment operations ──────────────────────────────────────────────────

export async function listGuestTaskAttachments(input: {
  guestId: string
  taskId: string
}): Promise<GuestTaskAttachment[]> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    id: string
    task_id: string
    guest_id: string
    attachment_type: string
    storage_provider: string
    url: string
    thumbnail_url: string | null
    title: string | null
    mime_type: string | null
    metadata_json: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `SELECT id, task_id, guest_id, attachment_type, storage_provider, url, thumbnail_url,
            title, mime_type, metadata_json, created_at, updated_at
     FROM guest_task_attachments
     WHERE task_id = $1 AND guest_id = $2
     ORDER BY created_at ASC`,
    [input.taskId, input.guestId]
  )

  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    guestId: r.guest_id,
    attachmentType: r.attachment_type as ExtractionTaskAttachmentType,
    storageProvider: r.storage_provider as ExtractionTaskAttachmentStorageProvider,
    url: r.url,
    thumbnailUrl: r.thumbnail_url,
    title: r.title,
    mimeType: r.mime_type,
    metadataJson: r.metadata_json,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }))
}

export async function createGuestTaskAttachment(input: {
  guestId: string
  taskId: string
  attachmentType: ExtractionTaskAttachmentType
  storageProvider: ExtractionTaskAttachmentStorageProvider
  url: string
  thumbnailUrl: string | null
  title: string | null
  mimeType?: string | null
  metadataJson?: string
}): Promise<GuestTaskAttachment | null> {
  await ensureDbReady()

  const { rows: checkRows } = await pool.query<{ id: string }>(
    `SELECT id FROM guest_tasks WHERE id = $1 AND guest_id = $2`,
    [input.taskId, input.guestId]
  )
  if (!checkRows[0]) return null

  const id = randomUUID()
  const { rows } = await pool.query<{
    id: string
    task_id: string
    guest_id: string
    attachment_type: string
    storage_provider: string
    url: string
    thumbnail_url: string | null
    title: string | null
    mime_type: string | null
    metadata_json: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `INSERT INTO guest_task_attachments
       (id, task_id, guest_id, attachment_type, storage_provider, url, thumbnail_url, title, mime_type, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, task_id, guest_id, attachment_type, storage_provider, url, thumbnail_url,
               title, mime_type, metadata_json, created_at, updated_at`,
    [
      id,
      input.taskId,
      input.guestId,
      input.attachmentType,
      input.storageProvider,
      input.url,
      input.thumbnailUrl ?? null,
      input.title ?? null,
      input.mimeType ?? null,
      input.metadataJson ?? '{}',
    ]
  )

  if (!rows[0]) return null
  const r = rows[0]
  return {
    id: r.id,
    taskId: r.task_id,
    guestId: r.guest_id,
    attachmentType: r.attachment_type as ExtractionTaskAttachmentType,
    storageProvider: r.storage_provider as ExtractionTaskAttachmentStorageProvider,
    url: r.url,
    thumbnailUrl: r.thumbnail_url,
    title: r.title,
    mimeType: r.mime_type,
    metadataJson: r.metadata_json,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }
}

export async function deleteGuestTaskAttachment(input: {
  guestId: string
  taskId: string
  attachmentId: string
}): Promise<GuestTaskAttachment | null> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    id: string
    task_id: string
    guest_id: string
    attachment_type: string
    storage_provider: string
    url: string
    thumbnail_url: string | null
    title: string | null
    mime_type: string | null
    metadata_json: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `DELETE FROM guest_task_attachments
     WHERE id = $1 AND task_id = $2 AND guest_id = $3
     RETURNING id, task_id, guest_id, attachment_type, storage_provider, url, thumbnail_url,
               title, mime_type, metadata_json, created_at, updated_at`,
    [input.attachmentId, input.taskId, input.guestId]
  )

  if (!rows[0]) return null
  const r = rows[0]
  return {
    id: r.id,
    taskId: r.task_id,
    guestId: r.guest_id,
    attachmentType: r.attachment_type as ExtractionTaskAttachmentType,
    storageProvider: r.storage_provider as ExtractionTaskAttachmentStorageProvider,
    url: r.url,
    thumbnailUrl: r.thumbnail_url,
    title: r.title,
    mimeType: r.mime_type,
    metadataJson: r.metadata_json,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }
}

// ── Community operations ───────────────────────────────────────────────────

export async function listGuestTaskComments(input: {
  guestId: string
  taskId: string
}): Promise<GuestTaskComment[]> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    id: string
    task_id: string
    guest_id: string
    parent_comment_id: string | null
    content: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `SELECT id, task_id, guest_id, parent_comment_id, content, created_at, updated_at
     FROM guest_task_comments
     WHERE task_id = $1 AND guest_id = $2
     ORDER BY created_at ASC`,
    [input.taskId, input.guestId]
  )

  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    guestId: r.guest_id,
    parentCommentId: r.parent_comment_id ?? null,
    content: r.content,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }))
}

export async function addGuestTaskComment(input: {
  guestId: string
  taskId: string
  content: string
  parentCommentId?: string | null
}): Promise<GuestTaskComment | null> {
  await ensureDbReady()
  const parentCommentId = typeof input.parentCommentId === 'string' ? input.parentCommentId.trim() : null

  const { rows: checkRows } = await pool.query<{ id: string }>(
    `SELECT id FROM guest_tasks WHERE id = $1 AND guest_id = $2`,
    [input.taskId, input.guestId]
  )
  if (!checkRows[0]) return null

  const { rows } = await pool.query<{
    id: string
    task_id: string
    guest_id: string
    parent_comment_id: string | null
    content: string
    created_at: Date | string
    updated_at: Date | string
  }>(
    `
      WITH parent_comment AS (
        SELECT c.id
        FROM guest_task_comments c
        WHERE
          c.id = $5
          AND c.task_id = $2
          AND c.guest_id = $3
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO guest_task_comments (id, task_id, guest_id, parent_comment_id, content)
        SELECT
          $1,
          $2,
          $3,
          parent_comment.id,
          $4
        FROM (SELECT 1) _
        LEFT JOIN parent_comment ON TRUE
        WHERE $5::text IS NULL OR parent_comment.id IS NOT NULL
        RETURNING id, task_id, guest_id, parent_comment_id, content, created_at, updated_at
      )
      SELECT * FROM inserted
    `,
    [randomUUID(), input.taskId, input.guestId, input.content, parentCommentId]
  )

  if (!rows[0]) return null
  const r = rows[0]
  return {
    id: r.id,
    taskId: r.task_id,
    guestId: r.guest_id,
    parentCommentId: r.parent_comment_id ?? null,
    content: r.content,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }
}

export async function deleteGuestTaskComment(input: {
  guestId: string
  taskId: string
  commentId: string
}): Promise<boolean> {
  await ensureDbReady()

  const { rowCount } = await pool.query(
    `
      WITH target AS (
        SELECT id, parent_comment_id
        FROM guest_task_comments
        WHERE id = $1 AND task_id = $2 AND guest_id = $3
        LIMIT 1
      ),
      reparented AS (
        UPDATE guest_task_comments child
        SET parent_comment_id = target.parent_comment_id
        FROM target
        WHERE
          child.parent_comment_id = target.id
          AND child.task_id = $2
          AND child.guest_id = $3
        RETURNING child.id
      )
      DELETE FROM guest_task_comments c
      USING target
      WHERE c.id = target.id
    `,
    [input.commentId, input.taskId, input.guestId]
  )
  return (rowCount ?? 0) > 0
}

export async function getGuestTaskLikeSummary(input: {
  guestId: string
  taskId: string
}): Promise<{ likesCount: number; likedByMe: boolean }> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    likes_count: number | string
    liked_by_me: boolean
  }>(
    `SELECT COUNT(*) AS likes_count, BOOL_OR(guest_id = $2) AS liked_by_me
     FROM guest_task_likes WHERE task_id = $1`,
    [input.taskId, input.guestId]
  )

  return {
    likesCount: Number(rows[0]?.likes_count ?? 0),
    likedByMe: rows[0]?.liked_by_me ?? false,
  }
}

export async function toggleGuestTaskLike(input: {
  guestId: string
  taskId: string
}): Promise<boolean> {
  await ensureDbReady()

  const { rows: checkRows } = await pool.query<{ id: string }>(
    `SELECT id FROM guest_tasks WHERE id = $1 AND guest_id = $2`,
    [input.taskId, input.guestId]
  )
  if (!checkRows[0]) return false

  const { rows: existingRows } = await pool.query<{ id: string }>(
    `SELECT id FROM guest_task_likes WHERE task_id = $1 AND guest_id = $2`,
    [input.taskId, input.guestId]
  )
  if (existingRows[0]) {
    await pool.query(
      `DELETE FROM guest_task_likes WHERE task_id = $1 AND guest_id = $2`,
      [input.taskId, input.guestId]
    )
  } else {
    await pool.query(
      `INSERT INTO guest_task_likes (id, task_id, guest_id) VALUES ($1, $2, $3)`,
      [randomUUID(), input.taskId, input.guestId]
    )
  }
  return true
}
