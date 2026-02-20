import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

export interface DbUser {
  id: string
  name: string
  email: string
  password_hash: string
  email_verified_at: string | null
  created_at: string
  updated_at: string
}

interface DbSessionWithUser {
  session_id: string
  user_id: string
  expires_at: string
  user_name: string
  user_email: string
}

export interface DbExtraction {
  id: string
  user_id: string
  url: string
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  created_at: string
}

export interface DbVideoCache {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  prompt_version: string
  model: string
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbShareToken {
  token: string
  extraction_id: string
  user_id: string
  created_at: string
  last_used_at: string
}

export interface DbNotionConnection {
  user_id: string
  access_token: string
  workspace_id: string | null
  workspace_name: string | null
  workspace_icon: string | null
  bot_id: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbTrelloConnection {
  user_id: string
  access_token: string
  member_id: string | null
  username: string | null
  full_name: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbTodoistConnection {
  user_id: string
  access_token: string
  project_id: string | null
  user_email: string | null
  user_name: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbGoogleDocsConnection {
  user_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scope: string | null
  google_user_id: string | null
  user_email: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface UserExtractionRateLimitUsage {
  limit: number
  used: number
  remaining: number
  reset_at: string
  allowed: boolean
}

export interface AdminDailyExtractionStat {
  date: string
  total: number
}

export interface AdminTopVideoStat {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  total: number
}

export interface AdminModeBreakdownStat {
  extraction_mode: string
  total: number
}

export interface AdminUsageStats {
  period_days: number
  generated_at: string
  total_users: number
  total_extractions: number
  active_users_7d: number
  extractions_last_24h: number
  unique_videos_in_period: number
  extractions_by_day: AdminDailyExtractionStat[]
  top_videos: AdminTopVideoStat[]
  extraction_modes: AdminModeBreakdownStat[]
}

interface GlobalDb {
  __actionExtractorPgPool?: Pool
  __actionExtractorDbReady?: Promise<void>
}

interface DbUserRow {
  id: string
  name: string
  email: string
  password_hash: string
  email_verified_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbEmailVerificationTokenRow {
  user_id: string
  expires_at: Date | string
}

interface DbSessionWithUserRow {
  session_id: string
  user_id: string
  expires_at: Date | string
  user_name: string
  user_email: string
}

interface DbExtractionRow {
  id: string
  user_id: string
  url: string
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  created_at: Date | string
}

interface DbVideoCacheRow {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  prompt_version: string
  model: string
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbShareTokenRow {
  token: string
  extraction_id: string
  user_id: string
  created_at: Date | string
  last_used_at: Date | string
}

interface DbNotionConnectionRow {
  user_id: string
  access_token: string
  workspace_id: string | null
  workspace_name: string | null
  workspace_icon: string | null
  bot_id: string | null
  owner_user_id: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbTrelloConnectionRow {
  user_id: string
  access_token: string
  member_id: string | null
  username: string | null
  full_name: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbTodoistConnectionRow {
  user_id: string
  access_token: string
  project_id: string | null
  user_email: string | null
  user_name: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbGoogleDocsConnectionRow {
  user_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: Date | string | null
  scope: string | null
  google_user_id: string | null
  user_email: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbExtractionRateLimitRow {
  window_start: Date | string
  request_count: number | string
}

interface DbCountRow {
  total: number | string
}

interface DbAdminDailyExtractionRow {
  day: Date | string
  total: number | string
}

interface DbAdminTopVideoRow {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  total: number | string
}

interface DbAdminModeBreakdownRow {
  extraction_mode: string | null
  total: number | string
}

const globalForDb = globalThis as unknown as GlobalDb

const pool =
  globalForDb.__actionExtractorPgPool ??
  new Pool(
    process.env.ACTION_EXTRACTOR_DATABASE_URL
      ? {
          connectionString: process.env.ACTION_EXTRACTOR_DATABASE_URL,
        }
      : {
          host: process.env.ACTION_EXTRACTOR_DB_HOST ?? 'postgres-db',
          port: Number(process.env.ACTION_EXTRACTOR_DB_PORT ?? 5432),
          database: process.env.ACTION_EXTRACTOR_DB_NAME ?? 'action_extractor_db',
          user: process.env.ACTION_EXTRACTOR_DB_USER ?? 'well',
          password: process.env.ACTION_EXTRACTOR_DB_PASSWORD ?? '',
        }
  )

if (!globalForDb.__actionExtractorPgPool) {
  globalForDb.__actionExtractorPgPool = pool
}

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extractions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    video_id TEXT,
    video_title TEXT,
    thumbnail_url TEXT,
    extraction_mode TEXT NOT NULL DEFAULT 'action_plan',
    objective TEXT NOT NULL,
    phases_json TEXT NOT NULL,
    pro_tip TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS video_cache (
    video_id TEXT PRIMARY KEY,
    video_title TEXT,
    thumbnail_url TEXT,
    objective TEXT NOT NULL,
    phases_json TEXT NOT NULL,
    pro_tip TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS share_tokens (
    token TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS notion_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    workspace_id TEXT,
    workspace_name TEXT,
    workspace_icon TEXT,
    bot_id TEXT,
    owner_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS trello_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    member_id TEXT,
    username TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS todoist_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    project_id TEXT,
    user_email TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS google_docs_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scope TEXT,
    google_user_id TEXT,
    user_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_rate_limits (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, window_start)
  );

  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS video_title TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS extraction_mode TEXT NOT NULL DEFAULT 'action_plan';
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS video_title TEXT;
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON extractions(user_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_created_at ON extractions(created_at);
  CREATE INDEX IF NOT EXISTS idx_video_cache_last_used_at ON video_cache(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_share_tokens_extraction_id ON share_tokens(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_share_tokens_user_id ON share_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_share_tokens_last_used_at ON share_tokens(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_notion_connections_last_used_at ON notion_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_trello_connections_last_used_at ON trello_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_todoist_connections_last_used_at ON todoist_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_google_docs_connections_last_used_at ON google_docs_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_rate_limits_window_start ON extraction_rate_limits(window_start);
`

function getDbReadyPromise() {
  if (!globalForDb.__actionExtractorDbReady) {
    globalForDb.__actionExtractorDbReady = pool.query(INIT_SQL).then(() => undefined)
  }

  return globalForDb.__actionExtractorDbReady
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toISOString()
}

function parseDbInteger(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed)
  }

  return 0
}

function mapUserRow(row: DbUserRow): DbUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    email_verified_at: row.email_verified_at ? toIso(row.email_verified_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapSessionRow(row: DbSessionWithUserRow): DbSessionWithUser {
  return {
    session_id: row.session_id,
    user_id: row.user_id,
    expires_at: toIso(row.expires_at),
    user_name: row.user_name,
    user_email: row.user_email,
  }
}

function mapExtractionRow(row: DbExtractionRow): DbExtraction {
  return {
    id: row.id,
    user_id: row.user_id,
    url: row.url,
    video_id: row.video_id,
    video_title: row.video_title,
    thumbnail_url: row.thumbnail_url,
    extraction_mode: row.extraction_mode || 'action_plan',
    objective: row.objective,
    phases_json: row.phases_json,
    pro_tip: row.pro_tip,
    metadata_json: row.metadata_json,
    created_at: toIso(row.created_at),
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
    prompt_version: row.prompt_version,
    model: row.model,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapShareTokenRow(row: DbShareTokenRow): DbShareToken {
  return {
    token: row.token,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    created_at: toIso(row.created_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapNotionConnectionRow(row: DbNotionConnectionRow): DbNotionConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    workspace_id: row.workspace_id,
    workspace_name: row.workspace_name,
    workspace_icon: row.workspace_icon,
    bot_id: row.bot_id,
    owner_user_id: row.owner_user_id,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapTrelloConnectionRow(row: DbTrelloConnectionRow): DbTrelloConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    member_id: row.member_id,
    username: row.username,
    full_name: row.full_name,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapTodoistConnectionRow(row: DbTodoistConnectionRow): DbTodoistConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    project_id: row.project_id,
    user_email: row.user_email,
    user_name: row.user_name,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapGoogleDocsConnectionRow(row: DbGoogleDocsConnectionRow): DbGoogleDocsConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expires_at: row.token_expires_at ? toIso(row.token_expires_at) : null,
    scope: row.scope,
    google_user_id: row.google_user_id,
    user_email: row.user_email,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

async function ensureDbReady() {
  await getDbReadyPromise()
}

export async function findUserByEmail(email: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      SELECT id, name, email, password_hash, email_verified_at, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  )
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function findUserById(id: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      SELECT id, name, email, password_hash, email_verified_at, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  )
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function createUser(input: {
  name: string
  email: string
  passwordHash: string
  emailVerifiedAt?: Date | null
}) {
  await ensureDbReady()
  const id = randomUUID()
  const { rows } = await pool.query<DbUserRow>(
    `
      INSERT INTO users (id, name, email, password_hash, email_verified_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, password_hash, email_verified_at, created_at, updated_at
    `,
    [
      id,
      input.name,
      input.email,
      input.passwordHash,
      input.emailVerifiedAt ? input.emailVerifiedAt.toISOString() : null,
    ]
  )
  return mapUserRow(rows[0])
}

export async function createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, input.userId, input.tokenHash, input.expiresAt.toISOString()]
  )
}

export async function findSessionWithUserByTokenHash(tokenHash: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbSessionWithUserRow>(
    `
      SELECT
        s.id AS session_id,
        s.user_id AS user_id,
        s.expires_at AS expires_at,
        u.name AS user_name,
        u.email AS user_email
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  )
  return rows[0] ? mapSessionRow(rows[0]) : null
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
}

export async function deleteExpiredSessions() {
  await ensureDbReady()
  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()')
}

export async function createExtraction(input: {
  userId: string
  url: string
  videoId: string | null
  videoTitle: string | null
  thumbnailUrl: string | null
  extractionMode: string
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
}) {
  await ensureDbReady()
  const id = randomUUID()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      INSERT INTO extractions (
        id,
        user_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        user_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        created_at
    `,
    [
      id,
      input.userId,
      input.url,
      input.videoId,
      input.videoTitle,
      input.thumbnailUrl,
      input.extractionMode,
      input.objective,
      input.phasesJson,
      input.proTip,
      input.metadataJson,
    ]
  )

  return mapExtractionRow(rows[0])
}

export async function listExtractionsByUser(userId: string, limit = 30) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        id,
        user_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        created_at
      FROM extractions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  )
  return rows.map(mapExtractionRow)
}

export async function findExtractionById(id: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        id,
        user_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        created_at
      FROM extractions
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function findExtractionByIdForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        id,
        user_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        created_at
      FROM extractions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [input.id, input.userId]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function createOrGetShareToken(input: { extractionId: string; userId: string }) {
  await ensureDbReady()
  const generatedToken = randomUUID().replace(/-/g, '')
  const { rows } = await pool.query<DbShareTokenRow>(
    `
      INSERT INTO share_tokens (token, extraction_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (extraction_id)
      DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING token, extraction_id, user_id, created_at, last_used_at
    `,
    [generatedToken, input.extractionId, input.userId]
  )
  return mapShareTokenRow(rows[0])
}

export async function findSharedExtractionByToken(token: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
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
        e.created_at
      FROM share_tokens st
      INNER JOIN extractions e ON e.id = st.extraction_id
      WHERE st.token = $1
      LIMIT 1
    `,
    [token]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE share_tokens
      SET last_used_at = NOW()
      WHERE token = $1
    `,
    [token]
  )

  return mapExtractionRow(row)
}

export async function findNotionConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbNotionConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        workspace_id,
        workspace_name,
        workspace_icon,
        bot_id,
        owner_user_id,
        created_at,
        updated_at,
        last_used_at
      FROM notion_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE notion_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapNotionConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertNotionConnection(input: {
  userId: string
  accessToken: string
  workspaceId: string | null
  workspaceName: string | null
  workspaceIcon: string | null
  botId: string | null
  ownerUserId: string | null
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbNotionConnectionRow>(
    `
      INSERT INTO notion_connections (
        user_id,
        access_token,
        workspace_id,
        workspace_name,
        workspace_icon,
        bot_id,
        owner_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        workspace_id = EXCLUDED.workspace_id,
        workspace_name = EXCLUDED.workspace_name,
        workspace_icon = EXCLUDED.workspace_icon,
        bot_id = EXCLUDED.bot_id,
        owner_user_id = EXCLUDED.owner_user_id,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        workspace_id,
        workspace_name,
        workspace_icon,
        bot_id,
        owner_user_id,
        created_at,
        updated_at,
        last_used_at
    `,
    [
      input.userId,
      input.accessToken,
      input.workspaceId,
      input.workspaceName,
      input.workspaceIcon,
      input.botId,
      input.ownerUserId,
    ]
  )

  return mapNotionConnectionRow(rows[0])
}

export async function deleteNotionConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM notion_connections WHERE user_id = $1', [userId])
}

export async function findTrelloConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTrelloConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        member_id,
        username,
        full_name,
        created_at,
        updated_at,
        last_used_at
      FROM trello_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE trello_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapTrelloConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertTrelloConnection(input: {
  userId: string
  accessToken: string
  memberId: string | null
  username: string | null
  fullName: string | null
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTrelloConnectionRow>(
    `
      INSERT INTO trello_connections (
        user_id,
        access_token,
        member_id,
        username,
        full_name
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        member_id = EXCLUDED.member_id,
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        member_id,
        username,
        full_name,
        created_at,
        updated_at,
        last_used_at
    `,
    [input.userId, input.accessToken, input.memberId, input.username, input.fullName]
  )

  return mapTrelloConnectionRow(rows[0])
}

export async function deleteTrelloConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM trello_connections WHERE user_id = $1', [userId])
}

export async function findTodoistConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTodoistConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        project_id,
        user_email,
        user_name,
        created_at,
        updated_at,
        last_used_at
      FROM todoist_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE todoist_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapTodoistConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertTodoistConnection(input: {
  userId: string
  accessToken: string
  projectId: string | null
  userEmail: string | null
  userName: string | null
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTodoistConnectionRow>(
    `
      INSERT INTO todoist_connections (
        user_id,
        access_token,
        project_id,
        user_email,
        user_name
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        project_id = EXCLUDED.project_id,
        user_email = EXCLUDED.user_email,
        user_name = EXCLUDED.user_name,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        project_id,
        user_email,
        user_name,
        created_at,
        updated_at,
        last_used_at
    `,
    [input.userId, input.accessToken, input.projectId, input.userEmail, input.userName]
  )

  return mapTodoistConnectionRow(rows[0])
}

export async function deleteTodoistConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM todoist_connections WHERE user_id = $1', [userId])
}

export async function findGoogleDocsConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbGoogleDocsConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        refresh_token,
        token_expires_at,
        scope,
        google_user_id,
        user_email,
        created_at,
        updated_at,
        last_used_at
      FROM google_docs_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE google_docs_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapGoogleDocsConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertGoogleDocsConnection(input: {
  userId: string
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: string | null
  scope: string | null
  googleUserId: string | null
  userEmail: string | null
}) {
  await ensureDbReady()

  const tokenExpiresAtValue =
    input.tokenExpiresAt && input.tokenExpiresAt.trim() ? input.tokenExpiresAt : null

  const { rows } = await pool.query<DbGoogleDocsConnectionRow>(
    `
      INSERT INTO google_docs_connections (
        user_id,
        access_token,
        refresh_token,
        token_expires_at,
        scope,
        google_user_id,
        user_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, google_docs_connections.refresh_token),
        token_expires_at = EXCLUDED.token_expires_at,
        scope = EXCLUDED.scope,
        google_user_id = EXCLUDED.google_user_id,
        user_email = EXCLUDED.user_email,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        refresh_token,
        token_expires_at,
        scope,
        google_user_id,
        user_email,
        created_at,
        updated_at,
        last_used_at
    `,
    [
      input.userId,
      input.accessToken,
      input.refreshToken,
      tokenExpiresAtValue,
      input.scope,
      input.googleUserId,
      input.userEmail,
    ]
  )

  return mapGoogleDocsConnectionRow(rows[0])
}

export async function deleteGoogleDocsConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM google_docs_connections WHERE user_id = $1', [userId])
}

export async function consumeExtractionRateLimitByUser(input: {
  userId: string
  limit: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const { rows } = await pool.query<DbExtractionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT date_trunc('hour', NOW()) AS window_start
      )
      INSERT INTO extraction_rate_limits (user_id, window_start, request_count)
      SELECT $1, cw.window_start, 1
      FROM current_window cw
      ON CONFLICT (user_id, window_start)
      DO UPDATE SET
        request_count = extraction_rate_limits.request_count + 1,
        updated_at = NOW()
      RETURNING window_start, request_count
    `,
    [input.userId]
  )

  const row = rows[0]
  if (!row) {
    throw new Error('No se pudo registrar el consumo del rate limit.')
  }

  const usedRaw =
    typeof row.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row.request_count), 10)
  const used = Number.isFinite(usedRaw) ? usedRaw : input.limit + 1

  const windowStart = new Date(toIso(row.window_start))
  const resetAtMs = windowStart.getTime() + 60 * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used <= input.limit,
  }
}

export async function getAdminUsageStats(periodDays = 30): Promise<AdminUsageStats> {
  await ensureDbReady()

  const safePeriodDays = Number.isFinite(periodDays)
    ? Math.min(90, Math.max(1, Math.trunc(periodDays)))
    : 30

  const [totalUsersResult, totalExtractionsResult, activeUsers7dResult, last24hResult, uniqueVideosResult] =
    await Promise.all([
      pool.query<DbCountRow>('SELECT COUNT(*)::int AS total FROM users'),
      pool.query<DbCountRow>('SELECT COUNT(*)::int AS total FROM extractions'),
      pool.query<DbCountRow>(
        `
          SELECT COUNT(DISTINCT user_id)::int AS total
          FROM extractions
          WHERE created_at >= NOW() - INTERVAL '7 days'
        `
      ),
      pool.query<DbCountRow>(
        `
          SELECT COUNT(*)::int AS total
          FROM extractions
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        `
      ),
      pool.query<DbCountRow>(
        `
          SELECT COUNT(DISTINCT video_id)::int AS total
          FROM extractions
          WHERE video_id IS NOT NULL
            AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
        `,
        [safePeriodDays]
      ),
    ])

  const [dailyResult, topVideosResult, modeBreakdownResult] = await Promise.all([
    pool.query<DbAdminDailyExtractionRow>(
      `
        SELECT
          date_trunc('day', created_at) AS day,
          COUNT(*)::int AS total
        FROM extractions
        WHERE created_at >= date_trunc('day', NOW()) - (($1::int - 1) * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [safePeriodDays]
    ),
    pool.query<DbAdminTopVideoRow>(
      `
        SELECT
          video_id,
          MAX(video_title) AS video_title,
          MAX(thumbnail_url) AS thumbnail_url,
          COUNT(*)::int AS total
        FROM extractions
        WHERE video_id IS NOT NULL
          AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY video_id
        ORDER BY total DESC
        LIMIT 10
      `,
      [safePeriodDays]
    ),
    pool.query<DbAdminModeBreakdownRow>(
      `
        SELECT
          extraction_mode,
          COUNT(*)::int AS total
        FROM extractions
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY extraction_mode
        ORDER BY total DESC
      `,
      [safePeriodDays]
    ),
  ])

  return {
    period_days: safePeriodDays,
    generated_at: new Date().toISOString(),
    total_users: parseDbInteger(totalUsersResult.rows[0]?.total),
    total_extractions: parseDbInteger(totalExtractionsResult.rows[0]?.total),
    active_users_7d: parseDbInteger(activeUsers7dResult.rows[0]?.total),
    extractions_last_24h: parseDbInteger(last24hResult.rows[0]?.total),
    unique_videos_in_period: parseDbInteger(uniqueVideosResult.rows[0]?.total),
    extractions_by_day: dailyResult.rows.map((row) => ({
      date: toIso(row.day).slice(0, 10),
      total: parseDbInteger(row.total),
    })),
    top_videos: topVideosResult.rows.map((row) => ({
      video_id: row.video_id,
      video_title: row.video_title,
      thumbnail_url: row.thumbnail_url,
      total: parseDbInteger(row.total),
    })),
    extraction_modes: modeBreakdownResult.rows.map((row) => ({
      extraction_mode: row.extraction_mode || 'action_plan',
      total: parseDbInteger(row.total),
    })),
  }
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

  await pool.query(
    `
      UPDATE video_cache
      SET last_used_at = NOW()
      WHERE video_id = $1
    `,
    [input.videoId]
  )

  return mapVideoCacheRow({
    ...row,
    last_used_at: new Date().toISOString(),
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
        prompt_version,
        model
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (video_id)
      DO UPDATE SET
        video_title = EXCLUDED.video_title,
        thumbnail_url = EXCLUDED.thumbnail_url,
        objective = EXCLUDED.objective,
        phases_json = EXCLUDED.phases_json,
        pro_tip = EXCLUDED.pro_tip,
        metadata_json = EXCLUDED.metadata_json,
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
      input.promptVersion,
      input.model,
    ]
  )

  return mapVideoCacheRow(rows[0])
}

export async function createPasswordResetToken(input: {
  userId: string
  tokenHash: string
  expiresAt: Date
}) {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, input.userId, input.tokenHash, input.expiresAt.toISOString()]
  )
}

export async function findPasswordResetTokenByHash(tokenHash: string) {
  await ensureDbReady()
  const { rows } = await pool.query<{ user_id: string; expires_at: string }>(
    `
      SELECT user_id, expires_at
      FROM password_reset_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  )
  if (!rows[0]) return null
  return {
    user_id: rows[0].user_id,
    expires_at: toIso(rows[0].expires_at),
  }
}

export async function deletePasswordResetTokenByHash(tokenHash: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash])
}

export async function deletePasswordResetTokensByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId])
}

export async function createEmailVerificationToken(input: {
  userId: string
  tokenHash: string
  expiresAt: Date
}) {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, input.userId, input.tokenHash, input.expiresAt.toISOString()]
  )
}

export async function findEmailVerificationTokenByHash(tokenHash: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbEmailVerificationTokenRow>(
    `
      SELECT user_id, expires_at
      FROM email_verification_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  )
  if (!rows[0]) return null
  return {
    user_id: rows[0].user_id,
    expires_at: toIso(rows[0].expires_at),
  }
}

export async function deleteEmailVerificationTokenByHash(tokenHash: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM email_verification_tokens WHERE token_hash = $1', [tokenHash])
}

export async function deleteEmailVerificationTokensByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId])
}

export async function markUserEmailAsVerified(userId: string) {
  await ensureDbReady()
  await pool.query(
    `
      UPDATE users
      SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
      WHERE id = $1
    `,
    [userId]
  )
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await ensureDbReady()
  await pool.query(
    `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [passwordHash, userId]
  )
}

export async function updateUnverifiedUserRegistration(input: {
  userId: string
  name: string
  passwordHash: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      UPDATE users
      SET name = $1, password_hash = $2, updated_at = NOW()
      WHERE id = $3 AND email_verified_at IS NULL
      RETURNING id, name, email, password_hash, email_verified_at, created_at, updated_at
    `,
    [input.name, input.passwordHash, input.userId]
  )

  return rows[0] ? mapUserRow(rows[0]) : null
}

export function mapUserForClient(user: Pick<DbUser, 'id' | 'name' | 'email'>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  }
}

export function mapSessionUserForClient(session: DbSessionWithUser) {
  return {
    id: session.user_id,
    name: session.user_name,
    email: session.user_email,
  }
}
