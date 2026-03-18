import { randomUUID } from 'node:crypto'
import {
  ensureDbReady,
  pool,
  type CommunityPostAttachmentStorageProvider,
  type CommunityPostAttachmentType,
  type CommunityPostReactionType,
  type CommunityPostVisibility,
  type CreateCommunityPostInput,
  type DbCommunityPost,
  type DbCommunityPostAttachment,
  type DbCommunityPostComment,
  type DbCommunityPostReactionSummary,
  type DbCommunityUserCard,
  type UserExtractionRateLimitUsage,
} from '@/lib/db'

interface DbCommunityPostRow {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  content: string
  visibility: string
  metadata_json: string
  source_extraction_id: string | null
  source_task_id: string | null
  source_label: string | null
  reactions_count: number | string
  comments_count: number | string
  views_count: number | string
  reacted_by_me: boolean | null
  following_author: boolean | null
  attachments_json: unknown
  created_at: Date | string
  updated_at: Date | string
}

interface DbCommunityPostCommentRow {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbCommunityActionRateLimitRow {
  window_start: Date | string
  request_count: number | string
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseDbInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeCommunityPostVisibility(value: unknown): CommunityPostVisibility {
  if (value === 'private' || value === 'circle' || value === 'followers') return value
  return 'public'
}

function normalizeCommunityPostAttachmentType(value: unknown): CommunityPostAttachmentType {
  if (value === 'image' || value === 'audio' || value === 'video' || value === 'file') return value
  return 'link'
}

function normalizeCommunityPostAttachmentStorageProvider(
  value: unknown
): CommunityPostAttachmentStorageProvider {
  return value === 'cloudinary' ? 'cloudinary' : 'external'
}

function parseCommunityPostAttachments(raw: unknown): DbCommunityPostAttachment[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      value = []
    }
  }

  if (!Array.isArray(value)) return []

  const normalized: DbCommunityPostAttachment[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const url = typeof record.url === 'string' ? record.url.trim() : ''
    if (!id || !url) continue

    const createdAtRaw = record.created_at
    const updatedAtRaw = record.updated_at

    normalized.push({
      id,
      attachment_type: normalizeCommunityPostAttachmentType(record.attachment_type),
      storage_provider: normalizeCommunityPostAttachmentStorageProvider(record.storage_provider),
      url,
      thumbnail_url:
        typeof record.thumbnail_url === 'string' && record.thumbnail_url.trim()
          ? record.thumbnail_url.trim()
          : null,
      title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : null,
      mime_type:
        typeof record.mime_type === 'string' && record.mime_type.trim() ? record.mime_type.trim() : null,
      metadata_json:
        typeof record.metadata_json === 'string' && record.metadata_json.trim() ? record.metadata_json : '{}',
      created_at:
        typeof createdAtRaw === 'string' && createdAtRaw.trim() ? createdAtRaw : toIso(new Date()),
      updated_at:
        typeof updatedAtRaw === 'string' && updatedAtRaw.trim() ? updatedAtRaw : toIso(new Date()),
    })
  }

  return normalized
}

