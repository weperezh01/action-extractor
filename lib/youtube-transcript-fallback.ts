import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptEmptyError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  type TranscriptResponse,
} from '@danielxceron/youtube-transcript'
import OpenAI, { toFile } from 'openai'
import { AI_PRICING_VERSION, estimateTranscriptionCostUsd } from '@/lib/ai-client'

const execFileAsync = promisify(execFile)

const WATCH_PAGE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
const WATCH_PAGE_ACCEPT_LANGUAGE = 'en-US,en;q=0.9'

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
const RE_XML_TRANSCRIPT_ASR = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
const RE_XML_TRANSCRIPT_ASR_SEGMENT = /<s[^>]*>([^<]*)<\/s>/g

type CaptionTrack = {
  baseUrl: string
  languageCode: string
  kind: 'asr' | 'manual'
}

type MediaCandidate = {
  url: string
  mimeType: string
  contentLength: number | null
}

type WatchPageData = {
  captionTracks: CaptionTrack[]
  mediaCandidates: MediaCandidate[]
}

const DEFAULT_STT_MODEL = process.env.YOUTUBE_AUDIO_STT_MODEL?.trim() || 'gpt-4o-mini-transcribe'
const DEFAULT_STT_MAX_BYTES = Number.parseInt(process.env.YOUTUBE_AUDIO_STT_MAX_BYTES ?? '', 10) || 95 * 1024 * 1024
const DEFAULT_STT_TIMEOUT_MS = Number.parseInt(process.env.YOUTUBE_AUDIO_STT_TIMEOUT_MS ?? '', 10) || 180_000
const DEFAULT_YTDLP_BIN = process.env.YOUTUBE_YTDLP_BIN?.trim() || 'yt-dlp'
const DEFAULT_YTDLP_TIMEOUT_MS = Number.parseInt(process.env.YOUTUBE_YTDLP_TIMEOUT_MS ?? '', 10) || 120_000
const DEFAULT_YTDLP_MAX_SUBTITLE_BYTES =
  Number.parseInt(process.env.YOUTUBE_YTDLP_MAX_SUBTITLE_BYTES ?? '', 10) || 12 * 1024 * 1024
const YTDLP_SUBTITLE_EXT_PRIORITY = ['json3', 'srv3', 'vtt', 'ttml', 'srt'] as const

type YtDlpSubtitleExt = (typeof YTDLP_SUBTITLE_EXT_PRIORITY)[number]

type YtDlpTranscriptResult = {
  segments: TranscriptResponse[] | null
  attempted: boolean
  reason: string | null
}

export type YoutubeTranscriptResolvedSource =
  | 'youtube_transcript'
  | 'watch_page_caption_track'
  | 'yt_dlp_subtitles'
  | 'openai_audio_transcription'
  | 'youtube_official_api'

export interface YoutubeTranscriptUsageEvent {
  provider: 'openai'
  model: string
  useType: 'transcription'
  costUsd: number
  durationSeconds: number
  pricingVersion: string
}

export interface YoutubeTranscriptResolution {
  segments: TranscriptResponse[]
  source: YoutubeTranscriptResolvedSource
  usageEvents: YoutubeTranscriptUsageEvent[]
}

export class YoutubeTranscriptTemporarilyUnavailableError extends Error {
  readonly videoId: string
  readonly availableLanguages: string[]
  readonly audioFallbackAttempted: boolean
  readonly audioFallbackReason: string | null

