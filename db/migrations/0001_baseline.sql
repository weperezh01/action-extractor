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
    parent_extraction_id TEXT REFERENCES extractions(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    video_id TEXT,
    video_title TEXT,
    thumbnail_url TEXT,
    extraction_mode TEXT NOT NULL DEFAULT 'action_plan',
    objective TEXT NOT NULL,
    phases_json TEXT NOT NULL,
    pro_tip TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    clone_permission TEXT NOT NULL DEFAULT 'disabled',
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
    numeric_value DOUBLE PRECISION,
    numeric_formula_json TEXT NOT NULL DEFAULT '{}',
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
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS numeric_value DOUBLE PRECISION;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS numeric_formula_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS node_id TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS parent_node_id TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS position_path TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 1;

  CREATE TABLE IF NOT EXISTS extraction_task_dependencies (
    extraction_id       TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    task_id             TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    predecessor_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, predecessor_task_id)
  );
  CREATE INDEX IF NOT EXISTS idx_etd_extraction  ON extraction_task_dependencies(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_etd_task        ON extraction_task_dependencies(task_id);
  CREATE INDEX IF NOT EXISTS idx_etd_predecessor ON extraction_task_dependencies(predecessor_task_id);

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
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS clone_permission TEXT NOT NULL DEFAULT 'disabled';
  ALTER TABLE extractions DROP CONSTRAINT IF EXISTS extractions_clone_permission_check;
  ALTER TABLE extractions ADD CONSTRAINT extractions_clone_permission_check CHECK (clone_permission IN ('disabled', 'template_only', 'full'));
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
    extraction_id TEXT,
    source_type TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
    pricing_version TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS extraction_id TEXT;
  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS source_type TEXT;
  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS pricing_version TEXT NOT NULL DEFAULT '';

  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider_model ON ai_usage_log(provider, model);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_extraction_id ON ai_usage_log(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_use_type ON ai_usage_log(use_type);

  ALTER TABLE extractions ALTER COLUMN url DROP NOT NULL;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS parent_extraction_id TEXT REFERENCES extractions(id) ON DELETE SET NULL;
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

  CREATE TABLE IF NOT EXISTS extraction_additional_sources (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL DEFAULT 'web_url',
    source_label TEXT,
    url TEXT,
    source_text TEXT,
    source_file_url TEXT,
    source_file_name TEXT,
    source_file_size_bytes BIGINT,
    source_file_mime_type TEXT,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT extraction_additional_sources_type_check CHECK (source_type IN ('youtube', 'web_url', 'pdf', 'docx', 'text')),
    CONSTRAINT extraction_additional_sources_analysis_status_check CHECK (analysis_status IN ('pending', 'analyzed'))
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
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'web_url';
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_label TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS url TEXT;
  ALTER TABLE extraction_additional_sources ALTER COLUMN url DROP NOT NULL;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_text TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_url TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_name TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_size_bytes BIGINT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_mime_type TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'pending';
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_additional_sources DROP CONSTRAINT IF EXISTS extraction_additional_sources_type_check;
  ALTER TABLE extraction_additional_sources ADD CONSTRAINT extraction_additional_sources_type_check CHECK (source_type IN ('youtube', 'web_url', 'pdf', 'docx', 'text'));
  ALTER TABLE extraction_additional_sources DROP CONSTRAINT IF EXISTS extraction_additional_sources_analysis_status_check;
  ALTER TABLE extraction_additional_sources ADD CONSTRAINT extraction_additional_sources_analysis_status_check CHECK (analysis_status IN ('pending', 'analyzed'));
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS member_user_id TEXT;
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_extraction_folders_user_id ON extraction_folders(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_folders_parent_id ON extraction_folders(parent_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_folder_id ON extractions(folder_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_parent_extraction_id ON extractions(parent_extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_user_id ON extraction_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_extraction_id ON extraction_members(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_role ON extraction_members(role);
  CREATE INDEX IF NOT EXISTS idx_extraction_additional_sources_extraction_id ON extraction_additional_sources(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_additional_sources_created_by_user_id ON extraction_additional_sources(created_by_user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_additional_sources_analysis_status ON extraction_additional_sources(analysis_status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_additional_sources_unique_url ON extraction_additional_sources(extraction_id, url);
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

  CREATE TABLE IF NOT EXISTS login_rate_limits (
    key          TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, window_start)
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
    numeric_value DOUBLE PRECISION,
    numeric_formula_json TEXT NOT NULL DEFAULT '{}',
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
  ALTER TABLE guest_tasks ADD COLUMN IF NOT EXISTS numeric_value DOUBLE PRECISION;
  ALTER TABLE guest_tasks ADD COLUMN IF NOT EXISTS numeric_formula_json TEXT NOT NULL DEFAULT '{}';
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
    processing BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    raw_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS processing BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
  ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS last_error TEXT;
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

  -- Seed initial plans — use ON CONFLICT (name) DO NOTHING to safely handle duplicate names
  -- (name is the business key; the id may differ if a plan was created manually)
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_free', 'free', 'Free', 0, NULL, 12, '{"batch_extraction":false,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":false,"api_access":false}', true, 0)
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_starter', 'starter', 'Starter', 9, NULL, 30, '{"batch_extraction":false,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":false,"api_access":false}', true, 1)
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_pro', 'pro', 'Pro', 15, NULL, 60, '{"batch_extraction":true,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":true,"api_access":false}', true, 2)
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_business', 'business', 'Business', 49, NULL, 200, '{"batch_extraction":true,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":true,"api_access":true}', true, 3)
  ON CONFLICT (name) DO NOTHING;

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

  CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_task_status_change BOOLEAN NOT NULL DEFAULT TRUE,
    notify_new_comment BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── Workspaces ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    avatar_color TEXT NOT NULL DEFAULT 'indigo',
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id),
    CONSTRAINT workspace_members_role_check CHECK (role IN ('owner','admin','member','viewer'))
  );

  CREATE TABLE IF NOT EXISTS workspace_invitations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE (workspace_id, email),
    CONSTRAINT workspace_invitations_role_check CHECK (role IN ('admin','member','viewer')),
    CONSTRAINT workspace_invitations_status_check CHECK (status IN ('pending','accepted','declined','expired'))
  );

  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;

  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_text TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_url TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_name TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_size_bytes INTEGER;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_mime_type TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS transcript_source TEXT;

  CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
  CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
  CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
  CREATE INDEX IF NOT EXISTS idx_extractions_workspace_id ON extractions(workspace_id);

  -- ── Daily extraction counts (replaces hourly sliding window) ──────────────
  CREATE TABLE IF NOT EXISTS daily_extraction_counts (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_extraction_counts_user ON daily_extraction_counts(user_id);
  CREATE INDEX IF NOT EXISTS idx_daily_extraction_counts_date ON daily_extraction_counts(date);

  -- ── Credit transactions ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'purchase',
    stripe_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_stripe_session_id
    ON credit_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

  -- ── Schema migrations for daily limits ───────────────────────────────────
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS extractions_per_day INT NOT NULL DEFAULT 3;
  ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS extra_credits INT NOT NULL DEFAULT 0;

  -- Update existing plan rows with correct daily limits (idempotent)
  UPDATE plans SET extractions_per_day = 3   WHERE name = 'free';
  UPDATE plans SET extractions_per_day = 15  WHERE name = 'starter';
  UPDATE plans SET extractions_per_day = 40  WHERE name = 'pro';
  UPDATE plans SET extractions_per_day = 150 WHERE name = 'business';

  -- ── Prompt templates (admin-editable overrides) ───────────────────────────
  CREATE TABLE IF NOT EXISTS prompt_templates (
    prompt_key TEXT PRIMARY KEY,
    content    TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
  );

  -- ── Chat token daily limits ────────────────────────────────────────────────
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS chat_tokens_per_day INT NOT NULL DEFAULT 10000;
  UPDATE plans SET chat_tokens_per_day = 10000  WHERE name = 'free';
  UPDATE plans SET chat_tokens_per_day = 30000  WHERE name = 'starter';
  UPDATE plans SET chat_tokens_per_day = 100000 WHERE name = 'pro';
  UPDATE plans SET chat_tokens_per_day = 500000 WHERE name = 'business';

  CREATE TABLE IF NOT EXISTS daily_chat_token_counts (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       DATE NOT NULL DEFAULT CURRENT_DATE,
    tokens_used INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_chat_tokens_user ON daily_chat_token_counts(user_id);
  CREATE INDEX IF NOT EXISTS idx_daily_chat_tokens_date ON daily_chat_token_counts(date);

  -- ── Flowchart / Process Graph ─────────────────────────────────────────────
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS flow_node_type TEXT NOT NULL DEFAULT 'process';

  CREATE TABLE IF NOT EXISTS extraction_task_edges (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    from_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    to_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL DEFAULT 'and',
    label TEXT,
    expected_extra_days DOUBLE PRECISION,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (extraction_id, from_task_id, to_task_id, edge_type),
    CONSTRAINT extraction_task_edges_type_check CHECK (edge_type IN ('and', 'xor', 'loop'))
  );
  CREATE INDEX IF NOT EXISTS idx_ete_extraction ON extraction_task_edges(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_ete_from_task ON extraction_task_edges(from_task_id);
  CREATE INDEX IF NOT EXISTS idx_ete_to_task ON extraction_task_edges(to_task_id);

  CREATE TABLE IF NOT EXISTS extraction_task_decision_selection (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    decision_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    selected_to_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, decision_task_id)
  );
  CREATE INDEX IF NOT EXISTS idx_etds_extraction ON extraction_task_decision_selection(extraction_id);

  CREATE TABLE IF NOT EXISTS extraction_presentations (
    extraction_id TEXT PRIMARY KEY REFERENCES extractions(id) ON DELETE CASCADE,
    deck_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS extraction_presentation_states (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_slide_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, user_id)
  );

  -- ── Flowchart custom node positions ─────────────────────────────
  CREATE TABLE IF NOT EXISTS flow_node_positions (
    task_id        TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id  TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    cx             DOUBLE PRECISION NOT NULL,
    cy             DOUBLE PRECISION NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, extraction_id)
  );
  CREATE INDEX IF NOT EXISTS idx_fnp_extraction ON flow_node_positions(extraction_id);

  -- ── Per-user storage tracking ─────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS user_storage (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── Storage limit per plan + per-user admin override ──────────────────────
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 104857600;
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS target_gross_margin_pct NUMERIC(5,4) NOT NULL DEFAULT 0.75;
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS profitability_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS estimated_monthly_fixed_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0;
  -- Seed correct limits for built-in plans only if still at the default (idempotent, respects admin edits)
  UPDATE plans SET storage_limit_bytes = 104857600   WHERE name = 'free'     AND storage_limit_bytes = 104857600;
  UPDATE plans SET storage_limit_bytes = 524288000   WHERE name = 'starter'  AND storage_limit_bytes = 104857600;
  UPDATE plans SET storage_limit_bytes = 2147483648  WHERE name = 'pro'      AND storage_limit_bytes = 104857600;
  UPDATE plans SET storage_limit_bytes = 10737418240 WHERE name = 'business' AND storage_limit_bytes = 104857600;
  UPDATE plans SET target_gross_margin_pct = 0.00 WHERE name = 'free';
  UPDATE plans SET target_gross_margin_pct = 0.70 WHERE name = 'starter';
  UPDATE plans SET target_gross_margin_pct = 0.75 WHERE name = 'pro';
  UPDATE plans SET target_gross_margin_pct = 0.80 WHERE name = 'business';
  UPDATE plans SET profitability_alert_enabled = TRUE WHERE profitability_alert_enabled IS DISTINCT FROM TRUE;
  ALTER TABLE user_storage ADD COLUMN IF NOT EXISTS storage_limit_override_bytes BIGINT;
