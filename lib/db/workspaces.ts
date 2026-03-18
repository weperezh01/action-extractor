import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import {
  ensureDbReady,
  pool,
  type DbExtraction,
  type DbExtractionTag,
  type DbWorkspace,
  type DbWorkspaceInvitation,
  type DbWorkspaceMember,
  type DbWorkspaceWithRole,
  type ExtractionClonePermission,
  type ExtractionShareVisibility,
  type WorkspaceInvitationStatus,
  type WorkspaceRole,
} from '@/lib/db'

interface DbWorkspaceRow {
  id: string
  name: string
  slug: string
  description: string | null
  avatar_color: string
  owner_user_id: string
  created_at: Date | string
  updated_at: Date | string
}

interface DbWorkspaceWithRoleRow extends DbWorkspaceRow {
  role: string
  member_count: number | string
}

interface DbWorkspaceMemberRow {
  workspace_id: string
  user_id: string
  role: string
  joined_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbWorkspaceInvitationRow {
  id: string
  workspace_id: string
  invited_by_user_id: string
  email: string
  role: string
  token: string
  status: string
  expires_at: Date | string
  created_at: Date | string
  accepted_at: Date | string | null
  workspace_name?: string
  invited_by_name?: string | null
}

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
  source_file_size_bytes?: number | null
  source_file_mime_type?: string | null
  has_source_text?: boolean | null
  transcript_source?: string | null
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseDbInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function normalizeWorkspaceRole(value: unknown): WorkspaceRole {
  if (value === 'owner') return 'owner'
  if (value === 'admin') return 'admin'
  if (value === 'viewer') return 'viewer'
  return 'member'
}

function normalizeWorkspaceInvitationStatus(value: unknown): WorkspaceInvitationStatus {
  if (value === 'accepted') return 'accepted'
  if (value === 'declined') return 'declined'
  if (value === 'expired') return 'expired'
  return 'pending'
}

function normalizeExtractionShareVisibility(value: unknown): ExtractionShareVisibility {
  if (value === 'public') return 'public'
  if (value === 'unlisted') return 'unlisted'
  if (value === 'circle') return 'circle'
  return 'private'
}

function normalizeExtractionClonePermission(value: unknown): ExtractionClonePermission {
  if (value === 'template_only') return 'template_only'
  if (value === 'full') return 'full'
  return 'disabled'
}

function mapWorkspaceRow(row: DbWorkspaceRow): DbWorkspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    avatar_color: row.avatar_color,
    owner_user_id: row.owner_user_id,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapWorkspaceWithRoleRow(row: DbWorkspaceWithRoleRow): DbWorkspaceWithRole {
  return {
    ...mapWorkspaceRow(row),
    role: normalizeWorkspaceRole(row.role),
    member_count: parseDbInteger(row.member_count),
  }
}

function mapWorkspaceMemberRow(row: DbWorkspaceMemberRow): DbWorkspaceMember {
  return {
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: normalizeWorkspaceRole(row.role),
    joined_at: toIso(row.joined_at),
    user_name: row.user_name,
    user_email: row.user_email,
  }
}

function mapWorkspaceInvitationRow(row: DbWorkspaceInvitationRow): DbWorkspaceInvitation {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    invited_by_user_id: row.invited_by_user_id,
    email: row.email,
    role: normalizeWorkspaceRole(row.role),
    token: row.token,
    status: normalizeWorkspaceInvitationStatus(row.status),
    expires_at: toIso(row.expires_at),
    created_at: toIso(row.created_at),
    accepted_at: row.accepted_at ? toIso(row.accepted_at) : null,
    workspace_name: row.workspace_name,
    invited_by_name: row.invited_by_name,
  }
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

async function getUserSummary(userId: string) {
  const { rows } = await pool.query<{ name: string | null; email: string | null }>(
    `SELECT name, email FROM users WHERE id = $1`,
    [userId]
  )
  return {
    name: rows[0]?.name ?? null,
    email: rows[0]?.email ?? null,
  }
}

export async function createWorkspace(input: {
  ownerId: string
  name: string
  slug?: string
  description?: string
  avatarColor?: string
}): Promise<DbWorkspace> {
  await ensureDbReady()
  const id = randomUUID()
  const slug = input.slug?.trim() || `${generateSlug(input.name)}-${id.slice(0, 6)}`
  const now = new Date()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<DbWorkspaceRow>(
      `INSERT INTO workspaces (id, name, slug, description, avatar_color, owner_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING *`,
      [
        id,
        input.name.trim(),
        slug,
        input.description?.trim() ?? null,
        input.avatarColor ?? 'indigo',
        input.ownerId,
        now,
      ]
    )
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, 'owner', $3)`,
      [id, input.ownerId, now]
    )
    await client.query('COMMIT')
    return mapWorkspaceRow(rows[0])
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function findWorkspaceById(id: string): Promise<DbWorkspace | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbWorkspaceRow>(
    `SELECT * FROM workspaces WHERE id = $1`,
    [id]
  )
  return rows[0] ? mapWorkspaceRow(rows[0]) : null
}

export async function findWorkspaceBySlug(slug: string): Promise<DbWorkspace | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbWorkspaceRow>(
    `SELECT * FROM workspaces WHERE slug = $1`,
    [slug]
  )
  return rows[0] ? mapWorkspaceRow(rows[0]) : null
}

export async function listWorkspacesForUser(userId: string): Promise<DbWorkspaceWithRole[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbWorkspaceWithRoleRow>(
    `SELECT w.*, wm.role,
       (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id = w.id)::int AS member_count
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
     ORDER BY w.updated_at DESC`,
    [userId]
  )
  return rows.map(mapWorkspaceWithRoleRow)
}

export async function updateWorkspace(input: {
  id: string
  requestingUserId: string
  name?: string
  description?: string | null
  avatarColor?: string
}): Promise<DbWorkspace | null> {
  await ensureDbReady()
  const role = await getWorkspaceMemberRole(input.id, input.requestingUserId)
  if (!role || (role !== 'owner' && role !== 'admin')) {
    throw new Error('Sin permisos para editar el workspace.')
  }

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (input.name !== undefined) {
    setClauses.push(`name = $${idx++}`)
    values.push(input.name.trim())
  }
  if ('description' in input) {
    setClauses.push(`description = $${idx++}`)
    values.push(input.description?.trim() ?? null)
  }
  if (input.avatarColor !== undefined) {
    setClauses.push(`avatar_color = $${idx++}`)
    values.push(input.avatarColor)
  }

  values.push(input.id)
  const { rows } = await pool.query<DbWorkspaceRow>(
    `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  )
  return rows[0] ? mapWorkspaceRow(rows[0]) : null
}