  constructor(
    videoId: string,
    availableLanguages: string[],
    options?: { audioFallbackAttempted?: boolean; audioFallbackReason?: string | null }
  ) {
    super(
      `[YoutubeTranscript] 🚨 Captions exist for this video but YouTube returned an empty transcript payload (${videoId}).`
    )
    this.name = 'YoutubeTranscriptTemporarilyUnavailableError'
    this.videoId = videoId
    this.availableLanguages = availableLanguages
    this.audioFallbackAttempted = options?.audioFallbackAttempted ?? false
    this.audioFallbackReason = options?.audioFallbackReason ?? null
  }
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

function parseXmlTranscript(body: string, lang: string): TranscriptResponse[] {
  RE_XML_TRANSCRIPT.lastIndex = 0
  const transcriptSegments: TranscriptResponse[] = []
  let transcriptMatch: RegExpExecArray | null = RE_XML_TRANSCRIPT.exec(body)
  while (transcriptMatch) {
    const text = decodeHtmlEntities(transcriptMatch[3] ?? '').trim()
    if (text) {
      transcriptSegments.push({
        text,
        duration: Number.parseFloat(transcriptMatch[2] ?? '0'),
        offset: Number.parseFloat(transcriptMatch[1] ?? '0'),
        lang,
      })
    }
    transcriptMatch = RE_XML_TRANSCRIPT.exec(body)
  }

  if (transcriptSegments.length > 0) {
    return transcriptSegments
  }

  RE_XML_TRANSCRIPT_ASR.lastIndex = 0
  const asrSegments: TranscriptResponse[] = []
  let asrMatch: RegExpExecArray | null = RE_XML_TRANSCRIPT_ASR.exec(body)
  while (asrMatch) {
    const blockBody = asrMatch[3] ?? ''
    const partTexts: string[] = []

    RE_XML_TRANSCRIPT_ASR_SEGMENT.lastIndex = 0
    let segmentMatch: RegExpExecArray | null = RE_XML_TRANSCRIPT_ASR_SEGMENT.exec(blockBody)
    while (segmentMatch) {
      partTexts.push(segmentMatch[1] ?? '')
      segmentMatch = RE_XML_TRANSCRIPT_ASR_SEGMENT.exec(blockBody)
    }

    const text = (partTexts.length > 0 ? partTexts.join('') : blockBody.replace(/<[^>]*>/g, '')).trim()
    if (text) {
      asrSegments.push({
        text: decodeHtmlEntities(text),
        duration: Number(asrMatch[2] ?? '0') / 1000,
        offset: Number(asrMatch[1] ?? '0') / 1000,
        lang,
      })
    }

    asrMatch = RE_XML_TRANSCRIPT_ASR.exec(body)
  }

  return asrSegments
}

function parseJsonTranscript(body: string, lang: string): TranscriptResponse[] {
  try {
    const parsed = JSON.parse(body) as {
      events?: Array<{
        tStartMs?: number
        dDurationMs?: number
        segs?: Array<{ utf8?: string }>
      }>
    }

    if (!Array.isArray(parsed.events)) {
      return []
    }

    const segments: TranscriptResponse[] = []
    for (const event of parsed.events) {
      const text = (event.segs ?? [])
        .map((segment) => segment.utf8 ?? '')
        .join('')
        .replace(/\n+/g, ' ')
        .trim()

      if (!text) {
        continue
      }

      segments.push({
        text: decodeHtmlEntities(text),
        duration: Number(event.dDurationMs ?? 0) / 1000,
        offset: Number(event.tStartMs ?? 0) / 1000,
        lang,
      })
    }

    return segments
  } catch {
    return []
  }
}

function decodeTimestampToSeconds(value: string) {
  const normalized = value.trim().replace(',', '.')
  const parts = normalized.split(':').map((part) => Number.parseFloat(part))
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
  }
  if (parts.length === 2) {
    return parts[0]! * 60 + parts[1]!
  }
  if (parts.length === 1) {
    return parts[0]!
  }
  return null
}

