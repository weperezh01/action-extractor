import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { flattenPlaybookPhases, normalizePlaybookPhases } from '@/lib/playbook-tree'
import {
  buildSystemExtractionFolderIdForUser,
  isProtectedExtractionFolderIdForUser,
  listSystemExtractionFoldersForUser,
} from '@/lib/extraction-folders'

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

export interface DbExtractionTag {
  id: string
  name: string
  color: string
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
  is_starred: boolean
  tags: DbExtractionTag[]
}

export interface DbExtractionFolder {
  id: string
  user_id: string
  name: string
  color: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface DbExtractionMember {
  extraction_id: string
  user_id: string
  role: ExtractionMemberRole
  created_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionFolderMember {
  folder_id: string
  owner_user_id: string
  member_user_id: string
  role: ExtractionFolderMemberRole
  created_at: string
  member_name: string | null
  member_email: string | null
}

export interface DbSharedExtractionFolder {
  id: string
  user_id: string
  name: string
  color: string
  parent_id: string | null
  created_at: string
  updated_at: string
  root_folder_id: string
  owner_user_id: string
  owner_name: string | null
  owner_email: string | null
}

export interface DbCircleExtraction {
  extraction: DbExtraction
  access_role: ExtractionMemberRole
  owner_name: string | null
  owner_email: string | null
}

export interface DbSharedExtraction {
  extraction: DbExtraction
  access_role: ExtractionMemberRole
  owner_name: string | null
  owner_email: string | null
  share_source: 'direct' | 'folder'
  root_folder_id: string | null
  root_folder_name: string | null
}

export interface DbPublicExtraction {
  extraction: DbExtraction
  owner_name: string | null
  owner_email: string | null
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

export type ExtractionShareVisibility = 'private' | 'circle' | 'unlisted' | 'public'
export type ExtractionMemberRole = 'editor' | 'viewer'
export type ExtractionFolderMemberRole = 'viewer'
export type ExtractionAccessRole = 'owner' | ExtractionMemberRole

export type CommunityPostVisibility = 'private' | 'circle' | 'followers' | 'public'
export type CommunityPostReactionType = 'like'
export type CommunityPostAttachmentType = 'link' | 'image' | 'audio' | 'video' | 'file'
export type CommunityPostAttachmentStorageProvider = 'external' | 'cloudinary'

export interface DbCommunityPostAttachment {
  id: string
  attachment_type: CommunityPostAttachmentType
  storage_provider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnail_url: string | null
  title: string | null
  mime_type: string | null
  metadata_json: string
  created_at: string
  updated_at: string
}

export interface DbCommunityPost {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  content: string
  visibility: CommunityPostVisibility
  metadata_json: string
  source_extraction_id: string | null
  source_task_id: string | null
  source_label: string | null
  reactions_count: number
  comments_count: number
  views_count: number
  reacted_by_me: boolean
  following_author: boolean
  attachments: DbCommunityPostAttachment[]
  created_at: string
  updated_at: string
}

export interface DbCommunityPostComment {
  id: string
  post_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  content: string
  created_at: string
  updated_at: string
}

export interface DbCommunityPostReactionSummary {
  post_id: string
  reaction_type: CommunityPostReactionType
  reactions_count: number
  reacted_by_me: boolean
}

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
  node_id: string
  parent_node_id: string | null
  depth: number
  position_path: string
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
  parent_comment_id: string | null
  is_hidden: boolean
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
  shares_count: number
  shared_by_me: boolean
  followers_count: number
  following_by_me: boolean
  views_count: number
  viewed_by_me: boolean
}

export type ChatMessageRole = 'user' | 'assistant'

export interface DbChatConversation {
  id: string
  user_id: string
  title: string
  context_type: string
  context_id: string | null
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
  is_starred?: boolean | null
  tags_json?: string | null
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

interface DbExtractionMemberRow {
  extraction_id: string
  user_id: string
  role: string
  created_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionFolderMemberRow {
  folder_id: string
  owner_user_id: string
  member_user_id: string
  role: string
  created_at: Date | string
  member_name: string | null
  member_email: string | null
}

interface DbCircleExtractionRow extends DbExtractionRow {
  access_role: string
  owner_name: string | null
  owner_email: string | null
}

interface DbSharedExtractionRow extends DbExtractionRow {
  access_role: string
  owner_name: string | null
  owner_email: string | null
  share_source: 'direct' | 'folder'
  root_folder_id: string | null
  root_folder_name: string | null
}

interface DbPublicExtractionRow extends DbExtractionRow {
  owner_name: string | null
  owner_email: string | null
}

interface DbSharedExtractionFolderRow extends DbExtractionFolderRow {
  root_folder_id: string
  owner_user_id: string
  owner_name: string | null
  owner_email: string | null
}

interface DbExtractionAccessRow extends DbExtractionRow {
  access_role: string | null
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
  node_id: string | null
  parent_node_id: string | null
  depth: number | string | null
  position_path: string | null
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
  parent_comment_id: string | null
  is_hidden: boolean
  content: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionTaskLikeSummaryRow {
  likes_count: number | string
  liked_by_me: boolean
  shares_count: number | string
  shared_by_me: boolean
  followers_count: number | string
  following_by_me: boolean
  views_count: number | string
  viewed_by_me: boolean
}

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

interface DbChatConversationRow {
  id: string
  user_id: string
  title: string
  context_type: string
  context_id: string | null
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

interface DbCommunityActionRateLimitRow {
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

export const pool =
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

  CREATE TABLE IF NOT EXISTS community_action_rate_limits (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, action_key, window_start)
  );

  CREATE TABLE IF NOT EXISTS extraction_tasks (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phase_id INTEGER NOT NULL,
    phase_title TEXT NOT NULL,
    item_index INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    node_id TEXT NOT NULL,
    parent_node_id TEXT,
    depth INTEGER NOT NULL DEFAULT 1,
    position_path TEXT NOT NULL,
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
    parent_comment_id TEXT REFERENCES extraction_task_comments(id) ON DELETE SET NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
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

  CREATE TABLE IF NOT EXISTS extraction_task_follows (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS extraction_task_shares (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS extraction_task_views (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Asistente de Contenidos',
    context_type TEXT NOT NULL DEFAULT 'global',
    context_id TEXT,
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
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS node_id TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS parent_node_id TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS position_path TEXT;

  UPDATE extraction_tasks
  SET node_id = CONCAT('p', phase_id, '-i', item_index)
  WHERE node_id IS NULL OR BTRIM(node_id) = '';

  UPDATE extraction_tasks
  SET position_path = CONCAT(phase_id::text, '.', (item_index + 1)::text)
  WHERE position_path IS NULL OR BTRIM(position_path) = '';

  UPDATE extraction_tasks
  SET depth = 1
  WHERE depth IS NULL OR depth < 1;

  ALTER TABLE extraction_tasks ALTER COLUMN node_id SET NOT NULL;
  ALTER TABLE extraction_tasks ALTER COLUMN position_path SET NOT NULL;
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
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES extraction_task_comments(id) ON DELETE SET NULL;
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_likes ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_follows ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_follows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_shares ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_shares ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_views ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_views ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Asistente de Contenidos';
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_user_id_key;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS context_type TEXT NOT NULL DEFAULT 'global';
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS context_id TEXT;
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
  CREATE INDEX IF NOT EXISTS idx_community_action_rate_limits_window_start ON community_action_rate_limits(window_start);
  CREATE INDEX IF NOT EXISTS idx_community_action_rate_limits_action_key ON community_action_rate_limits(action_key);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_extraction_id ON extraction_tasks(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_user_id ON extraction_tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_status ON extraction_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_position_path ON extraction_tasks(extraction_id, phase_id, position_path);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_tasks_extraction_node_unique ON extraction_tasks(extraction_id, node_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_events_task_id ON extraction_task_events(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_events_created_at ON extraction_task_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_task_id ON extraction_task_attachments(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_extraction_id ON extraction_task_attachments(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_user_id ON extraction_task_attachments(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_created_at ON extraction_task_attachments(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_task_id ON extraction_task_comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_extraction_id ON extraction_task_comments(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_parent_comment_id ON extraction_task_comments(parent_comment_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_created_at ON extraction_task_comments(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_likes_task_id ON extraction_task_likes(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_likes_extraction_id ON extraction_task_likes(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_likes_task_user_unique ON extraction_task_likes(task_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_follows_task_id ON extraction_task_follows(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_follows_extraction_id ON extraction_task_follows(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_follows_task_user_unique ON extraction_task_follows(task_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_shares_task_id ON extraction_task_shares(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_shares_extraction_id ON extraction_task_shares(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_shares_task_user_unique ON extraction_task_shares(task_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_views_task_id ON extraction_task_views(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_views_extraction_id ON extraction_task_views(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_views_task_user_unique ON extraction_task_views(task_id, user_id);
  DROP INDEX IF EXISTS idx_chat_conversations_user_id;
  CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id, updated_at DESC);
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
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS extraction_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'indigo',
    parent_id TEXT REFERENCES extraction_folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_members (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, user_id),
    CONSTRAINT extraction_members_role_check CHECK (role IN ('editor', 'viewer'))
  );

  CREATE TABLE IF NOT EXISTS extraction_folder_members (
    folder_id TEXT NOT NULL REFERENCES extraction_folders(id) ON DELETE CASCADE,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (folder_id, member_user_id),
    CONSTRAINT extraction_folder_members_role_check CHECK (role IN ('viewer'))
  );

  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'indigo';
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS parent_id TEXT;
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
  ALTER TABLE extraction_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS member_user_id TEXT;
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_extraction_folders_user_id ON extraction_folders(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_folders_parent_id ON extraction_folders(parent_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_folder_id ON extractions(folder_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_user_id ON extraction_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_extraction_id ON extraction_members(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_role ON extraction_members(role);
  CREATE INDEX IF NOT EXISTS idx_extraction_folder_members_owner_user_id ON extraction_folder_members(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_folder_members_member_user_id ON extraction_folder_members(member_user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_folder_members_folder_id ON extraction_folder_members(folder_id);

  CREATE TABLE IF NOT EXISTS guest_extraction_limits (
    guest_id    TEXT    NOT NULL,
    window_date DATE    NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guest_id, window_date)
  );

  CREATE TABLE IF NOT EXISTS guest_tasks (
    id TEXT PRIMARY KEY,
    guest_id TEXT NOT NULL,
    phase_id INTEGER NOT NULL,
    phase_title TEXT NOT NULL,
    item_index INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (guest_id, phase_id, item_index)
  );

  CREATE TABLE IF NOT EXISTS guest_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS guest_task_attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    attachment_type TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'external',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    mime_type TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS guest_task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    parent_comment_id TEXT REFERENCES guest_task_comments(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS guest_task_likes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, guest_id)
  );

  ALTER TABLE guest_task_comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES guest_task_comments(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_guest_tasks_guest_id ON guest_tasks(guest_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_events_task_id ON guest_task_events(task_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_attachments_task_id ON guest_task_attachments(task_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_comments_task_id ON guest_task_comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_comments_parent_comment_id ON guest_task_comments(parent_comment_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_likes_task_id ON guest_task_likes(task_id);

  CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_posts_visibility_check CHECK (visibility IN ('private', 'circle', 'followers', 'public'))
  );

  CREATE TABLE IF NOT EXISTS community_post_sources (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    source_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS community_post_attachments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL DEFAULT 'link',
    storage_provider TEXT NOT NULL DEFAULT 'external',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    mime_type TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_post_attachments_type_check CHECK (attachment_type IN ('link', 'image', 'audio', 'video', 'file')),
    CONSTRAINT community_post_attachments_storage_check CHECK (storage_provider IN ('external', 'cloudinary'))
  );

  CREATE TABLE IF NOT EXISTS community_follows (
    follower_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_user_id, following_user_id),
    CONSTRAINT community_follows_not_self CHECK (follower_user_id <> following_user_id)
  );

  CREATE TABLE IF NOT EXISTS community_post_reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_post_reactions_type_check CHECK (reaction_type IN ('like')),
    UNIQUE (post_id, user_id, reaction_type)
  );

  CREATE TABLE IF NOT EXISTS community_post_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS community_post_views (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, user_id)
  );

  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS task_id TEXT REFERENCES extraction_tasks(id) ON DELETE CASCADE;
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS source_label TEXT;
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS attachment_type TEXT NOT NULL DEFAULT 'link';
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'external';
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS mime_type TEXT;
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_reactions ADD COLUMN IF NOT EXISTS reaction_type TEXT NOT NULL DEFAULT 'like';
  ALTER TABLE community_post_reactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_views ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_posts_visibility ON community_posts(visibility);
  CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_community_post_sources_post_id ON community_post_sources(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_sources_extraction_id ON community_post_sources(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_sources_task_id ON community_post_sources(task_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_attachments_post_id ON community_post_attachments(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_follows_follower ON community_follows(follower_user_id);
  CREATE INDEX IF NOT EXISTS idx_community_follows_following ON community_follows(following_user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_reactions_post_id ON community_post_reactions(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_reactions_user_id ON community_post_reactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_comments_post_id ON community_post_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_comments_user_id ON community_post_comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_views_post_id ON community_post_views(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_views_user_id ON community_post_views(user_id);

  -- Stripe monetization
  ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
    ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS user_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free',
    extractions_per_hour INTEGER NOT NULL DEFAULT 12,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plans_user_active
    ON user_plans(user_id) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_sub
    ON user_plans(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    raw_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);

  -- Plan catalog (admin-managed)
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    price_monthly_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    stripe_price_id TEXT,
    extractions_per_hour INTEGER NOT NULL DEFAULT 12,
    features_json TEXT NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Seed initial plans (ON CONFLICT = idempotent, won't overwrite admin edits)
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES
    ('plan_free',     'free',     'Free',     0,  NULL, 12,  '{"batch_extraction":false,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":false,"api_access":false}', true, 0),
    ('plan_pro',      'pro',      'Pro',      15, NULL, 60,  '{"batch_extraction":true,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":true,"api_access":false}',  true, 1),
    ('plan_business', 'business', 'Business', 49, NULL, 200, '{"batch_extraction":true,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":true,"api_access":true}',   true, 2)
  ON CONFLICT (id) DO NOTHING;

  -- ── Tags ───────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS extraction_tags (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT 'indigo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_extraction_tags_user ON extraction_tags(user_id);

  CREATE TABLE IF NOT EXISTS extraction_tag_assignments (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    tag_id        TEXT NOT NULL REFERENCES extraction_tags(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, tag_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON extraction_tag_assignments(tag_id);
  CREATE INDEX IF NOT EXISTS idx_tag_assignments_extraction ON extraction_tag_assignments(extraction_id);
`

const DB_INIT_SIGNATURE = '2026-03-01-tags-v1'

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
  if (value === 'public') return 'public'
  if (value === 'unlisted') return 'unlisted'
  if (value === 'circle') return 'circle'
  return 'private'
}

function normalizeCommunityPostVisibility(value: unknown): CommunityPostVisibility {
  if (value === 'private') return 'private'
  if (value === 'circle') return 'circle'
  if (value === 'followers') return 'followers'
  return 'public'
}

function normalizeExtractionMemberRole(value: unknown): ExtractionMemberRole {
  if (value === 'editor') return 'editor'
  return 'viewer'
}

function normalizeExtractionFolderMemberRole(value: unknown): ExtractionFolderMemberRole {
  return value === 'viewer' ? 'viewer' : 'viewer'
}

function normalizeExtractionAccessRole(value: unknown): ExtractionAccessRole | null {
  if (value === 'owner') return 'owner'
  if (value === 'editor') return 'editor'
  if (value === 'viewer') return 'viewer'
  return null
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
    is_starred: row.is_starred === true,
    tags: (() => {
      try {
        const parsed = row.tags_json ? JSON.parse(row.tags_json) : []
        return Array.isArray(parsed) ? (parsed as DbExtractionTag[]) : []
      } catch {
        return []
      }
    })(),
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

function mapExtractionMemberRow(row: DbExtractionMemberRow): DbExtractionMember {
  return {
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    role: normalizeExtractionMemberRole(row.role),
    created_at: toIso(row.created_at),
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
  }
}

function mapExtractionFolderMemberRow(row: DbExtractionFolderMemberRow): DbExtractionFolderMember {
  return {
    folder_id: row.folder_id,
    owner_user_id: row.owner_user_id,
    member_user_id: row.member_user_id,
    role: normalizeExtractionFolderMemberRole(row.role),
    created_at: toIso(row.created_at),
    member_name: row.member_name ?? null,
    member_email: row.member_email ?? null,
  }
}

function mapSharedExtractionFolderRow(row: DbSharedExtractionFolderRow): DbSharedExtractionFolder {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    parent_id: row.parent_id ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    root_folder_id: row.root_folder_id,
    owner_user_id: row.owner_user_id,
    owner_name: row.owner_name ?? null,
    owner_email: row.owner_email ?? null,
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

function normalizeCommunityPostAttachmentType(value: unknown): CommunityPostAttachmentType {
  if (value === 'image' || value === 'audio' || value === 'video' || value === 'file') return value
  return 'link'
}

function normalizeCommunityPostAttachmentStorageProvider(
  value: unknown
): CommunityPostAttachmentStorageProvider {
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
    parent_comment_id: row.parent_comment_id ?? null,
    is_hidden: row.is_hidden === true,
    content: row.content,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    user_name: row.user_name,
    user_email: row.user_email,
  }
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

function normalizeChatMessageRole(value: unknown): ChatMessageRole {
  return value === 'assistant' ? 'assistant' : 'user'
}

function mapChatConversationRow(row: DbChatConversationRow): DbChatConversation {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    context_type: row.context_type ?? 'global',
    context_id: row.context_id ?? null,
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

export async function ensureDbReady() {
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
  await ensureDefaultExtractionFoldersForUser(input.userId)
  const id = randomUUID()
  const sourceType = input.sourceType ?? 'youtube'
  const defaultFolderId = buildSystemExtractionFolderIdForUser({
    userId: input.userId,
    key: 'general',
  })
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
        source_label,
        folder_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        source_label,
        folder_id
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
      defaultFolderId,
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
        ranked.folder_id,
        ranked.order_number,
        ranked.is_starred,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name),
            '[]'::jsonb
          )
          FROM extraction_tag_assignments eta
          JOIN extraction_tags t ON t.id = eta.tag_id
          WHERE eta.extraction_id = ranked.id
        )::text AS tags_json
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
          folder_id,
          is_starred,
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

export async function setExtractionStarredForUser(input: {
  id: string
  userId: string
  starred: boolean
}): Promise<DbExtraction | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions
      SET is_starred = $3
      WHERE id = $1 AND user_id = $2
      RETURNING
        id, user_id, url, video_id, video_title, thumbnail_url,
        extraction_mode, objective, phases_json, pro_tip, metadata_json,
        share_visibility, created_at, source_type, source_label, folder_id, is_starred
    `,
    [input.id, input.userId, input.starred]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function assignUnfolderedExtractionsToGeneralForUser(userId: string) {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(userId)

  const generalFolderId = buildSystemExtractionFolderIdForUser({
    userId,
    key: 'general',
  })

  await pool.query(
    `
      UPDATE extractions
      SET folder_id = $2
      WHERE user_id = $1 AND folder_id IS NULL
    `,
    [userId, generalFolderId]
  )

  return generalFolderId
}

export async function listCircleExtractionsForMember(userId: string, limit = 30) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCircleExtractionRow>(
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
        m.role AS access_role,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM extraction_members m
      INNER JOIN extractions e ON e.id = m.extraction_id
      INNER JOIN users owner ON owner.id = e.user_id
      WHERE
        m.user_id = $1
        AND e.user_id <> $1
        AND e.share_visibility = 'circle'
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $2
    `,
    [userId, limit]
  )

  return rows
    .map((row) => ({
      extraction: mapExtractionRow(row),
      access_role: normalizeExtractionMemberRole(row.access_role),
      owner_name: row.owner_name ?? null,
      owner_email: row.owner_email ?? null,
    }))
    .filter((row): row is DbCircleExtraction => row.access_role === 'editor' || row.access_role === 'viewer')
}

export async function listExtractionsSharedViaFoldersForMember(userId: string, limit = 80) {
  await ensureDbReady()
  const { rows } = await pool.query<DbSharedExtractionRow>(
    `
      WITH RECURSIVE shared_roots AS (
        SELECT
          fm.folder_id AS root_folder_id,
          fm.owner_user_id
        FROM extraction_folder_members fm
        WHERE fm.member_user_id = $1
      ),
      shared_tree AS (
        SELECT
          sr.owner_user_id,
          sr.root_folder_id,
          sr.root_folder_id AS folder_id,
          0::int AS depth
        FROM shared_roots sr
        UNION ALL
        SELECT
          st.owner_user_id,
          st.root_folder_id,
          child.id AS folder_id,
          st.depth + 1
        FROM extraction_folders child
        INNER JOIN shared_tree st
          ON child.parent_id = st.folder_id
         AND child.user_id = st.owner_user_id
      ),
      visible_extractions AS (
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
          st.root_folder_id,
          st.depth
        FROM extractions e
        INNER JOIN shared_tree st
          ON e.folder_id = st.folder_id
         AND e.user_id = st.owner_user_id
        WHERE e.user_id <> $1
      ),
      dedup AS (
        SELECT DISTINCT ON (ve.id)
          ve.id,
          ve.user_id,
          ve.url,
          ve.video_id,
          ve.video_title,
          ve.thumbnail_url,
          ve.extraction_mode,
          ve.objective,
          ve.phases_json,
          ve.pro_tip,
          ve.metadata_json,
          ve.share_visibility,
          ve.created_at,
          ve.source_type,
          ve.source_label,
          ve.folder_id,
          ve.root_folder_id
        FROM visible_extractions ve
        ORDER BY ve.id, ve.depth ASC, ve.created_at DESC
      )
      SELECT
        d.id,
        d.user_id,
        d.url,
        d.video_id,
        d.video_title,
        d.thumbnail_url,
        d.extraction_mode,
        d.objective,
        d.phases_json,
        d.pro_tip,
        d.metadata_json,
        d.share_visibility,
        d.created_at,
        d.source_type,
        d.source_label,
        d.folder_id,
        'viewer'::text AS access_role,
        owner.name AS owner_name,
        owner.email AS owner_email,
        'folder'::text AS share_source,
        d.root_folder_id,
        root_folder.name AS root_folder_name
      FROM dedup d
      INNER JOIN users owner ON owner.id = d.user_id
      LEFT JOIN extraction_folders root_folder
        ON root_folder.id = d.root_folder_id
       AND root_folder.user_id = d.user_id
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT $2
    `,
    [userId, limit]
  )

  return rows
    .map((row) => ({
      extraction: mapExtractionRow(row),
      access_role: normalizeExtractionMemberRole(row.access_role),
      owner_name: row.owner_name ?? null,
      owner_email: row.owner_email ?? null,
      share_source: row.share_source,
      root_folder_id: row.root_folder_id ?? null,
      root_folder_name: row.root_folder_name ?? null,
    }))
    .filter((row): row is DbSharedExtraction => row.access_role === 'editor' || row.access_role === 'viewer')
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

export async function findPublicExtractionById(id: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbPublicExtractionRow>(
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
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM extractions e
      INNER JOIN users owner ON owner.id = e.user_id
      WHERE
        e.id = $1
        AND e.share_visibility = 'public'
        AND owner.blocked_at IS NULL
      LIMIT 1
    `,
    [id]
  )

  if (!rows[0]) return null
  return {
    extraction: mapExtractionRow(rows[0]),
    owner_name: rows[0].owner_name ?? null,
    owner_email: rows[0].owner_email ?? null,
  } satisfies DbPublicExtraction
}

export async function listPublicExtractionsForSearch(input: { query: string; limit: number }) {
  await ensureDbReady()
  const normalizedQuery = input.query.trim()
  const hasQuery = normalizedQuery.length > 0
  const likeQuery = `%${normalizedQuery}%`
  const startsWithQuery = `${normalizedQuery}%`
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(60, Math.trunc(input.limit))) : 20

  const { rows } = await pool.query<DbPublicExtractionRow>(
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
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM extractions e
      INNER JOIN users owner ON owner.id = e.user_id
      WHERE
        e.share_visibility = 'public'
        AND owner.blocked_at IS NULL
        AND (
          NOT $1
          OR COALESCE(e.video_title, '') ILIKE $2
          OR COALESCE(e.source_label, '') ILIKE $2
          OR COALESCE(e.objective, '') ILIKE $2
          OR COALESCE(e.url, '') ILIKE $2
          OR COALESCE(owner.name, '') ILIKE $2
          OR COALESCE(owner.email, '') ILIKE $2
        )
      ORDER BY
        CASE
          WHEN $1 AND COALESCE(e.video_title, '') ILIKE $3 THEN 0
          WHEN $1 AND COALESCE(e.source_label, '') ILIKE $3 THEN 1
          WHEN $1 AND COALESCE(e.objective, '') ILIKE $3 THEN 2
          ELSE 3
        END ASC,
        e.created_at DESC,
        e.id DESC
      LIMIT $4
    `,
    [hasQuery, likeQuery, startsWithQuery, limit]
  )

  return rows.map((row) => ({
    extraction: mapExtractionRow(row),
    owner_name: row.owner_name ?? null,
    owner_email: row.owner_email ?? null,
  })) satisfies DbPublicExtraction[]
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
          WHEN e.share_visibility = 'circle' THEN m.role
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

export async function listExtractionMembersForOwner(input: { extractionId: string; ownerUserId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionMemberRow>(
    `
      SELECT
        m.extraction_id,
        m.user_id,
        m.role,
        m.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_members m
      INNER JOIN extractions e
        ON e.id = m.extraction_id
      INNER JOIN users u
        ON u.id = m.user_id
      WHERE
        m.extraction_id = $1
        AND e.user_id = $2
      ORDER BY m.created_at ASC
    `,
    [input.extractionId, input.ownerUserId]
  )
  return rows.map(mapExtractionMemberRow)
}

export async function upsertExtractionMemberForOwner(input: {
  extractionId: string
  ownerUserId: string
  memberUserId: string
  role: ExtractionMemberRole
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionMemberRow>(
    `
      WITH target_extraction AS (
        SELECT id
        FROM extractions
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      ),
      upserted AS (
        INSERT INTO extraction_members (
          extraction_id,
          user_id,
          role
        )
        SELECT
          target_extraction.id,
          $3,
          $4
        FROM target_extraction
        WHERE $3 <> $2
        ON CONFLICT (extraction_id, user_id)
        DO UPDATE SET role = EXCLUDED.role
        RETURNING
          extraction_id,
          user_id,
          role,
          created_at
      )
      SELECT
        upserted.extraction_id,
        upserted.user_id,
        upserted.role,
        upserted.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM upserted
      INNER JOIN users u ON u.id = upserted.user_id
      LIMIT 1
    `,
    [input.extractionId, input.ownerUserId, input.memberUserId, input.role]
  )
  return rows[0] ? mapExtractionMemberRow(rows[0]) : null
}

export async function removeExtractionMemberForOwner(input: {
  extractionId: string
  ownerUserId: string
  memberUserId: string
}) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extraction_members m
      USING extractions e
      WHERE
        m.extraction_id = $1
        AND m.user_id = $2
        AND e.id = m.extraction_id
        AND e.user_id = $3
    `,
    [input.extractionId, input.memberUserId, input.ownerUserId]
  )
  return result.rowCount ?? 0
}

export async function listExtractionFolderMembersForOwner(input: {
  folderId: string
  ownerUserId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionFolderMemberRow>(
    `
      SELECT
        fm.folder_id,
        fm.owner_user_id,
        fm.member_user_id,
        fm.role,
        fm.created_at,
        u.name AS member_name,
        u.email AS member_email
      FROM extraction_folder_members fm
      INNER JOIN extraction_folders f
        ON f.id = fm.folder_id
       AND f.user_id = fm.owner_user_id
      INNER JOIN users u
        ON u.id = fm.member_user_id
      WHERE
        fm.folder_id = $1
        AND fm.owner_user_id = $2
      ORDER BY fm.created_at ASC
    `,
    [input.folderId, input.ownerUserId]
  )
  return rows.map(mapExtractionFolderMemberRow)
}

export async function upsertExtractionFolderMemberForOwner(input: {
  folderId: string
  ownerUserId: string
  memberUserId: string
  role: ExtractionFolderMemberRole
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionFolderMemberRow>(
    `
      WITH target_folder AS (
        SELECT id
        FROM extraction_folders
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      ),
      upserted AS (
        INSERT INTO extraction_folder_members (
          folder_id,
          owner_user_id,
          member_user_id,
          role
        )
        SELECT
          target_folder.id,
          $2,
          $3,
          $4
        FROM target_folder
        WHERE $3 <> $2
        ON CONFLICT (folder_id, member_user_id)
        DO UPDATE SET role = EXCLUDED.role
        RETURNING
          folder_id,
          owner_user_id,
          member_user_id,
          role,
          created_at
      )
      SELECT
        upserted.folder_id,
        upserted.owner_user_id,
        upserted.member_user_id,
        upserted.role,
        upserted.created_at,
        u.name AS member_name,
        u.email AS member_email
      FROM upserted
      INNER JOIN users u
        ON u.id = upserted.member_user_id
      LIMIT 1
    `,
    [input.folderId, input.ownerUserId, input.memberUserId, input.role]
  )
  return rows[0] ? mapExtractionFolderMemberRow(rows[0]) : null
}

export async function removeExtractionFolderMemberForOwner(input: {
  folderId: string
  ownerUserId: string
  memberUserId: string
}) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extraction_folder_members fm
      USING extraction_folders f
      WHERE
        fm.folder_id = $1
        AND fm.member_user_id = $2
        AND fm.owner_user_id = $3
        AND f.id = fm.folder_id
        AND f.user_id = $3
    `,
    [input.folderId, input.memberUserId, input.ownerUserId]
  )
  return result.rowCount ?? 0
}

export async function listSharedExtractionFoldersForMember(userId: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbSharedExtractionFolderRow>(
    `
      WITH RECURSIVE shared_roots AS (
        SELECT
          fm.folder_id AS root_folder_id,
          fm.owner_user_id
        FROM extraction_folder_members fm
        WHERE fm.member_user_id = $1
      ),
      shared_tree AS (
        SELECT
          sr.owner_user_id,
          sr.root_folder_id,
          f.id,
          f.user_id,
          f.name,
          f.color,
          f.parent_id,
          f.created_at,
          f.updated_at,
          0::int AS depth
        FROM shared_roots sr
        INNER JOIN extraction_folders f
          ON f.id = sr.root_folder_id
         AND f.user_id = sr.owner_user_id
        UNION ALL
        SELECT
          st.owner_user_id,
          st.root_folder_id,
          child.id,
          child.user_id,
          child.name,
          child.color,
          child.parent_id,
          child.created_at,
          child.updated_at,
          st.depth + 1
        FROM extraction_folders child
        INNER JOIN shared_tree st
          ON child.parent_id = st.id
         AND child.user_id = st.owner_user_id
      ),
      dedup AS (
        SELECT DISTINCT ON (st.owner_user_id, st.id)
          st.id,
          st.user_id,
          st.name,
          st.color,
          st.parent_id,
          st.created_at,
          st.updated_at,
          st.root_folder_id,
          st.owner_user_id
        FROM shared_tree st
        ORDER BY st.owner_user_id, st.id, st.depth ASC
      )
      SELECT
        d.id,
        d.user_id,
        d.name,
        d.color,
        d.parent_id,
        d.created_at,
        d.updated_at,
        d.root_folder_id,
        d.owner_user_id,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM dedup d
      INNER JOIN users owner
        ON owner.id = d.owner_user_id
      ORDER BY
        owner.name ASC NULLS LAST,
        owner.email ASC NULLS LAST,
        d.created_at ASC,
        d.id ASC
    `,
    [userId]
  )

  return rows.map(mapSharedExtractionFolderRow)
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
      UPDATE extractions e
      SET phases_json = $1
      WHERE
        e.id = $2
        AND (
          e.user_id = $3
          OR (
            e.share_visibility = 'circle'
            AND EXISTS (
              SELECT 1
              FROM extraction_members m
              WHERE
                m.extraction_id = e.id
                AND m.user_id = $3
                AND m.role = 'editor'
            )
          )
        )
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
        source_label,
        folder_id
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

export async function listExtractionFoldersByUser(userId: string) {
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
      WHERE user_id = $1
      ORDER BY parent_id NULLS FIRST, created_at ASC
    `,
    [userId]
  )
  return rows.map(mapExtractionFolderRow)
}

export async function ensureDefaultExtractionFoldersForUser(userId: string) {
  await ensureDbReady()

  const systemFolders = listSystemExtractionFoldersForUser(userId)
  if (systemFolders.length === 0) return [] as DbExtractionFolder[]

  const values: string[] = []
  const placeholders = systemFolders.map((folder, index) => {
    const offset = index * 4
    values.push(folder.id, userId, folder.name, folder.color)
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, NULL)`
  })

  const { rows } = await pool.query<DbExtractionFolderRow>(
    `
      INSERT INTO extraction_folders (
        id,
        user_id,
        name,
        color,
        parent_id
      )
      VALUES
        ${placeholders.join(',\n        ')}
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        name = EXCLUDED.name,
        color = EXCLUDED.color,
        parent_id = NULL,
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        name,
        color,
        parent_id,
        created_at,
        updated_at
    `,
    values
  )

  return rows.map(mapExtractionFolderRow)
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

export async function createExtractionFolderForUser(input: {
  userId: string
  name: string
  color: string
  parentId: string | null
  id?: string
}) {
  await ensureDbReady()
  const id = input.id?.trim() || randomUUID()

  const { rows } = await pool.query<DbExtractionFolderRow>(
    `
      INSERT INTO extraction_folders (
        id,
        user_id,
        name,
        color,
        parent_id
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        $5::text
      WHERE
        $5::text IS NULL
        OR EXISTS (
          SELECT 1
          FROM extraction_folders
          WHERE id = $5::text AND user_id = $2
        )
      ON CONFLICT (id) DO NOTHING
      RETURNING
        id,
        user_id,
        name,
        color,
        parent_id,
        created_at,
        updated_at
    `,
    [id, input.userId, input.name, input.color, input.parentId]
  )

  return rows[0] ? mapExtractionFolderRow(rows[0]) : null
}

export async function deleteExtractionFolderTreeForUser(input: { id: string; userId: string }) {
  await ensureDbReady()

  if (isProtectedExtractionFolderIdForUser({ userId: input.userId, id: input.id })) {
    return []
  }

  await ensureDefaultExtractionFoldersForUser(input.userId)
  const generalFolderId = buildSystemExtractionFolderIdForUser({
    userId: input.userId,
    key: 'general',
  })

  const { rows } = await pool.query<{ id: string }>(
    `
      WITH RECURSIVE folder_tree AS (
        SELECT id
        FROM extraction_folders
        WHERE id = $1 AND user_id = $2
        UNION ALL
        SELECT child.id
        FROM extraction_folders child
        INNER JOIN folder_tree ft ON child.parent_id = ft.id
        WHERE child.user_id = $2
      ),
      detached_extractions AS (
        UPDATE extractions
        SET folder_id = $3
        WHERE user_id = $2 AND folder_id IN (SELECT id FROM folder_tree)
      ),
      deleted_folders AS (
        DELETE FROM extraction_folders
        WHERE user_id = $2 AND id IN (SELECT id FROM folder_tree)
        RETURNING id
      )
      SELECT id FROM deleted_folders
    `,
    [input.id, input.userId, generalFolderId]
  )

  return rows.map((row) => row.id)
}

export async function updateExtractionFolderForUser(input: {
  id: string
  userId: string
  folderId: string | null
}): Promise<boolean> {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(input.userId)

  const targetFolderId = input.folderId ?? buildSystemExtractionFolderIdForUser({
    userId: input.userId,
    key: 'general',
  })

  const { rowCount } = await pool.query(
    `
      UPDATE extractions
      SET folder_id = $1::text
      WHERE
        id = $2
        AND user_id = $3
        AND (
          EXISTS (
            SELECT 1
            FROM extraction_folders
            WHERE id = $1::text AND user_id = $3
          )
        )
    `,
    [targetFolderId, input.id, input.userId]
  )
  return (rowCount ?? 0) > 0
}

export async function findOrCreateChatConversationForUser(userId: string) {
  await ensureDbReady()

  // Find the most recent global conversation for this user
  const { rows: existing } = await pool.query<DbChatConversationRow>(
    `
      SELECT id, user_id, title, context_type, context_id, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1 AND context_type = 'global'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [userId]
  )

  if (existing[0]) return mapChatConversationRow(existing[0])

  // Create a new global conversation if none exists
  const { rows } = await pool.query<DbChatConversationRow>(
    `
      INSERT INTO chat_conversations (id, user_id, title, context_type)
      VALUES ($1, $2, 'Asistente de Contenidos', 'global')
      RETURNING id, user_id, title, context_type, context_id, created_at, updated_at
    `,
    [randomUUID(), userId]
  )

  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function listChatConversationsForUser(userId: string, limit = 30) {
  await ensureDbReady()
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
  const { rows } = await pool.query<DbChatConversationRow>(
    `
      SELECT id, user_id, title, context_type, context_id, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  )
  return rows.map(mapChatConversationRow)
}

export async function createChatConversationForUser(input: {
  userId: string
  title?: string
  contextType?: string
  contextId?: string
}) {
  await ensureDbReady()
  const title = input.title?.trim() || 'Nueva conversación'
  const contextType = input.contextType?.trim() || 'global'
  const contextId = input.contextId?.trim() || null

  const { rows } = await pool.query<DbChatConversationRow>(
    `
      INSERT INTO chat_conversations (id, user_id, title, context_type, context_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, title, context_type, context_id, created_at, updated_at
    `,
    [randomUUID(), input.userId, title, contextType, contextId]
  )
  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function renameChatConversationForUser(input: {
  userId: string
  conversationId: string
  title: string
}) {
  await ensureDbReady()
  const title = input.title.trim()
  if (!title) return null
  const { rows } = await pool.query<DbChatConversationRow>(
    `
      UPDATE chat_conversations
      SET title = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, title, context_type, context_id, created_at, updated_at
    `,
    [input.conversationId, input.userId, title]
  )
  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function deleteChatConversationForUser(input: {
  userId: string
  conversationId: string
}) {
  await ensureDbReady()
  const result = await pool.query(
    `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`,
    [input.conversationId, input.userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function listChatMessagesForUser(input: {
  userId: string
  conversationId?: string
  limit?: number
}) {
  await ensureDbReady()
  const limit = Number.isFinite(input.limit)
    ? Math.min(200, Math.max(1, Math.trunc(input.limit ?? 60)))
    : 60

  let conversationId = input.conversationId?.trim() || ''
  if (!conversationId) {
    const conversation = await findOrCreateChatConversationForUser(input.userId)
    if (!conversation) return [] as DbChatMessage[]
    conversationId = conversation.id
  }

  const { rows } = await pool.query<DbChatMessageRow>(
    `
      SELECT m.id, m.conversation_id, m.user_id, m.role, m.content,
             m.metadata_json, m.created_at, m.updated_at
      FROM (
        SELECT id, conversation_id, user_id, role, content, metadata_json, created_at, updated_at
        FROM chat_messages
        WHERE conversation_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      ) AS m
      ORDER BY m.created_at ASC
    `,
    [conversationId, input.userId, limit]
  )

  return rows.map(mapChatMessageRow)
}

export async function createChatMessageForUser(input: {
  userId: string
  role: ChatMessageRole
  content: string
  metadataJson?: string
  conversationId?: string
}) {
  await ensureDbReady()
  const content = input.content.trim()
  if (!content) return null

  let resolvedConversationId = input.conversationId?.trim() || ''
  if (!resolvedConversationId) {
    const conversation = await findOrCreateChatConversationForUser(input.userId)
    if (!conversation) return null
    resolvedConversationId = conversation.id
  }

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
      resolvedConversationId,
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
    [resolvedConversationId]
  )

  return rows[0] ? mapChatMessageRow(rows[0]) : null
}

export async function clearChatMessagesForUser(userId: string, conversationId?: string) {
  await ensureDbReady()
  const resolvedId = conversationId?.trim() || ''

  let result
  if (resolvedId) {
    result = await pool.query(
      `DELETE FROM chat_messages WHERE user_id = $1 AND conversation_id = $2`,
      [userId, resolvedId]
    )
    await pool.query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`,
      [resolvedId]
    )
  } else {
    result = await pool.query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId])
    await pool.query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE user_id = $1`,
      [userId]
    )
  }

  return result.rowCount ?? 0
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
        due_at,
        completed_at,
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
        due_at,
        completed_at,
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

export async function findExtractionTaskByIdForUser(input: {
  taskId: string
  extractionId: string
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
        node_id,
        parent_node_id,
        depth,
        position_path,
        checked,
        status,
        due_at,
        completed_at,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE id = $1 AND extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId]
  )

  return rows[0] ? mapExtractionTaskRow(rows[0]) : null
}

export async function updateExtractionTaskStateForUser(input: {
  taskId: string
  extractionId: string
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
      WHERE id = $3 AND extraction_id = $4
      RETURNING
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
        due_at,
        completed_at,
        created_at,
        updated_at
    `,
    [input.checked, input.status, input.taskId, input.extractionId]
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
        WHERE id = $1 AND extraction_id = $2
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
        AND t.extraction_id = $2
      ORDER BY a.created_at DESC
    `,
    [input.taskId, input.extractionId]
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
      ORDER BY t.phase_id ASC, string_to_array(t.position_path, '.')::int[] ASC, t.item_index ASC, a.created_at DESC
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
        WHERE id = $1 AND extraction_id = $2
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
        AND t.id = a.task_id
        AND t.extraction_id = $3
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
    [input.attachmentId, input.taskId, input.extractionId]
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
        c.parent_comment_id,
        c.is_hidden,
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
  parentCommentId?: string | null
}) {
  await ensureDbReady()
  const parentCommentId = typeof input.parentCommentId === 'string' ? input.parentCommentId.trim() : null
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      WITH target_task AS (
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      ),
      parent_comment AS (
        SELECT c.id
        FROM extraction_task_comments c
        WHERE
          c.id = $6
          AND c.task_id = $1
          AND c.extraction_id = $2
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO extraction_task_comments (
          id,
          task_id,
          extraction_id,
          user_id,
          parent_comment_id,
          content
        )
        SELECT
          $4,
          target_task.id,
          $2,
          $3,
          parent_comment.id,
          $5
        FROM target_task
        LEFT JOIN parent_comment ON TRUE
        WHERE $6::text IS NULL OR parent_comment.id IS NOT NULL
        RETURNING
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
      SELECT
        i.id,
        i.task_id,
        i.extraction_id,
        i.user_id,
        i.parent_comment_id,
        i.is_hidden,
        i.content,
        i.created_at,
        i.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM inserted i
      INNER JOIN users u ON u.id = i.user_id
    `,
    [input.taskId, input.extractionId, input.userId, randomUUID(), input.content, parentCommentId]
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
      WITH target AS (
        SELECT
          c.id,
          c.parent_comment_id
        FROM extraction_task_comments c
        INNER JOIN extraction_tasks t ON t.id = c.task_id
        WHERE
          c.id = $1
          AND c.task_id = $2
          AND c.extraction_id = $3
          AND t.extraction_id = $3
          AND c.user_id = $4
        LIMIT 1
      ),
      reparented AS (
        UPDATE extraction_task_comments child
        SET parent_comment_id = target.parent_comment_id
        FROM target
        WHERE
          child.parent_comment_id = target.id
          AND child.task_id = $2
          AND child.extraction_id = $3
        RETURNING child.id
      ),
      deleted AS (
        DELETE FROM extraction_task_comments c
        USING target
        WHERE c.id = target.id
        RETURNING
          c.id,
          c.task_id,
          c.extraction_id,
          c.user_id,
          c.parent_comment_id,
          c.is_hidden,
          c.content,
          c.created_at,
          c.updated_at
      )
      SELECT
        d.id,
        d.task_id,
        d.extraction_id,
        d.user_id,
        d.parent_comment_id,
        d.is_hidden,
        d.content,
        d.created_at,
        d.updated_at,
        $5::text AS user_name,
        $6::text AS user_email
      FROM deleted d
    `,
    [input.commentId, input.taskId, input.extractionId, input.userId, null, null]
  )

  return rows[0] ? mapExtractionTaskCommentRow(rows[0]) : null
}

export async function setExtractionTaskCommentHiddenByOwner(input: {
  commentId: string
  taskId: string
  extractionId: string
  ownerUserId: string
  hidden: boolean
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      WITH target AS (
        SELECT c.id
        FROM extraction_task_comments c
        INNER JOIN extraction_tasks t ON t.id = c.task_id
        INNER JOIN extractions e ON e.id = t.extraction_id
        WHERE
          c.id = $1
          AND c.task_id = $2
          AND c.extraction_id = $3
          AND t.extraction_id = $3
          AND e.user_id = $4
        LIMIT 1
      ),
      updated AS (
        UPDATE extraction_task_comments c
        SET
          is_hidden = $5,
          updated_at = NOW()
        FROM target
        WHERE c.id = target.id
        RETURNING
          c.id,
          c.task_id,
          c.extraction_id,
          c.user_id,
          c.parent_comment_id,
          c.is_hidden,
          c.content,
          c.created_at,
          c.updated_at
      )
      SELECT
        u2.id,
        u2.task_id,
        u2.extraction_id,
        u2.user_id,
        u2.parent_comment_id,
        u2.is_hidden,
        u2.content,
        u2.created_at,
        u2.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM updated u2
      INNER JOIN users u ON u.id = u2.user_id
    `,
    [input.commentId, input.taskId, input.extractionId, input.ownerUserId, input.hidden]
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
        (
          SELECT COUNT(*)::int
          FROM extraction_task_likes l
          WHERE
            l.task_id = t.id
            AND l.extraction_id = t.extraction_id
        ) AS likes_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_likes l
          WHERE
            l.task_id = t.id
            AND l.extraction_id = t.extraction_id
            AND l.user_id = $3
        ) AS liked_by_me,
        (
          SELECT COUNT(*)::int
          FROM extraction_task_shares s
          WHERE
            s.task_id = t.id
            AND s.extraction_id = t.extraction_id
        ) AS shares_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_shares s
          WHERE
            s.task_id = t.id
            AND s.extraction_id = t.extraction_id
            AND s.user_id = $3
        ) AS shared_by_me,
        (
          SELECT COUNT(*)::int
          FROM extraction_task_follows f
          WHERE
            f.task_id = t.id
            AND f.extraction_id = t.extraction_id
        ) AS followers_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_follows f
          WHERE
            f.task_id = t.id
            AND f.extraction_id = t.extraction_id
            AND f.user_id = $3
        ) AS following_by_me,
        (
          SELECT COUNT(*)::int
          FROM extraction_task_views v
          WHERE
            v.task_id = t.id
            AND v.extraction_id = t.extraction_id
        ) AS views_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_views v
          WHERE
            v.task_id = t.id
            AND v.extraction_id = t.extraction_id
            AND v.user_id = $3
        ) AS viewed_by_me
      FROM extraction_tasks t
      WHERE
        t.id = $1
        AND t.extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId, input.userId]
  )

  const row = rows[0]
  return {
    task_id: input.taskId,
    extraction_id: input.extractionId,
    likes_count: row ? parseDbInteger(row.likes_count) : 0,
    liked_by_me: row?.liked_by_me === true,
    shares_count: row ? parseDbInteger(row.shares_count) : 0,
    shared_by_me: row?.shared_by_me === true,
    followers_count: row ? parseDbInteger(row.followers_count) : 0,
    following_by_me: row?.following_by_me === true,
    views_count: row ? parseDbInteger(row.views_count) : 0,
    viewed_by_me: row?.viewed_by_me === true,
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

    if (existing.rows[0]) {
      await client.query(
        `
          DELETE FROM extraction_task_likes
          WHERE id = $1
        `,
        [existing.rows[0].id]
      )
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
    }

    await client.query('COMMIT')
    return getExtractionTaskLikeSummaryForUser(input)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function toggleExtractionTaskFollowForUser(input: {
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
        FROM extraction_task_follows
        WHERE task_id = $1 AND extraction_id = $2 AND user_id = $3
        LIMIT 1
      `,
      [input.taskId, input.extractionId, input.userId]
    )

    if (existing.rows[0]) {
      await client.query(
        `
          DELETE FROM extraction_task_follows
          WHERE id = $1
        `,
        [existing.rows[0].id]
      )
    } else {
      await client.query(
        `
          INSERT INTO extraction_task_follows (
            id,
            task_id,
            extraction_id,
            user_id
          )
          VALUES ($1, $2, $3, $4)
        `,
        [randomUUID(), input.taskId, input.extractionId, input.userId]
      )
    }

    await client.query('COMMIT')
    return getExtractionTaskLikeSummaryForUser(input)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function recordExtractionTaskShareForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const taskOwnershipCheck = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM extraction_tasks
      WHERE id = $1 AND extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId]
  )

  if (!taskOwnershipCheck.rows[0]) {
    return null
  }

  await pool.query(
    `
      INSERT INTO extraction_task_shares (
        id,
        task_id,
        extraction_id,
        user_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (task_id, user_id)
      DO NOTHING
    `,
    [randomUUID(), input.taskId, input.extractionId, input.userId]
  )

  return getExtractionTaskLikeSummaryForUser(input)
}

export async function recordExtractionTaskViewForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const taskOwnershipCheck = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM extraction_tasks
      WHERE id = $1 AND extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId]
  )

  if (!taskOwnershipCheck.rows[0]) {
    return null
  }

  const { rows: insertedRows } = await pool.query<{ id: string }>(
    `
      INSERT INTO extraction_task_views (
        id,
        task_id,
        extraction_id,
        user_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (task_id, user_id)
      DO NOTHING
      RETURNING id
    `,
    [randomUUID(), input.taskId, input.extractionId, input.userId]
  )

  const summary = await getExtractionTaskLikeSummaryForUser(input)
  return {
    ...summary,
    recorded: insertedRows.length > 0,
  } satisfies DbExtractionTaskLikeSummary & { recorded: boolean }
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
        AND e.share_visibility IN ('public', 'unlisted')
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

export interface CreateCommunityPostAttachmentInput {
  attachmentType: CommunityPostAttachmentType
  storageProvider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnailUrl?: string | null
  title?: string | null
  mimeType?: string | null
  metadataJson?: string
}

export interface CreateCommunityPostInput {
  userId: string
  content: string
  visibility: CommunityPostVisibility
  metadataJson?: string
  source?: {
    extractionId?: string | null
    taskId?: string | null
    sourceLabel?: string | null
  } | null
  attachments?: CreateCommunityPostAttachmentInput[]
}

function normalizeQueryLimit(value: number | undefined, fallback = 20, max = 100) {
  if (!Number.isFinite(value)) return fallback
  const parsed = Math.trunc(value as number)
  if (parsed <= 0) return fallback
  return Math.min(parsed, max)
}

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

export interface UserAiDailyStat {
  date: string   // YYYY-MM-DD
  calls: number
  tokens: number
  costUsd: number
}

export async function getUserAiDailyUsage(userId: string, days = 30): Promise<UserAiDailyStat[]> {
  await ensureDbReady()
  const safeDays = Math.min(90, Math.max(7, Math.trunc(days)))
  const { rows } = await pool.query<{
    day: Date | string
    calls: number | string
    input_tokens: number | string
    output_tokens: number | string
    cost_usd: string | number
  }>(
    `
      SELECT
        DATE(created_at AT TIME ZONE 'UTC') AS day,
        COUNT(*)::int AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(cost_usd), 0) AS cost_usd
      FROM ai_usage_log
      WHERE user_id = $1
        AND created_at >= NOW() - ($2 * INTERVAL '1 day')
      GROUP BY day
      ORDER BY day ASC
    `,
    [userId, safeDays]
  )
  return rows.map((row) => ({
    date:
      typeof row.day === 'string'
        ? row.day.slice(0, 10)
        : row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10),
    calls: parseDbInteger(row.calls),
    tokens: Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
  }))
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

// ── Plan Catalog (admin-managed) ─────────────────────────────────────────────

export interface DbPlan {
  id: string
  name: string
  display_name: string
  price_monthly_usd: number
  stripe_price_id: string | null
  extractions_per_hour: number
  features_json: string
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

interface DbPlanRow {
  id: string
  name: string
  display_name: string
  price_monthly_usd: string | number
  stripe_price_id: string | null
  extractions_per_hour: string | number
  features_json: string
  is_active: boolean
  display_order: string | number
  created_at: Date | string
  updated_at: Date | string
}

function mapPlanRow(row: DbPlanRow): DbPlan {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    price_monthly_usd: Number(row.price_monthly_usd),
    stripe_price_id: row.stripe_price_id ?? null,
    extractions_per_hour: parseDbInteger(row.extractions_per_hour),
    features_json: row.features_json,
    is_active: Boolean(row.is_active),
    display_order: parseDbInteger(row.display_order),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

export async function listPlans(): Promise<DbPlan[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbPlanRow>(
    `SELECT id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
            features_json, is_active, display_order, created_at, updated_at
     FROM plans
     ORDER BY display_order ASC, created_at ASC`
  )
  return rows.map(mapPlanRow)
}

export async function getPlanByName(name: string): Promise<DbPlan | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbPlanRow>(
    `SELECT id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
            features_json, is_active, display_order, created_at, updated_at
     FROM plans WHERE name = $1 LIMIT 1`,
    [name]
  )
  return rows[0] ? mapPlanRow(rows[0]) : null
}

export async function createPlan(input: {
  name: string
  displayName: string
  priceMonthlyUsd: number
  stripePriceId: string | null
  extractionsPerHour: number
  featuresJson: string
  isActive: boolean
  displayOrder: number
}): Promise<DbPlan> {
  await ensureDbReady()
  const id = `plan_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const { rows } = await pool.query<DbPlanRow>(
    `INSERT INTO plans
       (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
        features_json, is_active, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
               features_json, is_active, display_order, created_at, updated_at`,
    [
      id,
      input.name.toLowerCase().trim(),
      input.displayName.trim(),
      input.priceMonthlyUsd,
      input.stripePriceId || null,
      input.extractionsPerHour,
      input.featuresJson,
      input.isActive,
      input.displayOrder,
    ]
  )
  return mapPlanRow(rows[0])
}

export async function updatePlan(
  id: string,
  input: Partial<{
    name: string
    displayName: string
    priceMonthlyUsd: number
    stripePriceId: string | null
    extractionsPerHour: number
    featuresJson: string
    isActive: boolean
    displayOrder: number
  }>
): Promise<DbPlan | null> {
  await ensureDbReady()

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (input.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(input.name.toLowerCase().trim()) }
  if (input.displayName !== undefined) { setClauses.push(`display_name = $${idx++}`); values.push(input.displayName.trim()) }
  if (input.priceMonthlyUsd !== undefined) { setClauses.push(`price_monthly_usd = $${idx++}`); values.push(input.priceMonthlyUsd) }
  if ('stripePriceId' in input) { setClauses.push(`stripe_price_id = $${idx++}`); values.push(input.stripePriceId || null) }
  if (input.extractionsPerHour !== undefined) { setClauses.push(`extractions_per_hour = $${idx++}`); values.push(input.extractionsPerHour) }
  if (input.featuresJson !== undefined) { setClauses.push(`features_json = $${idx++}`); values.push(input.featuresJson) }
  if (input.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(input.isActive) }
  if (input.displayOrder !== undefined) { setClauses.push(`display_order = $${idx++}`); values.push(input.displayOrder) }

  if (values.length === 0) return getPlanByName(id) // nothing to update

  values.push(id)
  const { rows } = await pool.query<DbPlanRow>(
    `UPDATE plans SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
               features_json, is_active, display_order, created_at, updated_at`,
    values
  )
  return rows[0] ? mapPlanRow(rows[0]) : null
}

export async function deletePlan(id: string): Promise<void> {
  await ensureDbReady()
  await pool.query(`DELETE FROM plans WHERE id = $1`, [id])
}

// ── Stripe / User Plans ─────────────────────────────────────────────────────

export interface DbUserPlan {
  id: string
  user_id: string
  plan: string
  extractions_per_hour: number
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

interface DbUserPlanRow {
  id: string
  user_id: string
  plan: string
  extractions_per_hour: number | string
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: string
  current_period_start: Date | string | null
  current_period_end: Date | string | null
  canceled_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

function mapUserPlanRow(row: DbUserPlanRow): DbUserPlan {
  return {
    id: row.id,
    user_id: row.user_id,
    plan: row.plan,
    extractions_per_hour: parseDbInteger(row.extractions_per_hour),
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    stripe_price_id: row.stripe_price_id ?? null,
    status: row.status,
    current_period_start: row.current_period_start ? toIso(row.current_period_start) : null,
    current_period_end: row.current_period_end ? toIso(row.current_period_end) : null,
    canceled_at: row.canceled_at ? toIso(row.canceled_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

export async function getUserActivePlan(userId: string): Promise<DbUserPlan | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserPlanRow>(
    `SELECT id, user_id, plan, extractions_per_hour, stripe_subscription_id, stripe_price_id,
            status, current_period_start, current_period_end, canceled_at, created_at, updated_at
     FROM user_plans
     WHERE user_id = $1 AND status = 'active'
     LIMIT 1`,
    [userId]
  )
  return rows[0] ? mapUserPlanRow(rows[0]) : null
}

export async function getUserPlanRateLimit(userId: string): Promise<number> {
  const plan = await getUserActivePlan(userId)
  if (!plan) {
    // Fall back to env-based limit (same logic as resolveExtractionRateLimitPerHour)
    const raw = process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR
    if (!raw) return 12
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 12
  }
  return plan.extractions_per_hour
}

export async function upsertUserActivePlan(input: {
  userId: string
  plan: string
  extractionsPerHour: number
  subscriptionId: string
  priceId: string
  periodStart: Date | null
  periodEnd: Date | null
}): Promise<void> {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `INSERT INTO user_plans
       (id, user_id, plan, extractions_per_hour, stripe_subscription_id, stripe_price_id,
        status, current_period_start, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW())
     ON CONFLICT (user_id) WHERE status = 'active'
     DO UPDATE SET
       plan = EXCLUDED.plan,
       extractions_per_hour = EXCLUDED.extractions_per_hour,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = NOW()`,
    [
      id,
      input.userId,
      input.plan,
      input.extractionsPerHour,
      input.subscriptionId,
      input.priceId,
      input.periodStart ? input.periodStart.toISOString() : null,
      input.periodEnd ? input.periodEnd.toISOString() : null,
    ]
  )
}

export async function deactivateUserPlan(userId: string, subscriptionId: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE user_plans
     SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND stripe_subscription_id = $2 AND status = 'active'`,
    [userId, subscriptionId]
  )
}

export async function setUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE users SET stripe_customer_id = $2, updated_at = NOW() WHERE id = $1`,
    [userId, stripeCustomerId]
  )
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<DbUser | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `SELECT id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
     FROM users
     WHERE stripe_customer_id = $1
     LIMIT 1`,
    [stripeCustomerId]
  )
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  )
  return rows[0]?.stripe_customer_id ?? null
}

export async function logStripeEvent(
  id: string,
  eventType: string,
  userId: string | null,
  rawJson: string
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO stripe_events (id, event_type, user_id, raw_json)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, eventType, userId, rawJson]
  )
}

// ── Tags ───────────────────────────────────────────────────────────────────

export async function listUserTags(userId: string): Promise<DbExtractionTag[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTag>(
    `SELECT id, name, color FROM extraction_tags WHERE user_id = $1 ORDER BY name`,
    [userId]
  )
  return rows
}

export async function createOrGetTag(
  userId: string,
  name: string,
  color: string
): Promise<DbExtractionTag> {
  await ensureDbReady()
  const id = randomUUID()
  const { rows } = await pool.query<DbExtractionTag>(
    `INSERT INTO extraction_tags (id, user_id, name, color)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
     RETURNING id, name, color`,
    [id, userId, name.trim().toLowerCase(), color]
  )
  return rows[0]
}

export async function deleteUserTag(userId: string, tagId: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `DELETE FROM extraction_tags WHERE id = $1 AND user_id = $2`,
    [tagId, userId]
  )
}

export async function assignTagToExtraction(
  extractionId: string,
  tagId: string
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO extraction_tag_assignments (extraction_id, tag_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [extractionId, tagId]
  )
}

export async function removeTagFromExtraction(
  extractionId: string,
  tagId: string
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `DELETE FROM extraction_tag_assignments WHERE extraction_id = $1 AND tag_id = $2`,
    [extractionId, tagId]
  )
}

// ── Dashboard stats ────────────────────────────────────────────────────────

export async function getUserDashboardStats(userId: string): Promise<{
  extractions: {
    total: number
    thisWeek: number
    thisMonth: number
    starred: number
    byMode: Record<string, number>
    bySourceType: Record<string, number>
  }
  tasks: { total: number; completed: number }
  savedMinutes: number
  activity: { date: string; count: number }[]
  streak: { current: number; longest: number }
}> {
  await ensureDbReady()

  const [aggRows, modeRows, sourceRows, taskRows, savedRows, activityRows] = await Promise.all([
    // Q1 — Extraction aggregates
    pool.query<{
      total: number
      this_week: number
      this_month: number
      starred: number
    }>(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS this_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS this_month,
        COUNT(*) FILTER (WHERE is_starred = true)::int AS starred
       FROM extractions WHERE user_id = $1`,
      [userId]
    ),
    // Q2 — Breakdown by mode
    pool.query<{ extraction_mode: string; cnt: number }>(
      `SELECT extraction_mode, COUNT(*)::int AS cnt
       FROM extractions WHERE user_id = $1
       GROUP BY extraction_mode`,
      [userId]
    ),
    // Q3 — Breakdown by source type
    pool.query<{ source_type: string; cnt: number }>(
      `SELECT COALESCE(source_type, 'youtube') AS source_type, COUNT(*)::int AS cnt
       FROM extractions WHERE user_id = $1
       GROUP BY COALESCE(source_type, 'youtube')`,
      [userId]
    ),
    // Q4 — Tasks
    pool.query<{ total: number; completed: number }>(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed' OR checked = true)::int AS completed
       FROM extraction_tasks WHERE user_id = $1`,
      [userId]
    ),
    // Q5 — Time saved
    pool.query<{ total_minutes: number }>(
      `SELECT COALESCE(SUM(
        COALESCE((regexp_match(metadata_json::json->>'savedTime', '(\\d+)h'))[1]::int * 60, 0) +
        COALESCE((regexp_match(metadata_json::json->>'savedTime', '(\\d+)m'))[1]::int, 0)
       ), 0)::int AS total_minutes
       FROM extractions WHERE user_id = $1`,
      [userId]
    ),
    // Q6 — Activity heatmap (last 365 days)
    pool.query<{ day: string; cnt: number }>(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
       FROM extractions
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '365 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY day`,
      [userId]
    ),
  ])

  const agg = aggRows.rows[0] ?? { total: 0, this_week: 0, this_month: 0, starred: 0 }
  const byMode: Record<string, number> = {}
  for (const row of modeRows.rows) byMode[row.extraction_mode] = Number(row.cnt)
  const bySourceType: Record<string, number> = {}
  for (const row of sourceRows.rows) bySourceType[row.source_type] = Number(row.cnt)
  const taskAgg = taskRows.rows[0] ?? { total: 0, completed: 0 }
  const savedMinutes = Number(savedRows.rows[0]?.total_minutes ?? 0)
  const activity = activityRows.rows.map((r) => ({ date: r.day, count: Number(r.cnt) }))

  // Compute streaks from activity data
  const activityMap = new Map(activity.map((a) => [a.date, a.count]))
  const today = new Date()

  // Current streak: consecutive days from today backwards
  let current = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if ((activityMap.get(dateStr) ?? 0) > 0) {
      current++
    } else {
      break
    }
  }

  // Longest streak: scan oldest-to-newest
  let longest = current
  let run = 0
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if ((activityMap.get(dateStr) ?? 0) > 0) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }

  return {
    extractions: {
      total: Number(agg.total),
      thisWeek: Number(agg.this_week),
      thisMonth: Number(agg.this_month),
      starred: Number(agg.starred),
      byMode,
      bySourceType,
    },
    tasks: { total: Number(taskAgg.total), completed: Number(taskAgg.completed) },
    savedMinutes,
    activity,
    streak: { current, longest },
  }
}

// ── Guest rate limit (existing, unchanged) ─────────────────────────────────

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
  const used = Number(rows[0]?.request_count ?? 4)
  return { allowed: used <= 3, used }
}