export async function deleteWorkspace(input: { id: string; ownerUserId: string }): Promise<void> {
  await ensureDbReady()
  const { rowCount } = await pool.query(
    `DELETE FROM workspaces WHERE id = $1 AND owner_user_id = $2`,
    [input.id, input.ownerUserId]
  )
  if (!rowCount) throw new Error('Solo el owner puede eliminar el workspace.')
}

export async function listWorkspaceMembers(workspaceId: string): Promise<DbWorkspaceMember[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbWorkspaceMemberRow>(
    `SELECT wm.workspace_id, wm.user_id, wm.role, wm.joined_at,
            u.name AS user_name, u.email AS user_email
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
     ORDER BY wm.joined_at ASC`,
    [workspaceId]
  )
  return rows.map(mapWorkspaceMemberRow)
}

export async function getWorkspaceMemberRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  )
  return rows[0] ? normalizeWorkspaceRole(rows[0].role) : null
}

export async function upsertWorkspaceMember(input: {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  requestingUserId: string
}): Promise<DbWorkspaceMember> {
  await ensureDbReady()
  const reqRole = await getWorkspaceMemberRole(input.workspaceId, input.requestingUserId)
  if (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin')) {
    throw new Error('Sin permisos para gestionar miembros.')
  }
  if (input.role === 'owner') throw new Error('No se puede asignar rol owner directamente.')

  const { rows } = await pool.query<DbWorkspaceMemberRow>(
    `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role = $3
     RETURNING workspace_id, user_id, role, joined_at`,
    [input.workspaceId, input.userId, input.role]
  )

  const userSummary = await getUserSummary(input.userId)
  return mapWorkspaceMemberRow({
    ...rows[0],
    user_name: userSummary.name,
    user_email: userSummary.email,
  })
}