function parseTimedTextTranscript(
  body: string,
  lang: string,
  separatorPattern: RegExp
): TranscriptResponse[] {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const segments: TranscriptResponse[] = []

  let index = 0
  while (index < lines.length) {
    const rawLine = lines[index]?.trim() ?? ''
    if (!rawLine || /^\d+$/.test(rawLine)) {
      index += 1
      continue
    }

    const timingMatch = rawLine.match(separatorPattern)
    if (!timingMatch) {
      index += 1
      continue
    }

    const startSeconds = decodeTimestampToSeconds(timingMatch[1] ?? '')
    const endSeconds = decodeTimestampToSeconds(timingMatch[2] ?? '')
    index += 1

    const textLines: string[] = []
    while (index < lines.length) {
      const textLine = lines[index] ?? ''
      if (!textLine.trim()) break
      if (/^\d+$/.test(textLine.trim()) && textLines.length === 0) break
      textLines.push(textLine)
      index += 1
    }

    const text = decodeHtmlEntities(
      textLines
        .join(' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )

    if (text && startSeconds !== null && endSeconds !== null && endSeconds >= startSeconds) {
      segments.push({
        text,
        duration: endSeconds - startSeconds,
        offset: startSeconds,
        lang,
      })
    }

    while (index < lines.length && !lines[index]?.trim()) {
      index += 1
    }
  }

  return segments
}

function parseVttTranscript(body: string, lang: string): TranscriptResponse[] {
  return parseTimedTextTranscript(body, lang, /([\d:.,]+)\s+-->\s+([\d:.,]+)/)
}

function parseSrtTranscript(body: string, lang: string): TranscriptResponse[] {
  return parseTimedTextTranscript(body, lang, /([\d:.,]+)\s+-->\s+([\d:.,]+)/)
}

function parseTranscriptBody(body: string, lang: string): TranscriptResponse[] {
  const trimmed = body.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{')) {
    return parseJsonTranscript(body, lang)
  }
  if (trimmed.startsWith('WEBVTT') || trimmed.includes('-->')) {
    const vttSegments = parseVttTranscript(body, lang)
    if (vttSegments.length > 0) {
      return vttSegments
    }
    return parseSrtTranscript(body, lang)
  }
  return parseXmlTranscript(body, lang)
}

function extractInitialPlayerResponse(html: string) {
  const marker = 'var ytInitialPlayerResponse = '
  const markerIndex = html.indexOf(marker)
  if (markerIndex === -1) return null

  let index = markerIndex + marker.length
  while (index < html.length && html[index] !== '{') {
    index += 1
  }
  if (index >= html.length) return null

  let depth = 0
  let inString = false
  let escaped = false
  let endIndex = -1

  for (let i = index; i < html.length; i += 1) {
    const char = html[i]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        endIndex = i + 1
        break
      }
    }
  }

  if (endIndex === -1) return null
  try {
    return JSON.parse(html.slice(index, endIndex)) as {
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<{
            baseUrl?: string
            languageCode?: string
            kind?: string
          }>
        }
      }
      streamingData?: {
        formats?: Array<{
          url?: string
          mimeType?: string
          contentLength?: string
        }>
        adaptiveFormats?: Array<{
          url?: string
          mimeType?: string
          contentLength?: string
        }>
      }
    }
  } catch {
    return null
  }
}

function buildMediaCandidatesFromPlayerResponse(playerResponse: {
  streamingData?: {
    formats?: Array<{ url?: string; mimeType?: string; contentLength?: string }>
    adaptiveFormats?: Array<{ url?: string; mimeType?: string; contentLength?: string }>
  }
}): MediaCandidate[] {
  const allFormats = [
    ...(playerResponse.streamingData?.formats ?? []),
    ...(playerResponse.streamingData?.adaptiveFormats ?? []),
  ]

  const mediaCandidates = allFormats
    .map((format): MediaCandidate | null => {
      const url = typeof format.url === 'string' ? format.url : ''
      const mimeType = typeof format.mimeType === 'string' ? format.mimeType : ''
      if (!url || !mimeType) return null

      const mimeLower = mimeType.toLowerCase()
      const includesAudioCodec =
        mimeLower.startsWith('audio/') ||
        mimeLower.includes('codecs=') && (mimeLower.includes('mp4a') || mimeLower.includes('opus') || mimeLower.includes('vorbis'))
      if (!includesAudioCodec) return null

      const parsedContentLength = Number.parseInt(format.contentLength ?? '', 10)
      return {
        url,
        mimeType,
        contentLength: Number.isFinite(parsedContentLength) && parsedContentLength > 0 ? parsedContentLength : null,
      }
    })
    .filter((candidate): candidate is MediaCandidate => candidate !== null)

  mediaCandidates.sort((a, b) => {
    const aAudio = a.mimeType.toLowerCase().startsWith('audio/') ? 0 : 1
    const bAudio = b.mimeType.toLowerCase().startsWith('audio/') ? 0 : 1
    if (aAudio !== bAudio) return aAudio - bAudio

    if (a.contentLength === null && b.contentLength === null) return 0
    if (a.contentLength === null) return 1
    if (b.contentLength === null) return -1
    return a.contentLength - b.contentLength
  })

  return mediaCandidates
}

