# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev       # Dev server on 0.0.0.0:3030
npm run build     # Production build
npm run start     # Production server on 0.0.0.0:3030
npm run lint      # ESLint
```

## Environment Setup

Copy `.env.local.example` to `.env.local`. Required variables:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (required for extraction) |
| `ACTION_EXTRACTOR_SESSION_SECRET` | Min 16 chars; mandatory in production |
| `ACTION_EXTRACTOR_DB_*` or `ACTION_EXTRACTOR_DATABASE_URL` | PostgreSQL connection |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Password reset emails; falls back to console.log in dev |
| `NEXT_PUBLIC_APP_URL` | Public URL for email links |
| `ACTION_EXTRACTOR_ADMIN_EMAILS` | Comma-separated list of admin emails |

Optional integration vars: `NOTION_CLIENT_ID/SECRET`, `TRELLO_API_KEY`, `TODOIST_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`.

The default DB host is `postgres-db` (Docker stack hostname). For local dev, override to `localhost`.

## Architecture

**Stack**: Next.js 14 (App Router), TypeScript, TailwindCSS, PostgreSQL (`pg` pool), Anthropic SDK.

### Core Extraction Flow

The primary feature extracts actionable intelligence from YouTube videos:

1. **URL input** → extract `videoId` from YouTube URL formats (`lib/extract-core.ts:extractVideoId`)
2. **Cache check** → query `video_cache` table keyed on `(videoId, promptVersion, model)` — cache hit skips AI call and rate limiting
3. **Rate limit** → enforce per-user hourly quota via `extraction_rate_limits` table (`lib/rate-limit.ts`)
4. **Transcript fetch** → `@danielxceron/youtube-transcript` with automatic retry/backoff (`lib/extract-resilience.ts`)
5. **AI analysis** → Send to `claude-sonnet-4-6` with mode-specific system + user prompts (`lib/extract-core.ts`)
6. **JSON parsing** → Multi-attempt parse with two-stage fallback repair (re-calls Claude to fix malformed JSON)
7. **Persist** → `upsertVideoCache` + `createExtraction` (tied to authenticated user)

Two API endpoints exist for extraction:
- `POST /api/extract` — standard JSON response
- `POST /api/extract/stream` — SSE streaming with progress events (`status`, `text`, `result`, `error`, `done`)

### Extraction Modes (`lib/extraction-modes.ts`)

Four modes, each with its own system prompt and user prompt in `lib/extract-core.ts`:
- `action_plan` — Phased action plan (default)
- `executive_summary` — Executive briefing
- `business_ideas` — Market opportunities with MVP/metrics
- `key_quotes` — Key quotes with practical context

All modes return `{ objective, phases[{id, title, items[]}], proTip, metadata{readingTime, difficulty} }`.

The `promptVersion` (used for cache keying) is `multi-mode-v3:{mode}:{outputLanguage}`. Bumping `EXTRACTION_PROMPT_VERSION` in `lib/extract-core.ts` invalidates all cache entries.

### Output Language (`lib/output-language.ts`)

Three options: `auto` (default), `es`, `en`. In `auto` mode, language is detected from the transcript using word-frequency heuristics. The resolved language is passed into system/user prompts to enforce Claude's response language.

### Database (`lib/db.ts`)

Schema is auto-created/migrated on first connection using `INIT_SQL` (idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`). No migration tool — schema changes go directly into `INIT_SQL`.

Key tables:
- `users` / `sessions` — authentication
- `extractions` — per-user extraction history
- `video_cache` — shared AI result cache by `(video_id, prompt_version, model)`
- `extraction_rate_limits` — hourly sliding window per user
- `share_tokens` — one-to-one with extractions for public sharing
- `*_connections` — OAuth tokens for Notion, Trello, Todoist, Google Docs

### Authentication (`lib/auth.ts`)

Custom session auth using `ae_session` cookie (HttpOnly, Secure in prod). Passwords hashed with `scrypt` (salt:hash format). Session tokens are HMAC-SHA256 signed with `ACTION_EXTRACTOR_SESSION_SECRET` before storage. Admin access is email-allowlist based via `ACTION_EXTRACTOR_ADMIN_EMAILS` env var.

### API Routes

| Route | Purpose |
|---|---|
| `POST /api/auth/register` | Register with email verification |
| `POST /api/auth/login` | Login → set session cookie |
| `POST /api/auth/forgot-password` | Send reset email via Resend |
| `GET /api/extract` | Main extraction (JSON) |
| `POST /api/extract/stream` | Streaming extraction (SSE) |
| `GET /api/history` | User's past extractions |
| `GET/POST /api/share` | Create/resolve share tokens |
| `GET/POST /api/notion` | Notion OAuth + export |
| `GET/POST /api/trello` | Trello OAuth + export |
| `GET/POST /api/todoist` | Todoist OAuth + export |
| `GET/POST /api/google-docs` | Google Docs OAuth + export |
| `GET /api/admin` | Admin stats (guarded by admin email check) |

### Export Libraries

`lib/export-content.ts` and `lib/export-parsers.ts` handle formatting extraction results for export to third-party tools (Notion pages, Trello cards, Todoist tasks, Google Docs). Integration clients are in `lib/notion.ts`, `lib/trello.ts`, `lib/todoist.ts`, `lib/google-docs.ts`.

### Resilience (`lib/extract-resilience.ts`)

`retryWithBackoff()` wraps any async operation with exponential backoff. `classifyTranscriptError()` and `classifyModelError()` convert raw errors into user-facing messages with HTTP status codes and `retryable` flags.

## Docker

Multi-stage Dockerfile builds to production image. The app runs on port 3030 inside the container. In the larger `docker-stack`, it connects to the shared `postgres-db` service.