function mapCommunityPostRow(row: DbCommunityPostRow): DbCommunityPost {
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
    content: row.content,
    visibility: normalizeCommunityPostVisibility(row.visibility),
    metadata_json: row.metadata_json || '{}',
    source_extraction_id: row.source_extraction_id ?? null,
    source_task_id: row.source_task_id ?? null,
    source_label: row.source_label ?? null,
    reactions_count: parseDbInteger(row.reactions_count),
    comments_count: parseDbInteger(row.comments_count),
    views_count: parseDbInteger(row.views_count),
    reacted_by_me: row.reacted_by_me === true,
    following_author: row.following_author === true,
    attachments: parseCommunityPostAttachments(row.attachments_json),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapCommunityPostCommentRow(row: DbCommunityPostCommentRow): DbCommunityPostComment {
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
    content: row.content,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function normalizeQueryLimit(value: number | undefined, fallback = 20, max = 100) {
  if (!Number.isFinite(value)) return fallback
  const parsed = Math.trunc(value as number)
  if (parsed <= 0) return fallback
  return Math.min(parsed, max)
}

const COMMUNITY_POST_CAN_VIEW_SQL = `
  (
    p.user_id = $1
    OR p.visibility = 'public'
    OR (
      p.visibility = 'followers'
      AND EXISTS (
        SELECT 1
        FROM community_follows cf
        WHERE
          cf.follower_user_id = $1
          AND cf.following_user_id = p.user_id
      )
    )
    OR (
      p.visibility = 'circle'
      AND EXISTS (
        SELECT 1
        FROM community_post_sources cps
        INNER JOIN extractions e ON e.id = cps.extraction_id
        LEFT JOIN extraction_members em
          ON em.extraction_id = e.id
         AND em.user_id = $1
        WHERE
          cps.post_id = p.id
          AND (
            e.user_id = $1
            OR em.user_id IS NOT NULL
          )
      )
    )
  )
`

const COMMUNITY_POST_SELECT_SQL = `
  SELECT
    p.id,
    p.user_id,
    u.name AS user_name,
    u.email AS user_email,
    p.content,
    p.visibility,
    p.metadata_json,
    src.extraction_id AS source_extraction_id,
    src.task_id AS source_task_id,
    src.source_label,
    COALESCE(rc.reactions_count, 0)::int AS reactions_count,
    COALESCE(cc.comments_count, 0)::int AS comments_count,
    COALESCE(vc.views_count, 0)::int AS views_count,
    COALESCE(rc.reacted_by_me, FALSE) AS reacted_by_me,
    COALESCE(att.attachments_json, '[]'::json) AS attachments_json,
    EXISTS (
      SELECT 1
      FROM community_follows cf
      WHERE
        cf.follower_user_id = $1
        AND cf.following_user_id = p.user_id
    ) AS following_author,
    p.created_at,
    p.updated_at
  FROM community_posts p
  INNER JOIN users u
    ON u.id = p.user_id
  LEFT JOIN LATERAL (
    SELECT
      cps.extraction_id,
      cps.task_id,
      cps.source_label
    FROM community_post_sources cps
    WHERE cps.post_id = p.id
    ORDER BY cps.created_at ASC, cps.id ASC
    LIMIT 1
  ) src ON TRUE
  LEFT JOIN (
    SELECT
      post_id,
      COUNT(*)::int AS reactions_count,
      BOOL_OR(user_id = $1) AS reacted_by_me
    FROM community_post_reactions
    GROUP BY post_id
  ) rc ON rc.post_id = p.id
  LEFT JOIN (
    SELECT
      post_id,
      COUNT(*)::int AS comments_count
    FROM community_post_comments
    GROUP BY post_id
  ) cc ON cc.post_id = p.id
  LEFT JOIN (
    SELECT
      post_id,
      COUNT(*)::int AS views_count
    FROM community_post_views
    GROUP BY post_id
  ) vc ON vc.post_id = p.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', a.id,
            'attachment_type', a.attachment_type,
            'storage_provider', a.storage_provider,
            'url', a.url,
            'thumbnail_url', a.thumbnail_url,
            'title', a.title,
            'mime_type', a.mime_type,
            'metadata_json', a.metadata_json,
            'created_at', a.created_at,
            'updated_at', a.updated_at
          )
          ORDER BY a.created_at ASC, a.id ASC
        ),
        '[]'::json
      ) AS attachments_json
    FROM community_post_attachments a
    WHERE a.post_id = p.id
  ) att ON TRUE
`

export async function getCommunityPostAccessForUser(input: { postId: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<{
    id: string
    user_id: string
    visibility: string
    can_view: boolean | null
  }>(
    `
      SELECT
        p.id,
        p.user_id,
        p.visibility,
        ${COMMUNITY_POST_CAN_VIEW_SQL} AS can_view
      FROM community_posts p
      WHERE p.id = $2
      LIMIT 1
    `,
    [input.userId, input.postId]
  )

  const row = rows[0]
  if (!row) {
    return {
      post: null,
      can_view: false,
    }
  }

  return {
    post: {
      id: row.id,
      user_id: row.user_id,
      visibility: normalizeCommunityPostVisibility(row.visibility),
    },
    can_view: row.can_view === true,
  }
}

export async function findCommunityPostByIdForUser(input: { postId: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        p.id = $2
        AND ${COMMUNITY_POST_CAN_VIEW_SQL}
      LIMIT 1
    `,
    [input.userId, input.postId]
  )
  return rows[0] ? mapCommunityPostRow(rows[0]) : null
}

export async function listCommunityExplorePostsForUser(input: {
  userId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        ${COMMUNITY_POST_CAN_VIEW_SQL}
        AND p.visibility = 'public'
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $2
    `,
    [input.userId, safeLimit]
  )

  return rows.map(mapCommunityPostRow)
}

export async function listCommunityHomePostsForUser(input: {
  userId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        ${COMMUNITY_POST_CAN_VIEW_SQL}
        AND (
          p.user_id = $1
          OR p.visibility = 'circle'
          OR EXISTS (
            SELECT 1
            FROM community_follows cf
            WHERE
              cf.follower_user_id = $1
              AND cf.following_user_id = p.user_id
          )
        )
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $2
    `,
    [input.userId, safeLimit]
  )

  return rows.map(mapCommunityPostRow)
}

export async function listCommunityPostsByExtractionForUser(input: {
  userId: string
  extractionId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        ${COMMUNITY_POST_CAN_VIEW_SQL}
        AND EXISTS (
          SELECT 1
          FROM community_post_sources cps
          WHERE
            cps.post_id = p.id
            AND cps.extraction_id = $2
        )
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $3
    `,
    [input.userId, input.extractionId, safeLimit]
  )

  return rows.map(mapCommunityPostRow)
}

export async function createCommunityPostForUser(input: CreateCommunityPostInput) {
  await ensureDbReady()

  const client = await pool.connect()
  const postId = randomUUID()
  try {
    await client.query('BEGIN')

    await client.query(
      `
        INSERT INTO community_posts (
          id,
          user_id,
          content,
          visibility,
          metadata_json
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [postId, input.userId, input.content, input.visibility, input.metadataJson ?? '{}']
    )

    const source = input.source ?? null
    if (source && (source.extractionId || source.taskId || source.sourceLabel)) {
      await client.query(
        `
          INSERT INTO community_post_sources (
            id,
            post_id,
            extraction_id,
            task_id,
            source_label
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          randomUUID(),
          postId,
          source.extractionId ?? null,
          source.taskId ?? null,
          source.sourceLabel ?? null,
        ]
      )
    }

    const attachments = Array.isArray(input.attachments) ? input.attachments : []
    for (const attachment of attachments) {
      await client.query(
        `
          INSERT INTO community_post_attachments (
            id,
            post_id,
            attachment_type,
            storage_provider,
            url,
            thumbnail_url,
            title,
            mime_type,
            metadata_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          postId,
          attachment.attachmentType,
          attachment.storageProvider,
          attachment.url,
          attachment.thumbnailUrl ?? null,
          attachment.title ?? null,
          attachment.mimeType ?? null,
          attachment.metadataJson ?? '{}',
        ]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return findCommunityPostByIdForUser({ postId, userId: input.userId })
}

export async function recordCommunityPostViewsForUser(input: {
  userId: string
  postIds: string[]
}) {
  await ensureDbReady()
  const uniqueIds = Array.from(
    new Set(
      input.postIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  )

  if (uniqueIds.length === 0) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const postId of uniqueIds) {
      await client.query(
        `
          INSERT INTO community_post_views (
            id,
            post_id,
            user_id
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (post_id, user_id)
          DO NOTHING
        `,
        [randomUUID(), postId, input.userId]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function toggleCommunityPostReactionForUser(input: {
  postId: string
  userId: string
  reactionType?: CommunityPostReactionType
}) {
  await ensureDbReady()
  const reactionType: CommunityPostReactionType = input.reactionType ?? 'like'

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query<{ id: string }>(
      `
        SELECT id
        FROM community_post_reactions
        WHERE
          post_id = $1
          AND user_id = $2
          AND reaction_type = $3
        LIMIT 1
      `,
      [input.postId, input.userId, reactionType]
    )

    let reactedByMe = false
    if (existing.rows[0]) {
      await client.query(
        `
          DELETE FROM community_post_reactions
          WHERE id = $1
        `,
        [existing.rows[0].id]
      )
      reactedByMe = false
    } else {
      await client.query(
        `
          INSERT INTO community_post_reactions (
            id,
            post_id,
            user_id,
            reaction_type
          )
          VALUES ($1, $2, $3, $4)
        `,
        [randomUUID(), input.postId, input.userId, reactionType]
      )
      reactedByMe = true
    }

    const summary = await client.query<{ reactions_count: number | string }>(
      `
        SELECT COUNT(*)::int AS reactions_count
        FROM community_post_reactions
        WHERE
          post_id = $1
          AND reaction_type = $2
      `,
      [input.postId, reactionType]
    )

    await client.query('COMMIT')
    return {
      post_id: input.postId,
      reaction_type: reactionType,
      reactions_count: summary.rows[0] ? parseDbInteger(summary.rows[0].reactions_count) : 0,
      reacted_by_me: reactedByMe,
    } satisfies DbCommunityPostReactionSummary
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listCommunityPostCommentsForUser(input: {
  postId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 100, 300)

  const { rows } = await pool.query<DbCommunityPostCommentRow>(
    `
      SELECT
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM community_post_comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT $2
    `,
    [input.postId, safeLimit]
  )

  return rows.map(mapCommunityPostCommentRow)
}

export async function createCommunityPostCommentForUser(input: {
  postId: string
  userId: string
  content: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCommunityPostCommentRow>(
    `
      WITH inserted AS (
        INSERT INTO community_post_comments (
          id,
          post_id,
          user_id,
          content
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          post_id,
          user_id,
          content,
          created_at,
          updated_at
      )
      SELECT
        i.id,
        i.post_id,
        i.user_id,
        i.content,
        i.created_at,
        i.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM inserted i
      INNER JOIN users u ON u.id = i.user_id
      LIMIT 1
    `,
    [randomUUID(), input.postId, input.userId, input.content]
  )

  return rows[0] ? mapCommunityPostCommentRow(rows[0]) : null
}

export async function deleteCommunityPostCommentByIdForUser(input: {
  postId: string
  commentId: string
  actorUserId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCommunityPostCommentRow>(
    `
      WITH deleted AS (
        DELETE FROM community_post_comments c
        USING community_posts p
        WHERE
          c.id = $1
          AND c.post_id = $2
          AND p.id = c.post_id
          AND (
            c.user_id = $3
            OR p.user_id = $3
          )
        RETURNING
          c.id,
          c.post_id,
          c.user_id,
          c.content,
          c.created_at,
          c.updated_at
      )
      SELECT
        d.id,
        d.post_id,
        d.user_id,
        d.content,
        d.created_at,
        d.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM deleted d
      LEFT JOIN users u ON u.id = d.user_id
      LIMIT 1
    `,
    [input.commentId, input.postId, input.actorUserId]
  )

  return rows[0] ? mapCommunityPostCommentRow(rows[0]) : null
}

export async function isCommunityUserFollowedBy(input: {
  followerUserId: string
  followingUserId: string
}) {
  await ensureDbReady()
  if (!input.followerUserId || !input.followingUserId) return false
  if (input.followerUserId === input.followingUserId) return false

  const { rows } = await pool.query<{ followed: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM community_follows
        WHERE
          follower_user_id = $1
          AND following_user_id = $2
      ) AS followed
    `,
    [input.followerUserId, input.followingUserId]
  )

  return rows[0]?.followed === true
}

export async function followCommunityUser(input: {
  followerUserId: string
  followingUserId: string
}) {
  await ensureDbReady()
  if (!input.followerUserId || !input.followingUserId) return false
  if (input.followerUserId === input.followingUserId) return false

  await pool.query(
    `
      INSERT INTO community_follows (
        follower_user_id,
        following_user_id
      )
      VALUES ($1, $2)
      ON CONFLICT (follower_user_id, following_user_id)
      DO NOTHING
    `,
    [input.followerUserId, input.followingUserId]
  )

  return true
}

export async function unfollowCommunityUser(input: {
  followerUserId: string
  followingUserId: string
}) {
  await ensureDbReady()
  if (!input.followerUserId || !input.followingUserId) return false
  if (input.followerUserId === input.followingUserId) return false

  const result = await pool.query(
    `
      DELETE FROM community_follows
      WHERE
        follower_user_id = $1
        AND following_user_id = $2
    `,
    [input.followerUserId, input.followingUserId]
  )

  return (result.rowCount ?? 0) > 0
}

export async function searchCommunityUsers(input: {
  currentUserId: string
  q: string
  limit: number
  offset: number
}): Promise<DbCommunityUserCard[]> {
  await ensureDbReady()

  const { currentUserId, q, limit, offset } = input
  const qTrimmed = q.trim()
  const qLike = `%${qTrimmed}%`

  const { rows } = await pool.query<{
    user_id: string
    name: string | null
    email: string | null
    post_count: string
    follower_count: string
    following_count: string
    is_following: boolean
  }>(
    `
      SELECT
        u.id AS user_id,
        u.name,
        u.email,
        COUNT(DISTINCT cp.id) AS post_count,
        COUNT(DISTINCT cf_in.follower_user_id) AS follower_count,
        COUNT(DISTINCT cf_out.following_user_id) AS following_count,
        CASE WHEN me.follower_user_id IS NOT NULL THEN true ELSE false END AS is_following
      FROM users u
      LEFT JOIN community_posts cp ON cp.user_id = u.id AND cp.visibility != 'private'
      LEFT JOIN community_follows cf_in ON cf_in.following_user_id = u.id
      LEFT JOIN community_follows cf_out ON cf_out.follower_user_id = u.id
      LEFT JOIN community_follows me ON me.follower_user_id = $1 AND me.following_user_id = u.id
      WHERE u.id != $1
        AND ($2 = '' OR u.name ILIKE $3 OR u.email ILIKE $3)
      GROUP BY u.id, me.follower_user_id
      ORDER BY COUNT(DISTINCT cp.id) DESC, COUNT(DISTINCT cf_in.follower_user_id) DESC
      LIMIT $4 OFFSET $5
    `,
    [currentUserId, qTrimmed, qLike, limit, offset]
  )

  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    postCount: Number(row.post_count),
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    isFollowing: row.is_following,
  }))
}

export async function getCommunityUserProfile(
  currentUserId: string,
  targetUserId: string
): Promise<(DbCommunityUserCard & { createdAt: string }) | null> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    user_id: string
    name: string | null
    email: string | null
    post_count: string
    follower_count: string
    following_count: string
    is_following: boolean
    created_at: string
  }>(
    `
      SELECT
        u.id AS user_id,
        u.name,
        u.email,
        COUNT(DISTINCT cp.id) AS post_count,
        COUNT(DISTINCT cf_in.follower_user_id) AS follower_count,
        COUNT(DISTINCT cf_out.following_user_id) AS following_count,
        CASE WHEN me.follower_user_id IS NOT NULL THEN true ELSE false END AS is_following,
        u.created_at
      FROM users u
      LEFT JOIN community_posts cp ON cp.user_id = u.id AND cp.visibility != 'private'
      LEFT JOIN community_follows cf_in ON cf_in.following_user_id = u.id
      LEFT JOIN community_follows cf_out ON cf_out.follower_user_id = u.id
      LEFT JOIN community_follows me ON me.follower_user_id = $1 AND me.following_user_id = u.id
      WHERE u.id = $2
      GROUP BY u.id, me.follower_user_id
    `,
    [currentUserId, targetUserId]
  )

  const row = rows[0]
  if (!row) return null

  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    postCount: Number(row.post_count),
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    isFollowing: row.is_following,
    createdAt: toIso(row.created_at),
  }
}

