import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

export interface DbUser {
  id: string
  name: string
  email: string
  password_hash: string
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
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  created_at: string
}

export interface DbVideoCache {
  video_id: string
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

interface GlobalDb {
  __actionExtractorPgPool?: Pool
  __actionExtractorDbReady?: Promise<void>
}

interface DbUserRow {
  id: string
  name: string
  email: string
  password_hash: string
  created_at: Date | string
  updated_at: Date | string
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
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  created_at: Date | string
}

interface DbVideoCacheRow {
  video_id: string
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
    objective TEXT NOT NULL,
    phases_json TEXT NOT NULL,
    pro_tip TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS video_cache (
    video_id TEXT PRIMARY KEY,
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

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON extractions(user_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_created_at ON extractions(created_at);
  CREATE INDEX IF NOT EXISTS idx_video_cache_last_used_at ON video_cache(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id);
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

function mapUserRow(row: DbUserRow): DbUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
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

async function ensureDbReady() {
  await getDbReadyPromise()
}

export async function findUserByEmail(email: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      SELECT id, name, email, password_hash, created_at, updated_at
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
      SELECT id, name, email, password_hash, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  )
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function createUser(input: { name: string; email: string; passwordHash: string }) {
  await ensureDbReady()
  const id = randomUUID()
  const { rows } = await pool.query<DbUserRow>(
    `
      INSERT INTO users (id, name, email, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, password_hash, created_at, updated_at
    `,
    [id, input.name, input.email, input.passwordHash]
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
        id, user_id, url, video_id, objective, phases_json, pro_tip, metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, url, video_id, objective, phases_json, pro_tip, metadata_json, created_at
    `,
    [
      id,
      input.userId,
      input.url,
      input.videoId,
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
      SELECT id, user_id, url, video_id, objective, phases_json, pro_tip, metadata_json, created_at
      FROM extractions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  )
  return rows.map(mapExtractionRow)
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
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        prompt_version,
        model
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (video_id)
      DO UPDATE SET
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
