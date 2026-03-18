import { randomUUID } from 'node:crypto'
import {
  ensureDbReady,
  ensureDefaultExtractionFoldersForUser,
  pool,
  type DbExtractionAdditionalSource,
  type DbExtraction,
  type DbExtractionFolder,
  type DbExtractionTag,
  type DbExtractionTask,
  type DbExtractionTaskEvent,
  type DbVideoCache,
  type ExtractionAccessRole,
  type ExtractionClonePermission,
  type ExtractionShareVisibility,
  type ExtractionTaskEventType,
  type ExtractionTaskStatus,
} from '@/lib/db'
import { buildSystemExtractionFolderIdForUser } from '@/lib/extraction-folders'
import { flattenPlaybookPhases, normalizePlaybookPhases } from '@/lib/playbook-tree'
import {
  parseTaskNumericFormulaJson,
  serializeTaskNumericFormula,
} from '@/lib/task-numeric-formulas'

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

interface DbExtractionFolderRow {
  id: string
  user_id: string
  name: string
  color: string
  parent_id: string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbExtractionAccessRow extends DbExtractionRow {
  access_role: string | null
}

interface DbExtractionTaskRow {
  id: string
  extraction_id: string
  user_id: string
  phase_id: number | string
  phase_title: string
  item_index: number | string
  item_text: string
  node_id: string | null
  parent_node_id: string | null
  depth: number | string | null
  position_path: string | null
  checked: boolean
  status: ExtractionTaskStatus
  numeric_value: number | string | null
  numeric_formula_json: string | null
  due_at: Date | string | null
  completed_at: Date | string | null
  scheduled_start_at: Date | string | null
  scheduled_end_at: Date | string | null
  duration_days: number | string
  flow_node_type: string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbExtractionDependencyRow {
  task_id: string
  predecessor_task_id: string
}

interface DbExtractionTaskAttachmentRow {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  attachment_type: string
  storage_provider: string
  url: string
  thumbnail_url: string | null
  title: string | null
  mime_type: string | null
  size_bytes: number | string | null
  metadata_json: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionTaskEventRow {
  id: string
  task_id: string
  user_id: string
  event_type: ExtractionTaskEventType
  content: string
  metadata_json: string
  created_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionTaskCommentRow {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  parent_comment_id: string | null
  is_hidden: boolean
  content: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionTaskEdgeRow {
  id: string
  extraction_id: string
  from_task_id: string
  to_task_id: string
  edge_type: string
  label: string | null
  expected_extra_days: number | string | null
  sort_order: number | string
  created_at: Date | string
  updated_at: Date | string
}

interface DbDecisionSelectionRow {
  extraction_id: string
  decision_task_id: string
  selected_to_task_id: string
  created_at: Date | string
  updated_at: Date | string
}

type ExtractionCloneMode = 'full' | 'template'

interface CloneTaskSeed {
  sourceTaskId: string
  phaseId: number
  phaseTitle: string
  itemIndex: number
  itemText: string
  nodeId: string
  parentNodeId: string | null
  depth: number
  positionPath: string
  checked: boolean
  status: ExtractionTaskStatus
  numericValue: number | null
  numericFormulaJson: string
  dueAt: string | null
  completedAt: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  durationDays: number
  flowNodeType: 'process' | 'decision'
  createdAt: string
  updatedAt: string
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseDbInteger(value: unknown) {
  return Number.parseInt(String(value ?? 0), 10) || 0
}

function parseDbNullableFloat(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeExtractionShareVisibility(value: unknown): ExtractionShareVisibility {
  return value === 'circle' || value === 'unlisted' || value === 'public' ? value : 'private'
}

function normalizeExtractionClonePermission(value: unknown): ExtractionClonePermission {
  return value === 'template_only' || value === 'full' ? value : 'disabled'
}

function normalizeExtractionAccessRole(value: unknown): ExtractionAccessRole | null {
  if (value === 'owner') return 'owner'
  if (value === 'editor') return 'editor'
  if (value === 'viewer') return 'viewer'
  return null
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

function mapExtractionFolderRow(row: DbExtractionFolderRow): DbExtractionFolder {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    parent_id: row.parent_id ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapExtractionTaskRow(row: DbExtractionTaskRow): DbExtractionTask {
  const parsedPhaseId =
    typeof row.phase_id === 'number' ? row.phase_id : Number.parseInt(String(row.phase_id), 10)
  const parsedItemIndex =
    typeof row.item_index === 'number' ? row.item_index : Number.parseInt(String(row.item_index), 10)
  const parsedDepth =
    typeof row.depth === 'number' ? row.depth : Number.parseInt(String(row.depth ?? ''), 10)
  const nodeId =
    typeof row.node_id === 'string' && row.node_id.trim()
      ? row.node_id.trim()
      : `p${Number.isFinite(parsedPhaseId) ? parsedPhaseId : 0}-i${Number.isFinite(parsedItemIndex) ? parsedItemIndex : 0}`
  const positionPath =
    typeof row.position_path === 'string' && row.position_path.trim()
      ? row.position_path.trim()
      : `${Number.isFinite(parsedPhaseId) ? parsedPhaseId : 0}.${(Number.isFinite(parsedItemIndex) ? parsedItemIndex : 0) + 1}`

  return {
    id: row.id,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    phase_id: Number.isFinite(parsedPhaseId) ? parsedPhaseId : 0,
    phase_title: row.phase_title,
    item_index: Number.isFinite(parsedItemIndex) ? parsedItemIndex : 0,
    item_text: row.item_text,
    node_id: nodeId,
    parent_node_id: row.parent_node_id ?? null,
    depth: Number.isFinite(parsedDepth) ? Math.max(1, parsedDepth) : 1,
    position_path: positionPath,
    checked: row.checked === true,
    status: row.status,
    numeric_value: parseDbNullableFloat(row.numeric_value),
    numeric_formula_json:
      typeof row.numeric_formula_json === 'string' && row.numeric_formula_json.trim()
        ? row.numeric_formula_json
        : '{}',
    due_at: row.due_at ? toIso(row.due_at) : null,
    completed_at: row.completed_at ? toIso(row.completed_at) : null,
    scheduled_start_at: row.scheduled_start_at ? toIso(row.scheduled_start_at) : null,
    scheduled_end_at: row.scheduled_end_at ? toIso(row.scheduled_end_at) : null,
    duration_days:
      typeof row.duration_days === 'number'
        ? row.duration_days
        : Number.parseInt(String(row.duration_days ?? '1'), 10) || 1,
    flow_node_type: row.flow_node_type ?? 'process',
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapExtractionTaskEventRow(row: DbExtractionTaskEventRow): DbExtractionTaskEvent {
  return {
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    event_type: row.event_type,
    content: row.content,
    metadata_json: row.metadata_json,
    created_at: toIso(row.created_at),
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
  }
}

function remapTaskNumericFormulaJson(raw: string, taskIdMap: Map<string, string>) {
  const parsed = parseTaskNumericFormulaJson(raw)
  if (!parsed) return '{}'

  const remappedSourceTaskIds = parsed.sourceTaskIds
    .map((sourceTaskId) => taskIdMap.get(sourceTaskId) ?? null)
    .filter((value): value is string => Boolean(value))

  if (remappedSourceTaskIds.length === 0) return '{}'
  return serializeTaskNumericFormula({
    operation: parsed.operation,
    sourceTaskIds: remappedSourceTaskIds,
  })
}

function buildCloneTaskSeeds(sourcePhasesJson: string): CloneTaskSeed[] {
  const nowIso = new Date().toISOString()

  try {
    return flattenPlaybookPhases(normalizePlaybookPhases(JSON.parse(sourcePhasesJson))).map((task) => ({
      sourceTaskId: `generated:${task.nodeId}`,
      phaseId: task.phaseId,
      phaseTitle: task.phaseTitle,
      itemIndex: task.itemIndex,
      itemText: task.itemText,
      nodeId: task.nodeId,
      parentNodeId: task.parentNodeId ?? null,
      depth: task.depth,
      positionPath: task.positionPath,
      checked: false,
      status: 'pending',
      numericValue: null,
      numericFormulaJson: '{}',
      dueAt: null,
      completedAt: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      durationDays: 1,
      flowNodeType: 'process',
      createdAt: nowIso,
      updatedAt: nowIso,
    }))
  } catch {
    return []
  }
}

export async function cloneExtractionForUser(input: {
  sourceExtractionId: string
  targetUserId: string
  folderId?: string | null
  mode: ExtractionCloneMode
  name: string
}) {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(input.targetUserId)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const generalFolderId = buildSystemExtractionFolderIdForUser({
      userId: input.targetUserId,
      key: 'general',
    })
    const resolvedFolderId = input.folderId?.trim() || generalFolderId

    const sourceExtractionRows = await client.query<DbExtractionRow>(
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
        FROM extractions
        WHERE id = $1
        LIMIT 1
      `,
      [input.sourceExtractionId]
    )

    if (!sourceExtractionRows.rows[0]) {
      throw new Error('No se encontró el playbook origen.')
    }

    const sourceExtraction = mapExtractionRow(sourceExtractionRows.rows[0])
    const clonedTitle =
      input.name.trim().slice(0, 300) ||
      sourceExtraction.video_title?.trim() ||
      sourceExtraction.source_label?.trim() ||
      sourceExtraction.objective.trim() ||
      'Copia'

    const newExtractionId = randomUUID()
    const insertedExtractionRows = await client.query<DbExtractionRow>(
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
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'private', 'disabled',
          $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
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
        newExtractionId,
        input.targetUserId,
        sourceExtraction.id,
        sourceExtraction.url,
        sourceExtraction.video_id,
        clonedTitle,
        sourceExtraction.thumbnail_url,
        sourceExtraction.extraction_mode,
        sourceExtraction.objective,
        sourceExtraction.phases_json,
        sourceExtraction.pro_tip,
        sourceExtraction.metadata_json,
        sourceExtraction.source_type,
        clonedTitle,
        resolvedFolderId,
        sourceExtraction.source_text,
        sourceExtraction.source_file_url,
        sourceExtraction.source_file_name,
        sourceExtraction.source_file_size_bytes,
        sourceExtraction.source_file_mime_type,
        sourceExtraction.transcript_source,
      ]
    )

    const sourceAdditionalSources = await client.query<DbExtractionAdditionalSourceRow>(
      `
        SELECT
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
        FROM extraction_additional_sources
        WHERE extraction_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [sourceExtraction.id]
    )

    for (const source of sourceAdditionalSources.rows) {
      await client.query(
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
            analyzed_at,
            created_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
        `,
        [
          randomUUID(),
          newExtractionId,
          input.targetUserId,
          source.source_type,
          source.source_label,
          source.url,
          source.source_text,
          source.source_file_url,
          source.source_file_name,
          source.source_file_size_bytes,
          source.source_file_mime_type,
          source.analysis_status === 'analyzed' ? 'analyzed' : 'pending',
          source.analyzed_at ? toIso(source.analyzed_at) : null,
          toIso(source.created_at),
        ]
      )
    }

    const sourceTags = await client.query<{ name: string; color: string }>(
      `
        SELECT t.name, t.color
        FROM extraction_tag_assignments eta
        INNER JOIN extraction_tags t ON t.id = eta.tag_id
        WHERE eta.extraction_id = $1
        ORDER BY t.name ASC
      `,
      [sourceExtraction.id]
    )

    for (const tag of sourceTags.rows) {
      const tagRows = await client.query<{ id: string }>(
        `
          INSERT INTO extraction_tags (id, user_id, name, color)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
          RETURNING id
        `,
        [randomUUID(), input.targetUserId, tag.name, tag.color]
      )

      const nextTagId = tagRows.rows[0]?.id
      if (!nextTagId) continue

      await client.query(
        `
          INSERT INTO extraction_tag_assignments (extraction_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [newExtractionId, nextTagId]
      )
    }

    const sourceTaskRows = await client.query<DbExtractionTaskRow>(
      `
        SELECT
          id,
          extraction_id,
          user_id,
          phase_id,
          phase_title,
          item_index,
          item_text,
          node_id,
          parent_node_id,
          depth,
          position_path,
          checked,
          status,
          numeric_value,
          numeric_formula_json,
          due_at,
          completed_at,
          scheduled_start_at,
          scheduled_end_at,
          duration_days,
          flow_node_type,
          created_at,
          updated_at
        FROM extraction_tasks
        WHERE extraction_id = $1
        ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC, created_at ASC
      `,
      [sourceExtraction.id]
    )

    const sourceTaskSeeds =
      sourceTaskRows.rows.length > 0
        ? sourceTaskRows.rows.map((row) => {
            const task = mapExtractionTaskRow(row)
            return {
              sourceTaskId: task.id,
              phaseId: task.phase_id,
              phaseTitle: task.phase_title,
              itemIndex: task.item_index,
              itemText: task.item_text,
              nodeId: task.node_id,
              parentNodeId: task.parent_node_id,
              depth: task.depth,
              positionPath: task.position_path,
              checked: task.checked,
              status: task.status,
              numericValue: task.numeric_value,
              numericFormulaJson: task.numeric_formula_json,
              dueAt: task.due_at,
              completedAt: task.completed_at,
              scheduledStartAt: task.scheduled_start_at,
              scheduledEndAt: task.scheduled_end_at,
              durationDays: task.duration_days,
              flowNodeType: task.flow_node_type === 'decision' ? 'decision' : 'process',
              createdAt: task.created_at,
              updatedAt: task.updated_at,
            } satisfies CloneTaskSeed
          })
        : buildCloneTaskSeeds(sourceExtraction.phases_json)

    const taskIdMap = new Map<string, string>()
    for (const task of sourceTaskSeeds) {
      taskIdMap.set(task.sourceTaskId, randomUUID())
    }

    for (const task of sourceTaskSeeds) {
      const clonedTaskId = taskIdMap.get(task.sourceTaskId)
      if (!clonedTaskId) continue

      const isFullClone = input.mode === 'full' && sourceTaskRows.rows.length > 0
      await client.query(
        `
          INSERT INTO extraction_tasks (
            id,
            extraction_id,
            user_id,
            phase_id,
            phase_title,
            item_index,
            item_text,
            node_id,
            parent_node_id,
            depth,
            position_path,
            checked,
            status,
            numeric_value,
            numeric_formula_json,
            due_at,
            completed_at,
            scheduled_start_at,
            scheduled_end_at,
            duration_days,
            flow_node_type,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23
          )
        `,
        [
          clonedTaskId,
          newExtractionId,
          input.targetUserId,
          task.phaseId,
          task.phaseTitle,
          task.itemIndex,
          task.itemText,
          task.nodeId,
          task.parentNodeId,
          task.depth,
          task.positionPath,
          isFullClone ? task.checked : false,
          isFullClone ? task.status : 'pending',
          isFullClone ? task.numericValue : null,
          isFullClone ? remapTaskNumericFormulaJson(task.numericFormulaJson, taskIdMap) : '{}',
          isFullClone ? task.dueAt : null,
          isFullClone ? task.completedAt : null,
          isFullClone ? task.scheduledStartAt : null,
          isFullClone ? task.scheduledEndAt : null,
          isFullClone ? Math.max(1, task.durationDays) : 1,
          isFullClone ? task.flowNodeType : 'process',
          isFullClone ? task.createdAt : new Date().toISOString(),
          isFullClone ? task.updatedAt : new Date().toISOString(),
        ]
      )
    }

    if (input.mode === 'full' && sourceTaskRows.rows.length > 0) {
      const dependencies = await client.query<DbExtractionDependencyRow>(
        `
          SELECT task_id, predecessor_task_id
          FROM extraction_task_dependencies
          WHERE extraction_id = $1
        `,
        [sourceExtraction.id]
      )

      for (const dependency of dependencies.rows) {
        const nextTaskId = taskIdMap.get(dependency.task_id)
        const nextPredecessorId = taskIdMap.get(dependency.predecessor_task_id)
        if (!nextTaskId || !nextPredecessorId) continue

        await client.query(
          `
            INSERT INTO extraction_task_dependencies (
              extraction_id,
              task_id,
              predecessor_task_id
            )
            VALUES ($1, $2, $3)
          `,
          [newExtractionId, nextTaskId, nextPredecessorId]
        )
      }

      const events = await client.query<{
        id: string
        task_id: string
        user_id: string
        event_type: ExtractionTaskEventType
        content: string
        metadata_json: string
        created_at: Date | string
      }>(
        `
          SELECT
            id,
            task_id,
            user_id,
            event_type,
            content,
            metadata_json,
            created_at
          FROM extraction_task_events
          WHERE task_id = ANY($1::text[])
          ORDER BY created_at ASC, id ASC
        `,
        [sourceTaskRows.rows.map((task) => task.id)]
      )

      for (const event of events.rows) {
        const nextTaskId = taskIdMap.get(event.task_id)
        if (!nextTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_events (
              id,
              task_id,
              user_id,
              event_type,
              content,
              metadata_json,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            randomUUID(),
            nextTaskId,
            event.user_id,
            event.event_type,
            event.content,
            event.metadata_json,
            toIso(event.created_at),
          ]
        )
      }

      const attachments = await client.query<DbExtractionTaskAttachmentRow>(
        `
          SELECT
            id,
            task_id,
            extraction_id,
            user_id,
            attachment_type,
            storage_provider,
            url,
            thumbnail_url,
            title,
            mime_type,
            size_bytes,
            metadata_json,
            created_at,
            updated_at,
            NULL::text AS user_name,
            NULL::text AS user_email
          FROM extraction_task_attachments
          WHERE extraction_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [sourceExtraction.id]
      )

      for (const attachment of attachments.rows) {
        const nextTaskId = taskIdMap.get(attachment.task_id)
        if (!nextTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_attachments (
              id,
              task_id,
              extraction_id,
              user_id,
              attachment_type,
              storage_provider,
              url,
              thumbnail_url,
              title,
              mime_type,
              size_bytes,
              metadata_json,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `,
          [
            randomUUID(),
            nextTaskId,
            newExtractionId,
            attachment.user_id,
            attachment.attachment_type,
            attachment.storage_provider,
            attachment.url,
            attachment.thumbnail_url,
            attachment.title,
            attachment.mime_type,
            attachment.size_bytes != null ? Number(attachment.size_bytes) : null,
            attachment.metadata_json,
            toIso(attachment.created_at),
            toIso(attachment.updated_at),
          ]
        )
      }

      const comments = await client.query<DbExtractionTaskCommentRow>(
        `
          SELECT
            id,
            task_id,
            extraction_id,
            user_id,
            parent_comment_id,
            is_hidden,
            content,
            created_at,
            updated_at,
            NULL::text AS user_name,
            NULL::text AS user_email
          FROM extraction_task_comments
          WHERE extraction_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [sourceExtraction.id]
      )

      const commentIdMap = new Map<string, string>()
      for (const comment of comments.rows) {
        commentIdMap.set(comment.id, randomUUID())
      }

      for (const comment of comments.rows) {
        const nextTaskId = taskIdMap.get(comment.task_id)
        const nextCommentId = commentIdMap.get(comment.id)
        if (!nextTaskId || !nextCommentId) continue

        await client.query(
          `
            INSERT INTO extraction_task_comments (
              id,
              task_id,
              extraction_id,
              user_id,
              parent_comment_id,
              is_hidden,
              content,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            nextCommentId,
            nextTaskId,
            newExtractionId,
            comment.user_id,
            comment.parent_comment_id ? commentIdMap.get(comment.parent_comment_id) ?? null : null,
            comment.is_hidden,
            comment.content,
            toIso(comment.created_at),
            toIso(comment.updated_at),
          ]
        )
      }

      const edges = await client.query<DbExtractionTaskEdgeRow>(
        `
          SELECT
            id,
            extraction_id,
            from_task_id,
            to_task_id,
            edge_type,
            label,
            expected_extra_days,
            sort_order,
            created_at,
            updated_at
          FROM extraction_task_edges
          WHERE extraction_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `,
        [sourceExtraction.id]
      )

      for (const edge of edges.rows) {
        const nextFromTaskId = taskIdMap.get(edge.from_task_id)
        const nextToTaskId = taskIdMap.get(edge.to_task_id)
        if (!nextFromTaskId || !nextToTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_edges (
              id,
              extraction_id,
              from_task_id,
              to_task_id,
              edge_type,
              label,
              expected_extra_days,
              sort_order,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            randomUUID(),
            newExtractionId,
            nextFromTaskId,
            nextToTaskId,
            edge.edge_type,
            edge.label,
            edge.expected_extra_days != null ? Number(edge.expected_extra_days) : null,
            typeof edge.sort_order === 'number' ? edge.sort_order : Number.parseInt(String(edge.sort_order), 10) || 0,
            toIso(edge.created_at),
            toIso(edge.updated_at),
          ]
        )
      }

      const selections = await client.query<DbDecisionSelectionRow>(
        `
          SELECT
            extraction_id,
            decision_task_id,
            selected_to_task_id,
            created_at,
            updated_at
          FROM extraction_task_decision_selection
          WHERE extraction_id = $1
        `,
        [sourceExtraction.id]
      )

      for (const selection of selections.rows) {
        const nextDecisionTaskId = taskIdMap.get(selection.decision_task_id)
        const nextSelectedToTaskId = taskIdMap.get(selection.selected_to_task_id)
        if (!nextDecisionTaskId || !nextSelectedToTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_decision_selection (
              extraction_id,
              decision_task_id,
              selected_to_task_id,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            newExtractionId,
            nextDecisionTaskId,
            nextSelectedToTaskId,
            toIso(selection.created_at),
            toIso(selection.updated_at),
          ]
        )
      }

      const positions = await client.query<{
        task_id: string
        cx: number | string
        cy: number | string
        updated_at: Date | string
      }>(
        `
          SELECT task_id, cx, cy, updated_at
          FROM flow_node_positions
          WHERE extraction_id = $1
        `,
        [sourceExtraction.id]
      )

      for (const position of positions.rows) {
        const nextTaskId = taskIdMap.get(position.task_id)
        if (!nextTaskId) continue

        await client.query(
          `
            INSERT INTO flow_node_positions (
              task_id,
              extraction_id,
              cx,
              cy,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            nextTaskId,
            newExtractionId,
            Number(position.cx),
            Number(position.cy),
            toIso(position.updated_at),
          ]
        )
      }

      const decks = await client.query<{
        deck_json: string
        created_at: Date | string
        updated_at: Date | string
      }>(
        `
          SELECT deck_json, created_at, updated_at
          FROM extraction_presentations
          WHERE extraction_id = $1
          LIMIT 1
        `,
        [sourceExtraction.id]
      )

      if (decks.rows[0]) {
        await client.query(
          `
            INSERT INTO extraction_presentations (
              extraction_id,
              deck_json,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4)
          `,
          [
            newExtractionId,
            decks.rows[0].deck_json,
            toIso(decks.rows[0].created_at),
            toIso(decks.rows[0].updated_at),
          ]
        )
      }
    }

    await client.query('COMMIT')
    return mapExtractionRow(insertedExtractionRows.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function syncExtractionTasksForUser(input: {
  userId: string
  extractionId: string
  phases: unknown
}) {
  await ensureDbReady()

  const normalizedPhases = normalizePlaybookPhases(input.phases)
  const normalizedRows = flattenPlaybookPhases(normalizedPhases).map((row) => ({
    phaseId: row.phaseId,
    phaseTitle: row.phaseTitle,
    itemIndex: row.itemIndex,
    itemText: row.itemText,
    nodeId: row.nodeId,
    parentNodeId: row.parentNodeId,
    depth: row.depth,
    positionPath: row.positionPath,
  }))

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const normalizeText = (value: string) => value.trim().toLocaleLowerCase()

    if (normalizedRows.length === 0) {
      await client.query(
        `
          DELETE FROM extraction_tasks
          WHERE extraction_id = $1
        `,
        [input.extractionId]
      )

      await client.query('COMMIT')
      return []
    }

    const existingRows = await client.query<DbExtractionTaskRow>(
      `
        SELECT
          id,
          extraction_id,
          user_id,
          phase_id,
          phase_title,
          item_index,
          item_text,
          node_id,
          parent_node_id,
          depth,
          position_path,
          checked,
          status,
          numeric_value,
          numeric_formula_json,
          due_at,
          completed_at,
          created_at,
          updated_at
        FROM extraction_tasks
        WHERE extraction_id = $1
        ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC, created_at ASC
      `,
      [input.extractionId]
    )

    const existingTasks = existingRows.rows.map(mapExtractionTaskRow)
    const availableExistingTasks = [...existingTasks]

    const takeMatchingTask = (predicate: (task: DbExtractionTask) => boolean): DbExtractionTask | null => {
      const index = availableExistingTasks.findIndex((task) => predicate(task))
      if (index < 0) return null
      const [task] = availableExistingTasks.splice(index, 1)
      return task ?? null
    }

    const resolvedRows = normalizedRows.map((row) => {
      const normalizedItemText = normalizeText(row.itemText)
      const normalizedPhaseTitle = normalizeText(row.phaseTitle)

      const matchedTask =
        takeMatchingTask((task) => task.node_id === row.nodeId) ??
        takeMatchingTask(
          (task) =>
            task.phase_id === row.phaseId &&
            task.item_index === row.itemIndex &&
            normalizeText(task.item_text) === normalizedItemText
        ) ??
        takeMatchingTask(
          (task) =>
            normalizeText(task.item_text) === normalizedItemText &&
            normalizeText(task.phase_title) === normalizedPhaseTitle
        ) ??
        takeMatchingTask((task) => normalizeText(task.item_text) === normalizedItemText) ??
        takeMatchingTask((task) => task.phase_id === row.phaseId && task.item_index === row.itemIndex)

      if (matchedTask) {
        return {
          ...row,
          taskId: matchedTask.id,
          reuseExistingTask: true,
        }
      }

      return {
        ...row,
        taskId: randomUUID(),
        reuseExistingTask: false,
      }
    })

    const reusedTaskIds = new Set(
      resolvedRows.filter((row) => row.reuseExistingTask).map((row) => row.taskId)
    )
    const taskIdsToDelete = existingTasks
      .filter((task) => !reusedTaskIds.has(task.id))
      .map((task) => task.id)

    if (taskIdsToDelete.length > 0) {
      await client.query(
        `
          DELETE FROM extraction_tasks
          WHERE extraction_id = $1
            AND id = ANY($2::text[])
        `,
        [input.extractionId, taskIdsToDelete]
      )
    }

    const rowsReusingExistingTasks = resolvedRows.filter((row) => row.reuseExistingTask)
    const temporaryBase = -1_000_000_000
    for (let index = 0; index < rowsReusingExistingTasks.length; index += 1) {
      const row = rowsReusingExistingTasks[index]
      await client.query(
        `
          UPDATE extraction_tasks
          SET
            phase_id = $1,
            item_index = $2,
            node_id = $3,
            position_path = $4,
            updated_at = NOW()
          WHERE id = $5 AND extraction_id = $6
        `,
        [
          temporaryBase - index,
          temporaryBase - index,
          `tmp_${index}_${row.taskId}`,
          `0.${Math.abs(temporaryBase - index)}`,
          row.taskId,
          input.extractionId,
        ]
      )
    }

    for (const row of resolvedRows) {
      if (row.reuseExistingTask) {
        await client.query(
          `
            UPDATE extraction_tasks
            SET
              phase_id = $1,
              phase_title = $2,
              item_index = $3,
              item_text = $4,
              node_id = $5,
              parent_node_id = $6,
              depth = $7,
              position_path = $8,
              updated_at = NOW()
            WHERE id = $9 AND extraction_id = $10
          `,
          [
            row.phaseId,
            row.phaseTitle,
            row.itemIndex,
            row.itemText,
            row.nodeId,
            row.parentNodeId,
            row.depth,
            row.positionPath,
            row.taskId,
            input.extractionId,
          ]
        )
      } else {
        await client.query(
          `
            INSERT INTO extraction_tasks (
              id,
              extraction_id,
              user_id,
              phase_id,
              phase_title,
              item_index,
              item_text,
              node_id,
              parent_node_id,
              depth,
              position_path,
              checked,
              status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, 'pending')
          `,
          [
            row.taskId,
            input.extractionId,
            input.userId,
            row.phaseId,
            row.phaseTitle,
            row.itemIndex,
            row.itemText,
            row.nodeId,
            row.parentNodeId,
            row.depth,
            row.positionPath,
          ]
        )
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return listExtractionTasksWithEventsForUser({
    extractionId: input.extractionId,
  })
}

export async function listExtractionTasksWithEventsForUser(input: { extractionId: string }) {
  await ensureDbReady()

  const taskRows = await pool.query<DbExtractionTaskRow>(
    `
      SELECT
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        node_id,
        parent_node_id,
        depth,
        position_path,
        checked,
        status,
        numeric_value,
        numeric_formula_json,
        due_at,
        completed_at,
        scheduled_start_at,
        scheduled_end_at,
        duration_days,
        flow_node_type,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE extraction_id = $1
      ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC
    `,
    [input.extractionId]
  )

  const tasks = taskRows.rows.map(mapExtractionTaskRow)
  if (tasks.length === 0) {
    return [] as Array<DbExtractionTask & { events: DbExtractionTaskEvent[] }>
  }

  const taskIds = tasks.map((task) => task.id)
  const eventRows = await pool.query<DbExtractionTaskEventRow>(
    `
      SELECT
        e.id,
        e.task_id,
        e.user_id,
        e.event_type,
        e.content,
        e.metadata_json,
        e.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.task_id = ANY($1::text[])
      ORDER BY e.created_at DESC
    `,
    [taskIds]
  )

  const eventsByTaskId = new Map<string, DbExtractionTaskEvent[]>()
  for (const row of eventRows.rows) {
    const mapped = mapExtractionTaskEventRow(row)
    const existing = eventsByTaskId.get(mapped.task_id) ?? []
    existing.push(mapped)
    eventsByTaskId.set(mapped.task_id, existing)
  }

  return tasks.map((task) => ({
    ...task,
    events: eventsByTaskId.get(task.id) ?? [],
  }))
}

export async function listExtractionTasksWithEventsForSharedExtraction(extractionId: string) {
  await ensureDbReady()

  const taskRows = await pool.query<DbExtractionTaskRow>(
    `
      SELECT
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        node_id,
        parent_node_id,
        depth,
        position_path,
        checked,
        status,
        numeric_value,
        numeric_formula_json,
        due_at,
        completed_at,
        scheduled_start_at,
        scheduled_end_at,
        duration_days,
        flow_node_type,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE extraction_id = $1
      ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC
    `,
    [extractionId]
  )

  const tasks = taskRows.rows.map(mapExtractionTaskRow)
  if (tasks.length === 0) {
    return [] as Array<DbExtractionTask & { events: DbExtractionTaskEvent[] }>
  }

  const taskIds = tasks.map((task) => task.id)
  const eventRows = await pool.query<DbExtractionTaskEventRow>(
    `
      SELECT
        e.id,
        e.task_id,
        e.user_id,
        e.event_type,
        e.content,
        e.metadata_json,
        e.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.task_id = ANY($1::text[])
      ORDER BY e.created_at DESC
    `,
    [taskIds]
  )

  const eventsByTaskId = new Map<string, DbExtractionTaskEvent[]>()
  for (const row of eventRows.rows) {
    const mapped = mapExtractionTaskEventRow(row)
    const existing = eventsByTaskId.get(mapped.task_id) ?? []
    existing.push(mapped)
    eventsByTaskId.set(mapped.task_id, existing)
  }

  return tasks.map((task) => ({
    ...task,
    events: eventsByTaskId.get(task.id) ?? [],
  }))
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

export async function findExtractionAccessForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionAccessRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.created_at,
        e.source_type,
        e.source_label,
        e.folder_id,
        CASE
          WHEN e.user_id = $2 THEN 'owner'
          WHEN EXISTS (
            WITH RECURSIVE folder_ancestors AS (
              SELECT f.id, f.parent_id
              FROM extraction_folders f
              WHERE
                e.folder_id IS NOT NULL
                AND f.id = e.folder_id
                AND f.user_id = e.user_id
              UNION ALL
              SELECT parent.id, parent.parent_id
              FROM extraction_folders parent
              INNER JOIN folder_ancestors fa
                ON fa.parent_id = parent.id
              WHERE parent.user_id = e.user_id
            )
            SELECT 1
            FROM extraction_folder_members fm
            WHERE
              fm.member_user_id = $2
              AND fm.owner_user_id = e.user_id
              AND fm.folder_id IN (SELECT id FROM folder_ancestors)
            LIMIT 1
          ) THEN 'viewer'
          WHEN e.share_visibility = 'circle' AND m.role IS NOT NULL THEN m.role
          WHEN e.share_visibility IN ('public', 'unlisted') THEN 'viewer'
          ELSE NULL
        END AS access_role
      FROM extractions e
      LEFT JOIN extraction_members m
        ON m.extraction_id = e.id
        AND m.user_id = $2
      WHERE e.id = $1
      LIMIT 1
    `,
    [input.id, input.userId]
  )

  if (!rows[0]) {
    return { extraction: null, role: null as ExtractionAccessRole | null }
  }

  return {
    extraction: mapExtractionRow(rows[0]),
    role: normalizeExtractionAccessRole(rows[0].access_role),
  }
}

export async function findCloneableExtractionAccessForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionAccessRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.parent_extraction_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.clone_permission,
        e.created_at,
        e.source_type,
        e.source_label,
        e.folder_id,
        e.source_text,
        e.source_file_url,
        e.source_file_name,
        e.source_file_size_bytes,
        e.source_file_mime_type,
        e.transcript_source,
        CASE
          WHEN e.user_id = $2 THEN 'owner'
          WHEN EXISTS (
            WITH RECURSIVE folder_ancestors AS (
              SELECT f.id, f.parent_id
              FROM extraction_folders f
              WHERE
                e.folder_id IS NOT NULL
                AND f.id = e.folder_id
                AND f.user_id = e.user_id
              UNION ALL
              SELECT parent.id, parent.parent_id
              FROM extraction_folders parent
              INNER JOIN folder_ancestors fa
                ON fa.parent_id = parent.id
              WHERE parent.user_id = e.user_id
            )
            SELECT 1
            FROM extraction_folder_members fm
            WHERE
              fm.member_user_id = $2
              AND fm.owner_user_id = e.user_id
              AND fm.folder_id IN (SELECT id FROM folder_ancestors)
            LIMIT 1
          ) THEN 'viewer'
          WHEN e.share_visibility = 'circle' AND m.role IS NOT NULL THEN m.role
          WHEN e.share_visibility IN ('public', 'unlisted') THEN 'viewer'
          ELSE NULL
        END AS access_role
      FROM extractions e
      LEFT JOIN extraction_members m
        ON m.extraction_id = e.id
        AND m.user_id = $2
      WHERE e.id = $1
      LIMIT 1
    `,
    [input.id, input.userId]
  )

  if (!rows[0]) {
    return { extraction: null, role: null as ExtractionAccessRole | null }
  }

  return {
    extraction: mapExtractionRow(rows[0]),
    role: normalizeExtractionAccessRole(rows[0].access_role),
  }
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

export async function findExtractionFolderByIdForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionFolderRow>(
    `
      SELECT
        id,
        user_id,
        name,
        color,
        parent_id,
        created_at,
        updated_at
      FROM extraction_folders
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [input.id, input.userId]
  )
  return rows[0] ? mapExtractionFolderRow(rows[0]) : null
}