export async function removeWorkspaceMember(input: {
  workspaceId: string
  userId: string
  requestingUserId: string
}): Promise<void> {
  await ensureDbReady()
  const reqRole = await getWorkspaceMemberRole(input.workspaceId, input.requestingUserId)
  const isSelf = input.requestingUserId === input.userId
  if (!isSelf && (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin'))) {
    throw new Error('Sin permisos para remover miembros.')
  }

  const targetRole = await getWorkspaceMemberRole(input.workspaceId, input.userId)
  if (targetRole === 'owner') throw new Error('No se puede remover al owner del workspace.')

  await pool.query(
    `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [input.workspaceId, input.userId]
  )
}

export async function transferWorkspaceOwnership(input: {
  workspaceId: string
  currentOwnerId: string
  newOwnerId: string
}): Promise<void> {
  await ensureDbReady()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM workspaces WHERE id = $1`,
      [input.workspaceId]
    )
    if (!rows[0] || rows[0].owner_user_id !== input.currentOwnerId) {
      throw new Error('Solo el owner puede transferir el workspace.')
    }

    const { rows: memberRows } = await client.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [input.workspaceId, input.newOwnerId]
    )
    if (!memberRows[0]) throw new Error('El nuevo owner debe ser miembro del workspace.')

    await client.query(
      `UPDATE workspaces SET owner_user_id = $1, updated_at = NOW() WHERE id = $2`,
      [input.newOwnerId, input.workspaceId]
    )
    await client.query(
      `UPDATE workspace_members SET role = 'admin' WHERE workspace_id = $1 AND user_id = $2`,
      [input.workspaceId, input.currentOwnerId]
    )
    await client.query(
      `UPDATE workspace_members SET role = 'owner' WHERE workspace_id = $1 AND user_id = $2`,
      [input.workspaceId, input.newOwnerId]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string
  invitedByUserId: string
  email: string
  role: WorkspaceRole
}): Promise<DbWorkspaceInvitation> {
  await ensureDbReady()
  const reqRole = await getWorkspaceMemberRole(input.workspaceId, input.invitedByUserId)
  if (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin')) {
    throw new Error('Sin permisos para invitar miembros.')
  }

  const id = randomUUID()
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const { rows } = await pool.query<DbWorkspaceInvitationRow>(
    `INSERT INTO workspace_invitations
       (id, workspace_id, invited_by_user_id, email, role, token, status, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
     ON CONFLICT (workspace_id, email) DO UPDATE
       SET id = $1, invited_by_user_id = $3, role = $5, token = $6, status = 'pending',
           expires_at = $7, created_at = NOW(), accepted_at = NULL
     RETURNING *`,
    [id, input.workspaceId, input.invitedByUserId, input.email.toLowerCase().trim(), input.role, token, expiresAt]
  )

  return mapWorkspaceInvitationRow(rows[0])
}

export async function findWorkspaceInvitationByToken(
  token: string
): Promise<DbWorkspaceInvitation | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbWorkspaceInvitationRow>(
    `SELECT wi.*, w.name AS workspace_name, u.name AS invited_by_name
     FROM workspace_invitations wi
     JOIN workspaces w ON w.id = wi.workspace_id
     LEFT JOIN users u ON u.id = wi.invited_by_user_id
     WHERE wi.token = $1`,
    [token]
  )
  return rows[0] ? mapWorkspaceInvitationRow(rows[0]) : null
}