export async function listCommunityUserPosts(input: {
  currentUserId: string
  targetUserId: string
  limit: number
  offset: number
}): Promise<DbCommunityPost[]> {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)
  const safeOffset = Math.max(0, input.offset)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        p.user_id = $2
        AND ${COMMUNITY_POST_CAN_VIEW_SQL}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $3 OFFSET $4
    `,
    [input.currentUserId, input.targetUserId, safeLimit, safeOffset]
  )

  return rows.map(mapCommunityPostRow)
}

export async function consumeCommunityActionRateLimitByUser(input: {
  userId: string
  actionKey: string
  limit: number
  windowMinutes: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const windowMinutes = Number.isFinite(input.windowMinutes)
    ? Math.min(24 * 60, Math.max(1, Math.trunc(input.windowMinutes)))
    : 60

  const { rows } = await pool.query<DbCommunityActionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT to_timestamp(
          floor(extract(epoch from NOW()) / ($3::int * 60))
          * ($3::int * 60)
        ) AS window_start
      )
      INSERT INTO community_action_rate_limits (
        user_id,
        action_key,
        window_start,
        request_count
      )
      SELECT
        $1,
        $2,
        cw.window_start,
        1
      FROM current_window cw
      ON CONFLICT (user_id, action_key, window_start)
      DO UPDATE SET
        request_count = community_action_rate_limits.request_count + 1,
        updated_at = NOW()
      RETURNING window_start, request_count
    `,
    [input.userId, input.actionKey, windowMinutes]
  )

  const row = rows[0]
  if (!row) {
    throw new Error('No se pudo registrar el consumo del rate limit de comunidad.')
  }

  const usedRaw =
    typeof row.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row.request_count), 10)
  const used = Number.isFinite(usedRaw) ? usedRaw : input.limit + 1

  const windowStart = new Date(toIso(row.window_start))
  const resetAtMs = windowStart.getTime() + windowMinutes * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used <= input.limit,
  }
}