async function fetchWatchPageData(videoId: string): Promise<WatchPageData> {
  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: {
      'User-Agent': WATCH_PAGE_USER_AGENT,
      'Accept-Language': WATCH_PAGE_ACCEPT_LANGUAGE,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube watch page (${response.status}).`)
  }

  const html = await response.text()
  const playerResponse = extractInitialPlayerResponse(html)
  const rawTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  const captionTracks: CaptionTrack[] = Array.isArray(rawTracks)
    ? rawTracks
        .map((track): CaptionTrack => {
          const kind: CaptionTrack['kind'] = track.kind === 'asr' ? 'asr' : 'manual'
          return {
            baseUrl: typeof track.baseUrl === 'string' ? track.baseUrl : '',
            languageCode: typeof track.languageCode === 'string' ? track.languageCode : '',
            kind,
          }
        })
        .filter((track) => track.baseUrl.length > 0)
    : []

  const mediaCandidates = playerResponse ? buildMediaCandidatesFromPlayerResponse(playerResponse) : []

  return {
    captionTracks,
    mediaCandidates,
  }
}

function buildTrackCandidateUrls(baseUrl: string) {
  const candidates = [baseUrl, `${baseUrl}&fmt=srv3`, `${baseUrl}&fmt=json3`, `${baseUrl}&fmt=vtt`]
  return Array.from(new Set(candidates))
}

async function fetchTrackTranscript(track: CaptionTrack): Promise<TranscriptResponse[]> {
  for (const url of buildTrackCandidateUrls(track.baseUrl)) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': WATCH_PAGE_USER_AGENT,
          'Accept-Language': track.languageCode || WATCH_PAGE_ACCEPT_LANGUAGE,
        },
      })

      if (!response.ok) {
        continue
      }

      const body = await response.text()
      const parsedSegments = parseTranscriptBody(body, track.languageCode || 'en')
      if (parsedSegments.length > 0) {
        return parsedSegments
      }
    } catch {
      continue
    }
  }

  return []
}

function sortTracksByPriority(tracks: CaptionTrack[]) {
  return [...tracks].sort((a, b) => {
    const aScore = (a.kind === 'manual' ? 2 : 0) + (a.languageCode === 'en' ? 1 : 0)
    const bScore = (b.kind === 'manual' ? 2 : 0) + (b.languageCode === 'en' ? 1 : 0)
    return bScore - aScore
  })
}

function getYtDlpLanguageSelector(availableLanguages: string[]) {
  const configured = process.env.YOUTUBE_YTDLP_SUB_LANGS?.trim()
  if (configured) {
    return configured
  }

  const normalized = availableLanguages
    .map((language) => language.trim())
    .filter(Boolean)

  const prioritized = normalized
    .filter((language) => language.toLowerCase() !== 'en')
    .map((language) => `${language}.*`)

  return Array.from(new Set(['en.*,en-orig,en', ...prioritized, ...normalized])).join(',')
}

function getSubtitleExtPriority(ext: string) {
  const index = YTDLP_SUBTITLE_EXT_PRIORITY.indexOf(ext as YtDlpSubtitleExt)
  return index >= 0 ? index : YTDLP_SUBTITLE_EXT_PRIORITY.length
}

function isExpectedSubtitleExt(ext: string): ext is YtDlpSubtitleExt {
  return YTDLP_SUBTITLE_EXT_PRIORITY.includes(ext as YtDlpSubtitleExt)
}

function parseYtDlpSubtitleFileMetadata(videoId: string, fileName: string) {
  if (!fileName.startsWith(`${videoId}.`)) {
    return null
  }

  const parts = fileName.split('.')
  if (parts.length < 3) {
    return null
  }

  const ext = parts.at(-1)?.toLowerCase() ?? ''
  if (!isExpectedSubtitleExt(ext)) {
    return null
  }

  const languageCode = parts.slice(1, -1).join('.').trim() || 'en'
  return {
    ext,
    languageCode,
  }
}

function parseExecErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return null
  }

  const candidate = error as Error & { code?: unknown; stderr?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const stderr =
    typeof candidate.stderr === 'string' && candidate.stderr.trim().length > 0
      ? candidate.stderr.trim()
      : ''
  const baseMessage = error.message?.trim() || 'Unknown yt-dlp error.'

  if (code === 'ENOENT') {
    return 'yt-dlp binary is not installed on this server.'
  }

  return stderr || baseMessage
}

async function fetchTranscriptWithYtDlp(
  videoId: string,
  availableLanguages: string[]
): Promise<YtDlpTranscriptResult> {
  const enabled = process.env.YOUTUBE_YTDLP_ENABLED?.trim() !== '0'
  if (!enabled) {
    return {
      segments: null,
      attempted: false,
      reason: 'yt-dlp fallback is disabled via YOUTUBE_YTDLP_ENABLED=0.',
    }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'yt-dlp-subs-'))
  const subtitleLangSelector = getYtDlpLanguageSelector(availableLanguages)
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  try {
    await execFileAsync(
      DEFAULT_YTDLP_BIN,
      [
        '--skip-download',
        '--write-auto-sub',
        '--write-sub',
        '--sub-langs',
        subtitleLangSelector,
        '--sub-format',
        'json3/srv3/vtt',
        '--output',
        '%(id)s.%(ext)s',
        '--paths',
        `home:${tempDir}`,
        '--no-warnings',
        '--no-progress',
        videoUrl,
      ],
      {
        timeout: DEFAULT_YTDLP_TIMEOUT_MS,
        maxBuffer: 2 * 1024 * 1024,
      }
    )
    const files = await readdir(tempDir)
    const subtitleFiles = files
      .map((fileName) => ({ fileName, meta: parseYtDlpSubtitleFileMetadata(videoId, fileName) }))
      .filter(
        (
          entry
        ): entry is { fileName: string; meta: { ext: YtDlpSubtitleExt; languageCode: string } } =>
          entry.meta !== null
      )
      .sort((a, b) => getSubtitleExtPriority(a.meta.ext) - getSubtitleExtPriority(b.meta.ext))

    for (const entry of subtitleFiles) {
      const absolutePath = join(tempDir, entry.fileName)
      const fileBody = await readFile(absolutePath, 'utf8')
      if (fileBody.length > DEFAULT_YTDLP_MAX_SUBTITLE_BYTES) {
        continue
      }

      const parsedSegments = parseTranscriptBody(fileBody, entry.meta.languageCode)
      if (parsedSegments.length > 0) {
        return {
          segments: parsedSegments,
          attempted: true,
          reason: null,
        }
      }
    }

    return {
      segments: null,
      attempted: true,
      reason: 'yt-dlp did not return a subtitle file with parseable segments.',
    }
  } catch (error: unknown) {
    return {
      segments: null,
      attempted: true,
      reason: parseExecErrorMessage(error),
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

function isCaptionAvailabilityError(error: unknown) {
  return (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError ||
    error instanceof YoutubeTranscriptNotAvailableLanguageError ||
    error instanceof YoutubeTranscriptEmptyError
  )
}

function isOpenAiSttAvailable() {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

async function fetchMediaBytes(candidate: MediaCandidate): Promise<Uint8Array | null> {
  if (candidate.contentLength !== null && candidate.contentLength > DEFAULT_STT_MAX_BYTES) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_STT_TIMEOUT_MS)

  try {
    const response = await fetch(candidate.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': WATCH_PAGE_USER_AGENT,
        'Accept-Language': WATCH_PAGE_ACCEPT_LANGUAGE,
      },
    })

    if (!response.ok) {
      return null
    }

    const contentLengthHeader = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    if (Number.isFinite(contentLengthHeader) && contentLengthHeader > DEFAULT_STT_MAX_BYTES) {
      return null
    }

    const body = new Uint8Array(await response.arrayBuffer())
    if (body.byteLength > DEFAULT_STT_MAX_BYTES) {
      return null
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}

async function transcribeMediaWithOpenAi(params: {
  bytes: Uint8Array
  mimeType: string
  languageHint?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing.')
  }

  const openai = new OpenAI({ apiKey })
  const extension = params.mimeType.includes('webm') ? 'webm' : 'mp4'
  const transcriptionFile = await toFile(params.bytes, `youtube-audio.${extension}`, { type: params.mimeType })

  const transcription = await openai.audio.transcriptions.create({
    file: transcriptionFile,
    model: DEFAULT_STT_MODEL as 'gpt-4o-mini-transcribe',
    response_format: 'verbose_json',
    ...(params.languageHint ? { language: params.languageHint } : {}),
  })

  const text = typeof transcription.text === 'string' ? transcription.text.trim() : ''
  if (!text) {
    throw new Error('OpenAI transcription returned empty text.')
  }

  const durationSeconds =
    typeof (transcription as { duration?: unknown }).duration === 'number'
      ? (transcription as { duration: number }).duration
      : 0

  return {
    text,
    durationSeconds,
  }
}

async function transcribeFromMediaCandidates(params: {
  mediaCandidates: MediaCandidate[]
  languageHint?: string
}): Promise<{ segments: TranscriptResponse[]; usageEvent: YoutubeTranscriptUsageEvent } | null> {
  if (!isOpenAiSttAvailable()) {
    return null
  }

  const candidates = params.mediaCandidates.slice(0, 4)
  for (const candidate of candidates) {
    const bytes = await fetchMediaBytes(candidate)
    if (!bytes) {
      continue
    }

    try {
      const transcription = await transcribeMediaWithOpenAi({
        bytes,
        mimeType: candidate.mimeType,
        languageHint: params.languageHint,
      })

      return {
        segments: [
          {
            text: transcription.text,
            duration: transcription.durationSeconds,
            offset: 0,
            lang: params.languageHint,
          },
        ],
        usageEvent: {
          provider: 'openai',
          model: DEFAULT_STT_MODEL,
          useType: 'transcription',
          costUsd: estimateTranscriptionCostUsd(DEFAULT_STT_MODEL, transcription.durationSeconds),
          durationSeconds: transcription.durationSeconds,
          pricingVersion: AI_PRICING_VERSION,
        },
      }
    } catch {
      continue
    }
  }

  throw new Error('Audio fallback could not transcribe any available media candidate.')
}

async function resolveOfficialYoutubeAccessToken() {
  const direct = process.env.YOUTUBE_OFFICIAL_ACCESS_TOKEN?.trim()
  if (direct) return direct

  const refreshToken = process.env.YOUTUBE_OFFICIAL_REFRESH_TOKEN?.trim()
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!refreshToken || !clientId || !clientSecret) {
    return ''
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  })

  if (!response.ok) {
    return ''
  }

  const payload = (await response.json().catch(() => null)) as { access_token?: unknown } | null
  return typeof payload?.access_token === 'string' ? payload.access_token.trim() : ''
}

async function fetchYoutubeOfficialTranscript(videoId: string): Promise<TranscriptResponse[] | null> {
  try {
    const accessToken = await resolveOfficialYoutubeAccessToken()
    if (!accessToken) {
      return null
    }

    const captionsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${encodeURIComponent(videoId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    )

    if (!captionsResponse.ok) {
      return null
    }

    const captionsPayload = (await captionsResponse.json().catch(() => null)) as {
      items?: Array<{
        id?: string
        snippet?: {
          language?: string
          trackKind?: string
          isDraft?: boolean
        }
      }>
    } | null

    const tracks = Array.isArray(captionsPayload?.items) ? captionsPayload.items : []
    const selectedTrack = tracks.find((track) => track.id && track.snippet?.isDraft !== true)
    const captionId = selectedTrack?.id?.trim()
    if (!captionId) {
      return null
    }

    for (const format of ['vtt', 'srt']) {
      const downloadResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(captionId)}?tfmt=${format}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      )

      if (!downloadResponse.ok) {
        continue
      }

      const body = await downloadResponse.text()
      const segments = parseTranscriptBody(body, selectedTrack?.snippet?.language?.trim() || 'en')
      if (segments.length > 0) {
        return segments
      }
    }

    return null
  } catch {
    return null
  }
}

export async function resolveYoutubeTranscriptWithFallback(videoId: string): Promise<YoutubeTranscriptResolution> {
  let primaryError: unknown = null

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    if (segments.length > 0) {
      return {
        segments,
        source: 'youtube_transcript',
        usageEvents: [],
      }
    }
    primaryError = new YoutubeTranscriptEmptyError(videoId, 'youtube-transcript')
  } catch (error: unknown) {
    primaryError = error
    if (!isCaptionAvailabilityError(error)) {
      throw error
    }
  }

  const watchPageData = await fetchWatchPageData(videoId)
  const tracks = watchPageData.captionTracks
  if (tracks.length === 0) {
    const officialSegments = await fetchYoutubeOfficialTranscript(videoId)
    if (officialSegments && officialSegments.length > 0) {
      return {
        segments: officialSegments,
        source: 'youtube_official_api',
        usageEvents: [],
      }
    }
    if (primaryError) {
      throw primaryError
    }
    throw new YoutubeTranscriptNotAvailableError(videoId)
  }

  for (const track of sortTracksByPriority(tracks)) {
    const segments = await fetchTrackTranscript(track)
    if (segments.length > 0) {
      return {
        segments,
        source: 'watch_page_caption_track',
        usageEvents: [],
      }
    }
  }

  const availableLanguages = Array.from(new Set(tracks.map((track) => track.languageCode).filter(Boolean)))
  const ytDlpResult = await fetchTranscriptWithYtDlp(videoId, availableLanguages)
  if (ytDlpResult.segments && ytDlpResult.segments.length > 0) {
    return {
      segments: ytDlpResult.segments,
      source: 'yt_dlp_subtitles',
      usageEvents: [],
    }
  }

  const sttLanguageHint = availableLanguages.includes('en') ? 'en' : availableLanguages[0]

  try {
    const sttResult = await transcribeFromMediaCandidates({
      mediaCandidates: watchPageData.mediaCandidates,
      languageHint: sttLanguageHint,
    })
    if (sttResult && sttResult.segments.length > 0) {
      return {
        segments: sttResult.segments,
        source: 'openai_audio_transcription',
        usageEvents: [sttResult.usageEvent],
      }
    }
  } catch (error: unknown) {
    const officialSegments = await fetchYoutubeOfficialTranscript(videoId)
    if (officialSegments && officialSegments.length > 0) {
      return {
        segments: officialSegments,
        source: 'youtube_official_api',
        usageEvents: [],
      }
    }

    throw new YoutubeTranscriptTemporarilyUnavailableError(videoId, availableLanguages, {
      audioFallbackAttempted: true,
      audioFallbackReason: error instanceof Error ? error.message : 'Unknown STT fallback error',
    })
  }

  const officialSegments = await fetchYoutubeOfficialTranscript(videoId)
  if (officialSegments && officialSegments.length > 0) {
    return {
      segments: officialSegments,
      source: 'youtube_official_api',
      usageEvents: [],
    }
  }

  throw new YoutubeTranscriptTemporarilyUnavailableError(videoId, availableLanguages, {
    audioFallbackAttempted: false,
    audioFallbackReason: (() => {
      const reasons = [ytDlpResult.reason]
      reasons.push(
        isOpenAiSttAvailable()
          ? 'No suitable media candidate was available for STT.'
          : 'OPENAI_API_KEY is not configured for audio fallback.'
      )
      return reasons.filter((reason): reason is string => typeof reason === 'string' && reason.length > 0).join(' ')
    })(),
  })
}

export async function fetchYoutubeTranscriptWithFallback(videoId: string): Promise<TranscriptResponse[]> {
  const result = await resolveYoutubeTranscriptWithFallback(videoId)
  return result.segments
}