export async function acceptWorkspaceInvitation(input: {
  token: string
  userId: string
}): Promise<DbWorkspaceMember> {
  await ensureDbReady()
  const invitation = await findWorkspaceInvitationByToken(input.token)
  if (!invitation) throw new Error('Invitación no encontrada.')
  if (invitation.status !== 'pending') throw new Error('Esta invitación ya fue procesada.')
  if (new Date(invitation.expires_at) < new Date()) throw new Error('La invitación ha expirado.')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<DbWorkspaceMemberRow>(
      `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $3
       RETURNING workspace_id, user_id, role, joined_at`,
      [invitation.workspace_id, input.userId, invitation.role]
    )
    await client.query(
      `UPDATE workspace_invitations SET status = 'accepted', accepted_at = NOW() WHERE token = $1`,
      [input.token]
    )
    await client.query('COMMIT')

    const userSummary = await getUserSummary(input.userId)
    return mapWorkspaceMemberRow({
      ...rows[0],
      user_name: userSummary.name,
      user_email: userSummary.email,
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function declineWorkspaceInvitation(token: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE workspace_invitations SET status = 'declined' WHERE token = $1 AND status = 'pending'`,
    [token]
  )
}

export async function listWorkspaceInvitations(
  workspaceId: string
): Promise<DbWorkspaceInvitation[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbWorkspaceInvitationRow>(
    `SELECT wi.*, w.name AS workspace_name, u.name AS invited_by_name
     FROM workspace_invitations wi
     JOIN workspaces w ON w.id = wi.workspace_id
     LEFT JOIN users u ON u.id = wi.invited_by_user_id
     WHERE wi.workspace_id = $1 AND wi.status = 'pending'
     ORDER BY wi.created_at DESC`,
    [workspaceId]
  )
  return rows.map(mapWorkspaceInvitationRow)
}

export async function cancelWorkspaceInvitation(input: {
  invitationId: string
  requestingUserId: string
}): Promise<void> {
  await ensureDbReady()
  const { rows } = await pool.query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_invitations WHERE id = $1`,
    [input.invitationId]
  )
  if (!rows[0]) throw new Error('Invitación no encontrada.')

  const role = await getWorkspaceMemberRole(rows[0].workspace_id, input.requestingUserId)
  if (!role || (role !== 'owner' && role !== 'admin')) {
    throw new Error('Sin permisos para cancelar invitaciones.')
  }

  await pool.query(`DELETE FROM workspace_invitations WHERE id = $1`, [input.invitationId])
}

export async function listWorkspaceExtractions(input: {
  workspaceId: string
  userId: string
  limit?: number
  cursor?: string
}): Promise<DbExtraction[]> {
  await ensureDbReady()
  const limit = Math.min(input.limit ?? 30, 100)
  const params: unknown[] = [input.workspaceId, limit]
  let cursorClause = ''

  if (input.cursor) {
    cursorClause = ` AND e.id < $3`
    params.push(input.cursor)
  }

  const { rows } = await pool.query<DbExtractionRow & { tags_json: string | null }>(
    `SELECT e.*,
       COALESCE(
         (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
          FROM extraction_tag_assignments eta
          JOIN extraction_tags t ON t.id = eta.tag_id
          WHERE eta.extraction_id = e.id),
         '[]'
       )::text AS tags_json
     FROM extractions e
     WHERE e.workspace_id = $1${cursorClause}
     ORDER BY e.created_at DESC
     LIMIT $2`,
    params
  )

  return rows.map(mapExtractionRow)
}

export async function moveExtractionToWorkspace(input: {
  extractionId: string
  userId: string
  workspaceId: string | null
}): Promise<void> {
  await ensureDbReady()
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM extractions WHERE id = $1`,
    [input.extractionId]
  )

  if (!rows[0]) throw new Error('Extracción no encontrada.')
  if (rows[0].user_id !== input.userId) throw new Error('Sin permisos sobre esta extracción.')

  if (input.workspaceId) {
    const role = await getWorkspaceMemberRole(input.workspaceId, input.userId)
    if (!role || role === 'viewer') throw new Error('Sin permisos para mover extracciones al workspace.')
  }

  await pool.query(
    `UPDATE extractions SET workspace_id = $1 WHERE id = $2 AND user_id = $3`,
    [input.workspaceId, input.extractionId, input.userId]
  )
}

export async function countWorkspaceExtractions(workspaceId: string): Promise<number> {
  await ensureDbReady()
  const { rows } = await pool.query<{ total: number | string }>(
    `SELECT COUNT(*)::int AS total FROM extractions WHERE workspace_id = $1`,
    [workspaceId]
  )
  return parseDbInteger(rows[0]?.total ?? 0)
}