export async function getCommunityActionRateLimitUsageByUser(input: {
  userId: string
  actionKey: string
  limit: number
  windowMinutes: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const windowMinutes = Number.isFinite(input.windowMinutes)
    ? Math.min(24 * 60, Math.max(1, Math.trunc(input.windowMinutes)))
    : 60

  const { rows } = await pool.query<DbCommunityActionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT to_timestamp(
          floor(extract(epoch from NOW()) / ($3::int * 60))
          * ($3::int * 60)
        ) AS window_start
      )
      SELECT
        cw.window_start AS window_start,
        COALESCE(carl.request_count, 0) AS request_count
      FROM current_window cw
      LEFT JOIN community_action_rate_limits carl
        ON carl.user_id = $1
       AND carl.action_key = $2
       AND carl.window_start = cw.window_start
      LIMIT 1
    `,
    [input.userId, input.actionKey, windowMinutes]
  )

  const row = rows[0]
  const usedRaw =
    typeof row?.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row?.request_count ?? 0), 10)
  const used = Number.isFinite(usedRaw) ? Math.max(0, usedRaw) : 0

  const windowStart = row?.window_start ? new Date(toIso(row.window_start)) : new Date()
  const resetAtMs = windowStart.getTime() + windowMinutes * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used < input.limit,
  }
}
