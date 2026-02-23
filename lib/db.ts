import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

export interface DbUser {
  id: string
  name: string
  email: string
  password_hash: string
  email_verified_at: string | null
  blocked_at: string | null
  created_at: string
  updated_at: string
}

interface DbSessionWithUser {
  session_id: string
  user_id: string
  expires_at: string
  user_name: string
  user_email: string
  user_blocked_at: string | null
}

export interface DbExtraction {
  id: string
  user_id: string
  url: string | null
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  share_visibility: ExtractionShareVisibility
  order_number?: number
  created_at: string
  source_type: string
  source_label: string | null
  folder_id: string | null
}

export interface DbVideoCache {
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

export type ExtractionShareVisibility = 'private' | 'public'

export type ExtractionTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'
export type ExtractionTaskEventType = 'note' | 'pending_action' | 'blocker' | 'resolved'
export type ExtractionTaskAttachmentType = 'pdf' | 'image' | 'audio' | 'youtube_link' | 'note'
export type ExtractionTaskAttachmentStorageProvider = 'cloudinary' | 'external'

export interface DbExtractionTask {
  id: string
  extraction_id: string
  user_id: string
  phase_id: number
  phase_title: string
  item_index: number
  item_text: string
  checked: boolean
  status: ExtractionTaskStatus
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DbExtractionTaskEvent {
  id: string
  task_id: string
  user_id: string
  event_type: ExtractionTaskEventType
  content: string
  metadata_json: string
  created_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionTaskAttachment {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  attachment_type: ExtractionTaskAttachmentType
  storage_provider: ExtractionTaskAttachmentStorageProvider
  url: string
  thumbnail_url: string | null
  title: string | null
  mime_type: string | null
  size_bytes: number | null
  metadata_json: string
  created_at: string
  updated_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionTaskComment {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionTaskLikeSummary {
  task_id: string
  extraction_id: string
  likes_count: number
  liked_by_me: boolean
}

export type ChatMessageRole = 'user' | 'assistant'

export interface DbChatConversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface DbChatMessage {
  id: string
  conversation_id: string
  user_id: string
  role: ChatMessageRole
  content: string
  metadata_json: string
  created_at: string
  updated_at: string
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

export type AdminUserVerificationFilter = 'all' | 'verified' | 'unverified'
export type AdminUserBlockedFilter = 'all' | 'blocked' | 'active'

export interface AdminUserListItem {
  id: string
  name: string
  email: string
  created_at: string
  email_verified_at: string | null
  blocked_at: string | null
  total_extractions: number
  last_extraction_at: string | null
  ai_calls: number
  ai_input_tokens: number
  ai_output_tokens: number
  ai_cost_usd: number
}

export interface AdminUserListResult {
  total: number
  users: AdminUserListItem[]
}

interface GlobalDb {
  __actionExtractorPgPool?: Pool
  __actionExtractorDbReady?: Promise<void>
  __actionExtractorDbInitSignature?: string
}

interface DbUserRow {
  id: string
  name: string
  email: string
  password_hash: string
  email_verified_at: Date | string | null
  blocked_at: Date | string | null
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
  user_blocked_at: Date | string | null
}

interface DbExtractionRow {
  id: string
  user_id: string
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
  order_number?: number | string
  created_at: Date | string
  source_type?: string | null
  source_label?: string | null
  folder_id?: string | null
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

interface DbExtractionTaskRow {
  id: string
  extraction_id: string
  user_id: string
  phase_id: number | string
  phase_title: string
  item_index: number | string
  item_text: string
  checked: boolean
  status: ExtractionTaskStatus
  due_at: Date | string | null
  completed_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
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

interface DbExtractionTaskCommentRow {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  content: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionTaskLikeSummaryRow {
  likes_count: number | string
  liked_by_me: boolean
}

interface DbChatConversationRow {
  id: string
  user_id: string
  title: string
  created_at: Date | string
  updated_at: Date | string
}

interface DbChatMessageRow {
  id: string
  conversation_id: string
  user_id: string
  role: string
  content: string
  metadata_json: string
  created_at: Date | string
  updated_at: Date | string
}

interface DbExtractionRateLimitRow {
  window_start: Date | string
  request_count: number | string
}

interface DbCountRow {
  total: number | string
}

interface DbExtractionOrderNumberRow {
  order_number: number | string
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

interface DbAdminUserListRow {
  id: string
  name: string
  email: string
  created_at: Date | string
  email_verified_at: Date | string | null
  blocked_at: Date | string | null
  total_extractions: number | string
  last_extraction_at: Date | string | null
  ai_calls: number | string
  ai_input_tokens: number | string
  ai_output_tokens: number | string
  ai_cost_usd: string | number
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
    blocked_at TIMESTAMPTZ,
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
    transcript_text TEXT,
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

  CREATE TABLE IF NOT EXISTS extraction_tasks (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phase_id INTEGER NOT NULL,
    phase_title TEXT NOT NULL,
    item_index INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending',
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (extraction_id, phase_id, item_index)
  );

  CREATE TABLE IF NOT EXISTS extraction_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_task_attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'external',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_task_likes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Asistente de Contenidos',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS checked BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_events ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE extraction_task_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS attachment_type TEXT NOT NULL DEFAULT 'pdf';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'external';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS mime_type TEXT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_likes ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Asistente de Contenidos';
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS video_title TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS extraction_mode TEXT NOT NULL DEFAULT 'action_plan';
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS share_visibility TEXT NOT NULL DEFAULT 'private';
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS video_title TEXT;
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS transcript_text TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_blocked_at ON users(blocked_at);
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
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_extraction_id ON extraction_tasks(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_user_id ON extraction_tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_status ON extraction_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_events_task_id ON extraction_task_events(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_events_created_at ON extraction_task_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_task_id ON extraction_task_attachments(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_extraction_id ON extraction_task_attachments(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_user_id ON extraction_task_attachments(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_created_at ON extraction_task_attachments(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_task_id ON extraction_task_comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_extraction_id ON extraction_task_comments(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_created_at ON extraction_task_comments(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_likes_task_id ON extraction_task_likes(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_likes_extraction_id ON extraction_task_likes(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_likes_task_user_unique ON extraction_task_likes(task_id, user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ai_usage_log (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    use_type TEXT NOT NULL DEFAULT 'extraction',
    user_id TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS user_id TEXT;

  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider_model ON ai_usage_log(provider, model);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id);

  ALTER TABLE extractions ALTER COLUMN url DROP NOT NULL;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'youtube';
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_label TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS folder_id TEXT;

  CREATE TABLE IF NOT EXISTS guest_extraction_limits (
    guest_id    TEXT    NOT NULL,
    window_date DATE    NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guest_id, window_date)
  );
`

const DB_INIT_SIGNATURE = '2026-02-23-guest-mode-v1'

function getDbReadyPromise() {
  const shouldReinitialize =
    !globalForDb.__actionExtractorDbReady ||
    globalForDb.__actionExtractorDbInitSignature !== DB_INIT_SIGNATURE

  if (shouldReinitialize) {
    let readyPromise: Promise<void>
    readyPromise = pool
      .query(INIT_SQL)
      .then(() => undefined)
      .catch((error) => {
        if (globalForDb.__actionExtractorDbReady === readyPromise) {
          globalForDb.__actionExtractorDbReady = undefined
          globalForDb.__actionExtractorDbInitSignature = undefined
        }
        throw error
      })

    globalForDb.__actionExtractorDbReady = readyPromise
    globalForDb.__actionExtractorDbInitSignature = DB_INIT_SIGNATURE
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

function parseDbNullableInteger(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed)
  }

  return null
}

function normalizeExtractionShareVisibility(value: unknown): ExtractionShareVisibility {
  return value === 'public' ? 'public' : 'private'
}

function mapUserRow(row: DbUserRow): DbUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    email_verified_at: row.email_verified_at ? toIso(row.email_verified_at) : null,
    blocked_at: row.blocked_at ? toIso(row.blocked_at) : null,
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
    user_blocked_at: row.user_blocked_at ? toIso(row.user_blocked_at) : null,
  }
}

function mapAdminUserListRow(row: DbAdminUserListRow): AdminUserListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: toIso(row.created_at),
    email_verified_at: row.email_verified_at ? toIso(row.email_verified_at) : null,
    blocked_at: row.blocked_at ? toIso(row.blocked_at) : null,
    total_extractions: parseDbInteger(row.total_extractions),
    last_extraction_at: row.last_extraction_at ? toIso(row.last_extraction_at) : null,
    ai_calls: parseDbInteger(row.ai_calls),
    ai_input_tokens: Number(row.ai_input_tokens ?? 0),
    ai_output_tokens: Number(row.ai_output_tokens ?? 0),
    ai_cost_usd: Number(row.ai_cost_usd ?? 0),
  }
}

function mapExtractionRow(row: DbExtractionRow): DbExtraction {
  const orderNumber =
    row.order_number === null || row.order_number === undefined
      ? undefined
      : parseDbInteger(row.order_number)
  const shareVisibility = normalizeExtractionShareVisibility(row.share_visibility)

  return {
    id: row.id,
    user_id: row.user_id,
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
    order_number: orderNumber,
    created_at: toIso(row.created_at),
    source_type: row.source_type ?? 'youtube',
    source_label: row.source_label ?? null,
    folder_id: row.folder_id ?? null,
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

function mapExtractionTaskRow(row: DbExtractionTaskRow): DbExtractionTask {
  const parsedPhaseId =
    typeof row.phase_id === 'number' ? row.phase_id : Number.parseInt(String(row.phase_id), 10)
  const parsedItemIndex =
    typeof row.item_index === 'number' ? row.item_index : Number.parseInt(String(row.item_index), 10)

  return {
    id: row.id,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    phase_id: Number.isFinite(parsedPhaseId) ? parsedPhaseId : 0,
    phase_title: row.phase_title,
    item_index: Number.isFinite(parsedItemIndex) ? parsedItemIndex : 0,
    item_text: row.item_text,
    checked: row.checked === true,
    status: row.status,
    due_at: row.due_at ? toIso(row.due_at) : null,
    completed_at: row.completed_at ? toIso(row.completed_at) : null,
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

function normalizeAttachmentType(value: unknown): ExtractionTaskAttachmentType {
  if (value === 'image' || value === 'audio' || value === 'youtube_link' || value === 'note') {
    return value
  }
  return 'pdf'
}

function normalizeAttachmentStorageProvider(value: unknown): ExtractionTaskAttachmentStorageProvider {
  return value === 'cloudinary' ? 'cloudinary' : 'external'
}

function mapExtractionTaskAttachmentRow(row: DbExtractionTaskAttachmentRow): DbExtractionTaskAttachment {
  return {
    id: row.id,
    task_id: row.task_id,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    attachment_type: normalizeAttachmentType(row.attachment_type),
    storage_provider: normalizeAttachmentStorageProvider(row.storage_provider),
    url: row.url,
    thumbnail_url: row.thumbnail_url,
    title: row.title,
    mime_type: row.mime_type,
    size_bytes: parseDbNullableInteger(row.size_bytes),
    metadata_json: row.metadata_json || '{}',
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
  }
}

function mapExtractionTaskCommentRow(row: DbExtractionTaskCommentRow): DbExtractionTaskComment {
  return {
    id: row.id,
    task_id: row.task_id,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    content: row.content,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    user_name: row.user_name,
    user_email: row.user_email,
  }
}

function normalizeChatMessageRole(value: unknown): ChatMessageRole {
  return value === 'assistant' ? 'assistant' : 'user'
}

function mapChatConversationRow(row: DbChatConversationRow): DbChatConversation {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapChatMessageRow(row: DbChatMessageRow): DbChatMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    role: normalizeChatMessageRole(row.role),
    content: row.content,
    metadata_json: row.metadata_json || '{}',
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

async function ensureDbReady() {
  await getDbReadyPromise()
}

export async function findUserByEmail(email: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      SELECT id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
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
      SELECT id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
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
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
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

export async function updateUserName(userId: string, name: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      UPDATE users
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
    `,
    [name, userId]
  )

  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function deleteUserById(userId: string) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM users
      WHERE id = $1
    `,
    [userId]
  )

  return result.rowCount ?? 0
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
        u.email AS user_email,
        u.blocked_at AS user_blocked_at
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

export async function deleteSessionsByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId])
}

export async function deleteExpiredSessions() {
  await ensureDbReady()
  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()')
}

export async function createExtraction(input: {
  userId: string
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
}) {
  await ensureDbReady()
  const id = randomUUID()
  const sourceType = input.sourceType ?? 'youtube'
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
        metadata_json,
        source_type,
        source_label
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        share_visibility,
        created_at,
        source_type,
        source_label
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
      sourceType,
      input.sourceLabel ?? null,
    ]
  )

  return mapExtractionRow(rows[0])
}

export async function listExtractionsByUser(userId: string, limit = 30) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        ranked.id,
        ranked.user_id,
        ranked.url,
        ranked.video_id,
        ranked.video_title,
        ranked.thumbnail_url,
        ranked.extraction_mode,
        ranked.objective,
        ranked.phases_json,
        ranked.pro_tip,
        ranked.metadata_json,
        ranked.share_visibility,
        ranked.created_at,
        ranked.source_type,
        ranked.source_label,
        ranked.order_number
      FROM (
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
          share_visibility,
          created_at,
          source_type,
          source_label,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::int AS order_number
        FROM extractions
        WHERE user_id = $1
      ) AS ranked
      ORDER BY ranked.created_at DESC, ranked.id DESC
      LIMIT $2
    `,
    [userId, limit]
  )
  return rows.map(mapExtractionRow)
}

export async function findExtractionOrderNumberForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionOrderNumberRow>(
    `
      SELECT ranked.order_number
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::int AS order_number
        FROM extractions
        WHERE user_id = $1
      ) AS ranked
      WHERE ranked.id = $2
      LIMIT 1
    `,
    [input.userId, input.id]
  )

  if (!rows[0]) {
    return null
  }

  return parseDbInteger(rows[0].order_number)
}

export async function deleteExtractionByIdForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extractions
      WHERE id = $1 AND user_id = $2
    `,
    [input.id, input.userId]
  )

  return result.rowCount ?? 0
}

export async function deleteExtractionsByUser(userId: string) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extractions
      WHERE user_id = $1
    `,
    [userId]
  )

  return result.rowCount ?? 0
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
        share_visibility,
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
        share_visibility,
        created_at
      FROM extractions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [input.id, input.userId]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionShareVisibilityForUser(input: {
  id: string
  userId: string
  shareVisibility: ExtractionShareVisibility
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions
      SET share_visibility = $1
      WHERE id = $2 AND user_id = $3
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
        share_visibility,
        created_at
    `,
    [input.shareVisibility, input.id, input.userId]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionPhasesForUser(input: {
  id: string
  userId: string
  phasesJson: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions
      SET phases_json = $1
      WHERE id = $2 AND user_id = $3
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
        share_visibility,
        created_at
    `,
    [input.phasesJson, input.id, input.userId]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionMetaForUser(input: {
  id: string
  userId: string
  videoTitle: string
  sourceLabel: string
  thumbnailUrl: string | null
  objective: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `UPDATE extractions
     SET video_title = $1, source_label = $2, thumbnail_url = $3, objective = $4
     WHERE id = $5 AND user_id = $6
     RETURNING
       id, user_id, url, video_id, video_title, thumbnail_url,
       extraction_mode, objective, phases_json, pro_tip, metadata_json,
       share_visibility, created_at, source_type, source_label`,
    [input.videoTitle, input.sourceLabel, input.thumbnailUrl, input.objective, input.id, input.userId]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionFolderForUser(input: {
  id: string
  userId: string
  folderId: string | null
}): Promise<boolean> {
  await ensureDbReady()
  const { rowCount } = await pool.query(
    `UPDATE extractions SET folder_id = $1 WHERE id = $2 AND user_id = $3`,
    [input.folderId, input.id, input.userId]
  )
  return (rowCount ?? 0) > 0
}

export async function findOrCreateChatConversationForUser(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbChatConversationRow>(
    `
      INSERT INTO chat_conversations (
        id,
        user_id,
        title
      )
      VALUES ($1, $2, 'Asistente de Contenidos')
      ON CONFLICT (user_id)
      DO UPDATE SET
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        title,
        created_at,
        updated_at
    `,
    [randomUUID(), userId]
  )

  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function listChatMessagesForUser(input: { userId: string; limit?: number }) {
  await ensureDbReady()
  const limit = Number.isFinite(input.limit)
    ? Math.min(200, Math.max(1, Math.trunc(input.limit ?? 60)))
    : 60

  const conversation = await findOrCreateChatConversationForUser(input.userId)
  if (!conversation) {
    return [] as DbChatMessage[]
  }

  const { rows } = await pool.query<DbChatMessageRow>(
    `
      SELECT
        m.id,
        m.conversation_id,
        m.user_id,
        m.role,
        m.content,
        m.metadata_json,
        m.created_at,
        m.updated_at
      FROM (
        SELECT
          id,
          conversation_id,
          user_id,
          role,
          content,
          metadata_json,
          created_at,
          updated_at
        FROM chat_messages
        WHERE conversation_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      ) AS m
      ORDER BY m.created_at ASC
    `,
    [conversation.id, input.userId, limit]
  )

  return rows.map(mapChatMessageRow)
}

export async function createChatMessageForUser(input: {
  userId: string
  role: ChatMessageRole
  content: string
  metadataJson?: string
}) {
  await ensureDbReady()
  const content = input.content.trim()
  if (!content) return null

  const conversation = await findOrCreateChatConversationForUser(input.userId)
  if (!conversation) return null

  const { rows } = await pool.query<DbChatMessageRow>(
    `
      INSERT INTO chat_messages (
        id,
        conversation_id,
        user_id,
        role,
        content,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        conversation_id,
        user_id,
        role,
        content,
        metadata_json,
        created_at,
        updated_at
    `,
    [
      randomUUID(),
      conversation.id,
      input.userId,
      input.role,
      content,
      input.metadataJson ?? '{}',
    ]
  )

  await pool.query(
    `
      UPDATE chat_conversations
      SET updated_at = NOW()
      WHERE id = $1
    `,
    [conversation.id]
  )

  return rows[0] ? mapChatMessageRow(rows[0]) : null
}

export async function clearChatMessagesForUser(userId: string) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM chat_messages
      WHERE user_id = $1
    `,
    [userId]
  )

  await pool.query(
    `
      UPDATE chat_conversations
      SET updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return result.rowCount ?? 0
}

export async function syncExtractionTasksForUser(input: {
  userId: string
  extractionId: string
  phases: Array<{ id: number; title: string; items: string[] }>
}) {
  await ensureDbReady()

  const normalizedRows = input.phases.flatMap((phase) => {
    const phaseId = Number.parseInt(String(phase.id), 10)
    if (!Number.isFinite(phaseId)) return []

    return phase.items
      .map((item, index) => {
        const itemText = `${item ?? ''}`.trim()
        if (!itemText) return null

        return {
          phaseId,
          phaseTitle: `${phase.title ?? ''}`.trim() || `Fase ${phaseId}`,
          itemIndex: index,
          itemText,
        }
      })
      .filter((row): row is { phaseId: number; phaseTitle: string; itemIndex: number; itemText: string } =>
        Boolean(row)
      )
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const normalizeText = (value: string) => value.trim().toLocaleLowerCase()

    if (normalizedRows.length === 0) {
      await client.query(
        `
          DELETE FROM extraction_tasks
          WHERE extraction_id = $1 AND user_id = $2
        `,
        [input.extractionId, input.userId]
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
          checked,
          status,
          due_at,
          completed_at,
          created_at,
          updated_at
        FROM extraction_tasks
        WHERE extraction_id = $1 AND user_id = $2
        ORDER BY phase_id ASC, item_index ASC, created_at ASC
      `,
      [input.extractionId, input.userId]
    )

    const existingTasks = existingRows.rows.map(mapExtractionTaskRow)
    const availableExistingTasks = [...existingTasks]

    const takeMatchingTask = (
      predicate: (task: DbExtractionTask) => boolean
    ): DbExtractionTask | null => {
      const index = availableExistingTasks.findIndex((task) => predicate(task))
      if (index < 0) return null
      const [task] = availableExistingTasks.splice(index, 1)
      return task ?? null
    }

    const resolvedRows = normalizedRows.map((row) => {
      const normalizedItemText = normalizeText(row.itemText)
      const normalizedPhaseTitle = normalizeText(row.phaseTitle)

      let matchedTask =
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
            AND user_id = $2
            AND id = ANY($3::text[])
        `,
        [input.extractionId, input.userId, taskIdsToDelete]
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
            updated_at = NOW()
          WHERE id = $3 AND extraction_id = $4 AND user_id = $5
        `,
        [temporaryBase - index, temporaryBase - index, row.taskId, input.extractionId, input.userId]
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
              updated_at = NOW()
            WHERE id = $5 AND extraction_id = $6 AND user_id = $7
          `,
          [
            row.phaseId,
            row.phaseTitle,
            row.itemIndex,
            row.itemText,
            row.taskId,
            input.extractionId,
            input.userId,
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
              checked,
              status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 'pending')
          `,
          [
            row.taskId,
            input.extractionId,
            input.userId,
            row.phaseId,
            row.phaseTitle,
            row.itemIndex,
            row.itemText,
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
    userId: input.userId,
    extractionId: input.extractionId,
  })
}

export async function listExtractionTasksWithEventsForUser(input: { userId: string; extractionId: string }) {
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
        checked,
        status,
        due_at,
        completed_at,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE user_id = $1 AND extraction_id = $2
      ORDER BY phase_id ASC, item_index ASC
    `,
    [input.userId, input.extractionId]
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
      WHERE e.user_id = $1 AND e.task_id = ANY($2::text[])
      ORDER BY e.created_at DESC
    `,
    [input.userId, taskIds]
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
        checked,
        status,
        due_at,
        completed_at,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE extraction_id = $1
      ORDER BY phase_id ASC, item_index ASC
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

export async function findExtractionTaskByIdForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskRow>(
    `
      SELECT
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        checked,
        status,
        due_at,
        completed_at,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE id = $1 AND extraction_id = $2 AND user_id = $3
      LIMIT 1
    `,
    [input.taskId, input.extractionId, input.userId]
  )

  return rows[0] ? mapExtractionTaskRow(rows[0]) : null
}

export async function updateExtractionTaskStateForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  checked: boolean
  status: ExtractionTaskStatus
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskRow>(
    `
      UPDATE extraction_tasks
      SET
        checked = $1,
        status = $2,
        completed_at = CASE
          WHEN $2 = 'completed' THEN COALESCE(completed_at, NOW())
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = $3 AND extraction_id = $4 AND user_id = $5
      RETURNING
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        checked,
        status,
        due_at,
        completed_at,
        created_at,
        updated_at
    `,
    [input.checked, input.status, input.taskId, input.extractionId, input.userId]
  )

  return rows[0] ? mapExtractionTaskRow(rows[0]) : null
}

export async function createExtractionTaskEventForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  eventType: ExtractionTaskEventType
  content: string
  metadataJson?: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskEventRow>(
    `
      WITH target_task AS (
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2 AND user_id = $3
        LIMIT 1
      )
      INSERT INTO extraction_task_events (
        id,
        task_id,
        user_id,
        event_type,
        content,
        metadata_json
      )
      SELECT
        $4,
        target_task.id,
        $3,
        $5,
        $6,
        $7
      FROM target_task
      RETURNING
        id,
        task_id,
        user_id,
        event_type,
        content,
        metadata_json,
        created_at
    `,
    [
      input.taskId,
      input.extractionId,
      input.userId,
      randomUUID(),
      input.eventType,
      input.content,
      input.metadataJson ?? '{}',
    ]
  )

  return rows[0] ? mapExtractionTaskEventRow(rows[0]) : null
}

export async function listExtractionTaskAttachmentsForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      SELECT
        a.id,
        a.task_id,
        a.extraction_id,
        a.user_id,
        a.attachment_type,
        a.storage_provider,
        a.url,
        a.thumbnail_url,
        a.title,
        a.mime_type,
        a.size_bytes,
        a.metadata_json,
        a.created_at,
        a.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_attachments a
      INNER JOIN extraction_tasks t ON t.id = a.task_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE
        a.task_id = $1
        AND a.extraction_id = $2
        AND a.user_id = $3
        AND t.user_id = $3
      ORDER BY a.created_at DESC
    `,
    [input.taskId, input.extractionId, input.userId]
  )

  return rows.map(mapExtractionTaskAttachmentRow)
}

export async function listExtractionTaskAttachmentsForSharedExtraction(extractionId: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      SELECT
        a.id,
        a.task_id,
        a.extraction_id,
        a.user_id,
        a.attachment_type,
        a.storage_provider,
        a.url,
        a.thumbnail_url,
        a.title,
        a.mime_type,
        a.size_bytes,
        a.metadata_json,
        a.created_at,
        a.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_attachments a
      INNER JOIN extraction_tasks t ON t.id = a.task_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE
        a.extraction_id = $1
        AND t.extraction_id = $1
      ORDER BY t.phase_id ASC, t.item_index ASC, a.created_at DESC
    `,
    [extractionId]
  )

  return rows.map(mapExtractionTaskAttachmentRow)
}

export async function createExtractionTaskAttachmentForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  attachmentType: ExtractionTaskAttachmentType
  storageProvider: ExtractionTaskAttachmentStorageProvider
  url: string
  thumbnailUrl?: string | null
  title?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  metadataJson?: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      WITH target_task AS (
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2 AND user_id = $3
        LIMIT 1
      )
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
        metadata_json
      )
      SELECT
        $4,
        target_task.id,
        $2,
        $3,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      FROM target_task
      RETURNING
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
    `,
    [
      input.taskId,
      input.extractionId,
      input.userId,
      randomUUID(),
      input.attachmentType,
      input.storageProvider,
      input.url,
      input.thumbnailUrl ?? null,
      input.title ?? null,
      input.mimeType ?? null,
      input.sizeBytes ?? null,
      input.metadataJson ?? '{}',
    ]
  )

  return rows[0] ? mapExtractionTaskAttachmentRow(rows[0]) : null
}

export async function deleteExtractionTaskAttachmentByIdForUser(input: {
  attachmentId: string
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      DELETE FROM extraction_task_attachments a
      USING extraction_tasks t
      WHERE
        a.id = $1
        AND a.task_id = $2
        AND a.extraction_id = $3
        AND a.user_id = $4
        AND t.id = a.task_id
        AND t.extraction_id = $3
        AND t.user_id = $4
      RETURNING
        a.id,
        a.task_id,
        a.extraction_id,
        a.user_id,
        a.attachment_type,
        a.storage_provider,
        a.url,
        a.thumbnail_url,
        a.title,
        a.mime_type,
        a.size_bytes,
        a.metadata_json,
        a.created_at,
        a.updated_at
    `,
    [input.attachmentId, input.taskId, input.extractionId, input.userId]
  )

  return rows[0] ? mapExtractionTaskAttachmentRow(rows[0]) : null
}

export async function listExtractionTaskCommentsForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      SELECT
        c.id,
        c.task_id,
        c.extraction_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_comments c
      INNER JOIN extraction_tasks t ON t.id = c.task_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE
        c.task_id = $1
        AND c.extraction_id = $2
        AND t.extraction_id = $2
      ORDER BY c.created_at ASC
    `,
    [input.taskId, input.extractionId]
  )

  return rows.map(mapExtractionTaskCommentRow)
}

export async function createExtractionTaskCommentForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  content: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      WITH target_task AS (
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO extraction_task_comments (
          id,
          task_id,
          extraction_id,
          user_id,
          content
        )
        SELECT
          $4,
          target_task.id,
          $2,
          $3,
          $5
        FROM target_task
        RETURNING
          id,
          task_id,
          extraction_id,
          user_id,
          content,
          created_at,
          updated_at
      )
      SELECT
        i.id,
        i.task_id,
        i.extraction_id,
        i.user_id,
        i.content,
        i.created_at,
        i.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM inserted i
      INNER JOIN users u ON u.id = i.user_id
    `,
    [input.taskId, input.extractionId, input.userId, randomUUID(), input.content]
  )

  return rows[0] ? mapExtractionTaskCommentRow(rows[0]) : null
}

export async function deleteExtractionTaskCommentByIdForUser(input: {
  commentId: string
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      DELETE FROM extraction_task_comments c
      USING extraction_tasks t
      WHERE
        c.id = $1
        AND c.task_id = $2
        AND c.extraction_id = $3
        AND c.user_id = $4
        AND t.id = c.task_id
        AND t.extraction_id = $3
      RETURNING
        c.id,
        c.task_id,
        c.extraction_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        $5::text AS user_name,
        $6::text AS user_email
    `,
    [input.commentId, input.taskId, input.extractionId, input.userId, null, null]
  )

  return rows[0] ? mapExtractionTaskCommentRow(rows[0]) : null
}

export async function getExtractionTaskLikeSummaryForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbExtractionTaskLikeSummaryRow>(
    `
      SELECT
        COUNT(l.id)::int AS likes_count,
        BOOL_OR(l.user_id = $3) AS liked_by_me
      FROM extraction_tasks t
      LEFT JOIN extraction_task_likes l
        ON l.task_id = t.id
        AND l.extraction_id = t.extraction_id
      WHERE
        t.id = $1
        AND t.extraction_id = $2
    `,
    [input.taskId, input.extractionId, input.userId]
  )

  const row = rows[0]
  return {
    task_id: input.taskId,
    extraction_id: input.extractionId,
    likes_count: row ? parseDbInteger(row.likes_count) : 0,
    liked_by_me: row?.liked_by_me === true,
  } satisfies DbExtractionTaskLikeSummary
}

export async function toggleExtractionTaskLikeForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const taskOwnershipCheck = await client.query(
      `
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      `,
      [input.taskId, input.extractionId]
    )

    if (!taskOwnershipCheck.rows[0]) {
      await client.query('ROLLBACK')
      return null
    }

    const existing = await client.query(
      `
        SELECT id
        FROM extraction_task_likes
        WHERE task_id = $1 AND extraction_id = $2 AND user_id = $3
        LIMIT 1
      `,
      [input.taskId, input.extractionId, input.userId]
    )

    let likedByMe = false
    if (existing.rows[0]) {
      await client.query(
        `
          DELETE FROM extraction_task_likes
          WHERE id = $1
        `,
        [existing.rows[0].id]
      )
      likedByMe = false
    } else {
      await client.query(
        `
          INSERT INTO extraction_task_likes (
            id,
            task_id,
            extraction_id,
            user_id
          )
          VALUES ($1, $2, $3, $4)
        `,
        [randomUUID(), input.taskId, input.extractionId, input.userId]
      )
      likedByMe = true
    }

    const summaryRows = await client.query<{ likes_count: number | string }>(
      `
        SELECT COUNT(id)::int AS likes_count
        FROM extraction_task_likes
        WHERE task_id = $1 AND extraction_id = $2
      `,
      [input.taskId, input.extractionId]
    )

    await client.query('COMMIT')
    return {
      task_id: input.taskId,
      extraction_id: input.extractionId,
      likes_count: summaryRows.rows[0] ? parseDbInteger(summaryRows.rows[0].likes_count) : 0,
      liked_by_me: likedByMe,
    } satisfies DbExtractionTaskLikeSummary
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
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
        e.share_visibility,
        e.created_at
      FROM share_tokens st
      INNER JOIN extractions e ON e.id = st.extraction_id
      WHERE st.token = $1
        AND e.share_visibility = 'public'
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

export async function getExtractionRateLimitUsageByUser(input: {
  userId: string
  limit: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const { rows } = await pool.query<DbExtractionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT date_trunc('hour', NOW()) AS window_start
      )
      SELECT
        cw.window_start AS window_start,
        COALESCE(erl.request_count, 0) AS request_count
      FROM current_window cw
      LEFT JOIN extraction_rate_limits erl
        ON erl.user_id = $1
       AND erl.window_start = cw.window_start
      LIMIT 1
    `,
    [input.userId]
  )

  const row = rows[0]
  const usedRaw =
    typeof row?.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row?.request_count ?? 0), 10)
  const used = Number.isFinite(usedRaw) ? Math.max(0, usedRaw) : 0

  const windowStart = row?.window_start ? new Date(toIso(row.window_start)) : new Date()
  const resetAtMs = windowStart.getTime() + 60 * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used < input.limit,
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

function normalizeAdminUserVerificationFilter(
  value: string | null | undefined
): AdminUserVerificationFilter {
  if (value === 'verified' || value === 'unverified') return value
  return 'all'
}

function normalizeAdminUserBlockedFilter(value: string | null | undefined): AdminUserBlockedFilter {
  if (value === 'blocked' || value === 'active') return value
  return 'all'
}

export async function listAdminUsers(input?: {
  query?: string
  verification?: string
  blocked?: string
  limit?: number
  offset?: number
}): Promise<AdminUserListResult> {
  await ensureDbReady()

  const query = typeof input?.query === 'string' ? input.query.trim().slice(0, 120) : ''
  const verification = normalizeAdminUserVerificationFilter(input?.verification)
  const blocked = normalizeAdminUserBlockedFilter(input?.blocked)
  const limit = Number.isFinite(input?.limit)
    ? Math.min(200, Math.max(1, Math.trunc(input?.limit ?? 50)))
    : 50
  const offset = Number.isFinite(input?.offset)
    ? Math.max(0, Math.trunc(input?.offset ?? 0))
    : 0

  const filterParams = [query, verification, blocked]

  const countResult = await pool.query<DbCountRow>(
    `
      SELECT COUNT(*)::int AS total
      FROM users u
      WHERE
        ($1 = '' OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
        AND (
          $2 = 'all'
          OR ($2 = 'verified' AND u.email_verified_at IS NOT NULL)
          OR ($2 = 'unverified' AND u.email_verified_at IS NULL)
        )
        AND (
          $3 = 'all'
          OR ($3 = 'blocked' AND u.blocked_at IS NOT NULL)
          OR ($3 = 'active' AND u.blocked_at IS NULL)
        )
    `,
    filterParams
  )

  const usersResult = await pool.query<DbAdminUserListRow>(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.email_verified_at,
        u.blocked_at,
        COUNT(DISTINCT e.id)::int AS total_extractions,
        MAX(e.created_at) AS last_extraction_at,
        COALESCE(ai.ai_calls, 0)::int AS ai_calls,
        COALESCE(ai.ai_input_tokens, 0)::bigint AS ai_input_tokens,
        COALESCE(ai.ai_output_tokens, 0)::bigint AS ai_output_tokens,
        COALESCE(ai.ai_cost_usd, 0) AS ai_cost_usd
      FROM users u
      LEFT JOIN extractions e ON e.user_id = u.id
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*)::int AS ai_calls,
          SUM(input_tokens)::bigint AS ai_input_tokens,
          SUM(output_tokens)::bigint AS ai_output_tokens,
          SUM(cost_usd) AS ai_cost_usd
        FROM ai_usage_log
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) ai ON ai.user_id = u.id
      WHERE
        ($1 = '' OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
        AND (
          $2 = 'all'
          OR ($2 = 'verified' AND u.email_verified_at IS NOT NULL)
          OR ($2 = 'unverified' AND u.email_verified_at IS NULL)
        )
        AND (
          $3 = 'all'
          OR ($3 = 'blocked' AND u.blocked_at IS NOT NULL)
          OR ($3 = 'active' AND u.blocked_at IS NULL)
        )
      GROUP BY u.id, ai.ai_calls, ai.ai_input_tokens, ai.ai_output_tokens, ai.ai_cost_usd
      ORDER BY u.created_at DESC
      LIMIT $4
      OFFSET $5
    `,
    [...filterParams, limit, offset]
  )

  return {
    total: parseDbInteger(countResult.rows[0]?.total),
    users: usersResult.rows.map(mapAdminUserListRow),
  }
}

export async function findAdminUserById(userId: string): Promise<AdminUserListItem | null> {
  await ensureDbReady()

  const { rows } = await pool.query<DbAdminUserListRow>(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.email_verified_at,
        u.blocked_at,
        COUNT(DISTINCT e.id)::int AS total_extractions,
        MAX(e.created_at) AS last_extraction_at,
        COALESCE(ai.ai_calls, 0)::int AS ai_calls,
        COALESCE(ai.ai_input_tokens, 0)::bigint AS ai_input_tokens,
        COALESCE(ai.ai_output_tokens, 0)::bigint AS ai_output_tokens,
        COALESCE(ai.ai_cost_usd, 0) AS ai_cost_usd
      FROM users u
      LEFT JOIN extractions e ON e.user_id = u.id
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*)::int AS ai_calls,
          SUM(input_tokens)::bigint AS ai_input_tokens,
          SUM(output_tokens)::bigint AS ai_output_tokens,
          SUM(cost_usd) AS ai_cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY user_id
      ) ai ON ai.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, ai.ai_calls, ai.ai_input_tokens, ai.ai_output_tokens, ai.ai_cost_usd
      LIMIT 1
    `,
    [userId]
  )

  return rows[0] ? mapAdminUserListRow(rows[0]) : null
}

export async function updateUserBlockedState(input: { userId: string; blocked: boolean }) {
  await ensureDbReady()

  const { rows } = await pool.query<DbUserRow>(
    `
      UPDATE users
      SET
        blocked_at = CASE WHEN $2::boolean THEN COALESCE(blocked_at, NOW()) ELSE NULL END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
    `,
    [input.userId, input.blocked]
  )

  const user = rows[0] ? mapUserRow(rows[0]) : null
  if (!user) return null

  if (input.blocked) {
    await deleteSessionsByUserId(input.userId)
  }

  return user
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

  await pool.query(
    `
      UPDATE video_cache
      SET last_used_at = NOW()
      WHERE video_id = $1
    `,
    [videoId]
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
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
    `,
    [input.name, input.passwordHash, input.userId]
  )

  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function getAppSetting(key: string): Promise<string | null> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    [key]
  )
  return rows[0]?.value ?? null
}

export async function upsertAppSetting(key: string, value: string): Promise<void> {
  await getDbReadyPromise()
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
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

// ─── AI Usage Log ────────────────────────────────────────────────────────────

export interface AdminAiCostByModel {
  provider: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface AdminAiCostByDay {
  date: string
  cost_usd: number
  calls: number
}

export interface AdminAiCostStats {
  period_days: number
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_model: AdminAiCostByModel[]
  by_day: AdminAiCostByDay[]
}

interface DbAiCostByModelRow {
  provider: string
  model: string
  calls: number | string
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: string | number
}

interface DbAiCostByDayRow {
  day: Date | string
  cost_usd: string | number
  calls: number | string
}

export async function logAiUsage(input: {
  provider: string
  model: string
  useType: string
  userId?: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number
}): Promise<void> {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO ai_usage_log (id, provider, model, use_type, user_id, input_tokens, output_tokens, cost_usd)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [id, input.provider, input.model, input.useType, input.userId ?? null, input.inputTokens, input.outputTokens, input.costUsd]
  )
}

export interface AdminUserAiCostDetail {
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_model: AdminAiCostByModel[]
  by_use_type: Array<{ use_type: string; calls: number; cost_usd: number }>
}

export async function getAdminUserAiCostDetail(userId: string): Promise<AdminUserAiCostDetail> {
  await ensureDbReady()

  const [totalsResult, byModelResult, byUseTypeResult] = await Promise.all([
    pool.query<{ total_calls: number | string; total_input: number | string; total_output: number | string; total_cost: string | number }>(
      `
        SELECT
          COUNT(*)::int AS total_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output,
          COALESCE(SUM(cost_usd), 0) AS total_cost
        FROM ai_usage_log
        WHERE user_id = $1
      `,
      [userId]
    ),
    pool.query<DbAiCostByModelRow>(
      `
        SELECT
          provider,
          model,
          COUNT(*)::int AS calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY provider, model
        ORDER BY SUM(cost_usd) DESC
      `,
      [userId]
    ),
    pool.query<{ use_type: string; calls: number | string; cost_usd: string | number }>(
      `
        SELECT
          use_type,
          COUNT(*)::int AS calls,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY use_type
        ORDER BY SUM(cost_usd) DESC
      `,
      [userId]
    ),
  ])

  const totals = totalsResult.rows[0]
  return {
    total_calls: parseDbInteger(totals?.total_calls),
    total_input_tokens: Number(totals?.total_input ?? 0),
    total_output_tokens: Number(totals?.total_output ?? 0),
    total_cost_usd: Number(totals?.total_cost ?? 0),
    by_model: byModelResult.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      calls: parseDbInteger(row.calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
    })),
    by_use_type: byUseTypeResult.rows.map((row) => ({
      use_type: row.use_type,
      calls: parseDbInteger(row.calls),
      cost_usd: Number(row.cost_usd),
    })),
  }
}

export interface AdminUserMonthStat {
  month: string          // 'YYYY-MM'
  month_label: string    // 'Feb 2026'
  ai_calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  extractions: number
}

export interface AdminUserMonthlyStats {
  user_id: string
  months: AdminUserMonthStat[]
}

export async function getAdminUserMonthlyStats(userId: string): Promise<AdminUserMonthlyStats> {
  await ensureDbReady()

  const [aiResult, extractionsResult] = await Promise.all([
    pool.query<{
      month: string
      ai_calls: number | string
      input_tokens: number | string
      output_tokens: number | string
      cost_usd: string | number
    }>(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS ai_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `,
      [userId]
    ),
    pool.query<{ month: string; extractions: number | string }>(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS extractions
        FROM extractions
        WHERE user_id = $1
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `,
      [userId]
    ),
  ])

  // Merge AI stats and extractions by month
  const extractionsByMonth = new Map(
    extractionsResult.rows.map((r) => [r.month, parseDbInteger(r.extractions)])
  )

  const months: AdminUserMonthStat[] = aiResult.rows.map((row) => {
    const [year, month] = row.month.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    const month_label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    return {
      month: row.month,
      month_label: month_label.charAt(0).toUpperCase() + month_label.slice(1),
      ai_calls: parseDbInteger(row.ai_calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
      extractions: extractionsByMonth.get(row.month) ?? 0,
    }
  })

  // Add months that have extractions but no AI calls (pre-tracking)
  for (const [month, count] of Array.from(extractionsByMonth)) {
    if (!months.find((m) => m.month === month)) {
      const [year, mon] = month.split('-')
      const date = new Date(Number(year), Number(mon) - 1, 1)
      const month_label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      months.push({
        month,
        month_label: month_label.charAt(0).toUpperCase() + month_label.slice(1),
        ai_calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        extractions: count,
      })
    }
  }

  months.sort((a, b) => a.month.localeCompare(b.month))

  return { user_id: userId, months }
}

export async function getAdminAiCostStats(periodDays = 30): Promise<AdminAiCostStats> {
  await ensureDbReady()

  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30

  const [totalsResult, byModelResult, byDayResult] = await Promise.all([
    pool.query<{ total_calls: number | string; total_input: number | string; total_output: number | string; total_cost: string | number }>(
      `
        SELECT
          COUNT(*)::int AS total_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output,
          COALESCE(SUM(cost_usd), 0) AS total_cost
        FROM ai_usage_log
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [safeDays]
    ),
    pool.query<DbAiCostByModelRow>(
      `
        SELECT
          provider,
          model,
          COUNT(*)::int AS calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY provider, model
        ORDER BY SUM(cost_usd) DESC
      `,
      [safeDays]
    ),
    pool.query<DbAiCostByDayRow>(
      `
        SELECT
          date_trunc('day', created_at) AS day,
          COALESCE(SUM(cost_usd), 0) AS cost_usd,
          COUNT(*)::int AS calls
        FROM ai_usage_log
        WHERE created_at >= date_trunc('day', NOW()) - (($1::int - 1) * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [safeDays]
    ),
  ])

  const totals = totalsResult.rows[0]
  return {
    period_days: safeDays,
    total_calls: parseDbInteger(totals?.total_calls),
    total_input_tokens: Number(totals?.total_input ?? 0),
    total_output_tokens: Number(totals?.total_output ?? 0),
    total_cost_usd: Number(totals?.total_cost ?? 0),
    by_model: byModelResult.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      calls: parseDbInteger(row.calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
    })),
    by_day: byDayResult.rows.map((row) => ({
      date: toIso(row.day).slice(0, 10),
      cost_usd: Number(row.cost_usd),
      calls: parseDbInteger(row.calls),
    })),
  }
}

export async function consumeGuestExtractionRateLimit(guestId: string): Promise<{
  allowed: boolean
  used: number
}> {
  await ensureDbReady()
  const { rows } = await pool.query(
    `INSERT INTO guest_extraction_limits (guest_id, window_date, request_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (guest_id, window_date)
     DO UPDATE SET
       request_count = guest_extraction_limits.request_count + 1,
       updated_at = NOW()
     RETURNING request_count`,
    [guestId]
  )
  const used = Number(rows[0]?.request_count ?? 2)
  return { allowed: used <= 1, used }
}
