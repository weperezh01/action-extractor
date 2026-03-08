import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
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
import { fetchTranscriptCustom } from '@/lib/youtube-transcript-custom'
import {
  WATCH_PAGE_ACCEPT_LANGUAGE,
  WATCH_PAGE_USER_AGENT,
  fetchYoutubeWatchPageData,
  parseTranscriptBody,
  type MediaCandidate,
} from '@/lib/youtube-transcript-shared'

const execFileAsync = promisify(execFile)

const DEFAULT_STT_MODEL = process.env.YOUTUBE_AUDIO_STT_MODEL?.trim() || 'gpt-4o-mini-transcribe'
const DEFAULT_STT_MAX_BYTES = Number.parseInt(process.env.YOUTUBE_AUDIO_STT_MAX_BYTES ?? '', 10) || 95 * 1024 * 1024
const DEFAULT_STT_DIRECT_MAX_BYTES =
  Number.parseInt(process.env.YOUTUBE_AUDIO_STT_DIRECT_MAX_BYTES ?? '', 10) || 20 * 1024 * 1024
const DEFAULT_STT_TIMEOUT_MS = Number.parseInt(process.env.YOUTUBE_AUDIO_STT_TIMEOUT_MS ?? '', 10) || 180_000
const DEFAULT_STT_SEGMENT_SECONDS = Number.parseInt(process.env.YOUTUBE_AUDIO_STT_SEGMENT_SECONDS ?? '', 10) || 480
const DEFAULT_FFMPEG_BIN = process.env.FFMPEG_BIN?.trim() || 'ffmpeg'
const DEFAULT_FFPROBE_BIN = process.env.FFPROBE_BIN?.trim() || 'ffprobe'
const DOCKER_LOCAL_YTDLP_BIN = join(process.cwd(), 'vendor', 'yt-dlp-venv', 'bin', 'yt-dlp')
const LOCAL_YTDLP_BIN = join(process.cwd(), 'vendor', 'yt-dlp', 'yt-dlp')
const DEFAULT_YTDLP_BIN =
  process.env.YOUTUBE_YTDLP_BIN?.trim() ||
  (existsSync('/.dockerenv')
    ? existsSync(DOCKER_LOCAL_YTDLP_BIN)
      ? DOCKER_LOCAL_YTDLP_BIN
      : 'yt-dlp'
    : existsSync(LOCAL_YTDLP_BIN)
      ? LOCAL_YTDLP_BIN
      : 'yt-dlp')
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

type YtDlpAudioSttResult = {
  segments: TranscriptResponse[] | null
  usageEvent: YoutubeTranscriptUsageEvent | null
  attempted: boolean
  reason: string | null
}

export type YoutubeTranscriptResolvedSource =
  | 'custom_extractor'
  | 'youtube_transcript'
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

export interface YoutubeTranscriptStatusUpdate {
  step: string
  message: string
}

type YoutubeTranscriptStatusHandler = (
  update: YoutubeTranscriptStatusUpdate
) => void | Promise<void>

interface ResolveYoutubeTranscriptOptions {
  onStatus?: YoutubeTranscriptStatusHandler
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

function inferAudioMimeTypeFromFileName(fileName: string) {
  const lowered = fileName.toLowerCase()
  if (lowered.endsWith('.m4a') || lowered.endsWith('.mp4')) {
    return 'audio/mp4'
  }
  if (lowered.endsWith('.mp3')) {
    return 'audio/mpeg'
  }
  if (lowered.endsWith('.ogg') || lowered.endsWith('.opus')) {
    return 'audio/ogg'
  }
  return 'audio/webm'
}

function inferAudioExtensionFromMimeType(mimeType: string) {
  const lowered = mimeType.toLowerCase()
  if (lowered.includes('webm')) {
    return 'webm'
  }
  if (lowered.includes('mpeg') || lowered.includes('mp3')) {
    return 'mp3'
  }
  if (lowered.includes('ogg') || lowered.includes('opus')) {
    return 'ogg'
  }
  return 'mp4'
}

function isOpenAiAudioTooLargeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('too large for this model') ||
    message.includes('total number of tokens in instructions + audio is too large') ||
    message.includes('maximum context length')
  )
}

function isOpenAiAudioUnsupportedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.toLowerCase().includes('audio file might be corrupted or unsupported')
}

async function probeAudioDurationSeconds(absolutePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      DEFAULT_FFPROBE_BIN,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', absolutePath],
      {
        timeout: DEFAULT_STT_TIMEOUT_MS,
        maxBuffer: 256 * 1024,
      }
    )

    const parsed = Number.parseFloat(stdout.trim())
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  } catch {
    return 0
  }
}

async function transcribeAudioFileWithOpenAi(params: {
  absolutePath: string
  languageHint?: string
}): Promise<{ text: string; durationSeconds: number }> {
  const transcribeAbsolutePath = async (absolutePath: string) => {
    const fileName = absolutePath.split('/').at(-1) || 'audio.webm'
    const mimeType = inferAudioMimeTypeFromFileName(fileName)
    const bytes = new Uint8Array(await readFile(absolutePath))

    if (bytes.byteLength > DEFAULT_STT_MAX_BYTES) {
      throw new Error(`Audio file exceeds STT byte limit (${DEFAULT_STT_MAX_BYTES} bytes).`)
    }

    const transcription = await transcribeMediaWithOpenAi({
      bytes,
      mimeType,
      languageHint: params.languageHint,
    })

    return {
      text: transcription.text,
      durationSeconds:
        transcription.durationSeconds > 0 ? transcription.durationSeconds : await probeAudioDurationSeconds(absolutePath),
    }
  }

  try {
    return await transcribeAbsolutePath(params.absolutePath)
  } catch (error: unknown) {
    if (!isOpenAiAudioUnsupportedError(error)) {
      throw error
    }

    const normalizedAbsolutePath = join(tmpdir(), `youtube-audio-normalized-${Date.now()}.mp3`)

    try {
      await execFileAsync(
        DEFAULT_FFMPEG_BIN,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          params.absolutePath,
          '-vn',
          '-map',
          '0:a:0?',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'libmp3lame',
          '-b:a',
          '64k',
          normalizedAbsolutePath,
        ],
        {
          timeout: DEFAULT_STT_TIMEOUT_MS,
          maxBuffer: 512 * 1024,
        }
      )

      return await transcribeAbsolutePath(normalizedAbsolutePath)
    } finally {
      await rm(normalizedAbsolutePath, { force: true }).catch(() => {})
    }
  }
}

async function transcribeAudioFileInChunks(params: {
  absolutePath: string
  languageHint?: string
  onStatus?: YoutubeTranscriptStatusHandler
}): Promise<{ text: string; durationSeconds: number }> {
  const chunkDir = await mkdtemp(join(tmpdir(), 'yt-audio-chunks-'))
  const chunkPattern = join(chunkDir, 'chunk-%03d.mp3')

  try {
    await execFileAsync(
      DEFAULT_FFMPEG_BIN,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        params.absolutePath,
        '-vn',
        '-map',
        '0:a:0?',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        '-f',
        'segment',
        '-segment_time',
        String(DEFAULT_STT_SEGMENT_SECONDS),
        '-reset_timestamps',
        '1',
        chunkPattern,
      ],
      {
        timeout: Math.max(DEFAULT_STT_TIMEOUT_MS, DEFAULT_STT_SEGMENT_SECONDS * 1000),
        maxBuffer: 512 * 1024,
      }
    )

    const chunkFiles = (await readdir(chunkDir))
      .filter((fileName) => fileName.startsWith('chunk-'))
      .sort()

    if (chunkFiles.length === 0) {
      throw new Error('ffmpeg did not produce any STT chunks.')
    }

    await params.onStatus?.({
      step: 'audio-chunking',
      message: `Video largo detectado. Transcribiendo audio por segmentos (${chunkFiles.length})...`,
    })

    const textParts: string[] = []
    let totalDurationSeconds = 0

    for (const [index, chunkFileName] of chunkFiles.entries()) {
      await params.onStatus?.({
        step: 'audio-chunk-progress',
        message: `Transcribiendo segmento ${index + 1}/${chunkFiles.length} del audio...`,
      })

      const chunkAbsolutePath = join(chunkDir, chunkFileName)
      const part = await transcribeAudioFileWithOpenAi({
        absolutePath: chunkAbsolutePath,
        languageHint: params.languageHint,
      })

      if (part.text.trim()) {
        textParts.push(part.text.trim())
      }
      totalDurationSeconds += part.durationSeconds
    }

    const text = textParts.join('\n\n').trim()
    if (!text) {
      throw new Error('Chunked STT returned empty text.')
    }

    return {
      text,
      durationSeconds: totalDurationSeconds,
    }
  } finally {
    await rm(chunkDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function transcribeFromYtDlpAudioDownload(params: {
  videoId: string
  languageHint?: string
  onStatus?: YoutubeTranscriptStatusHandler
}): Promise<YtDlpAudioSttResult> {
  const enabled = process.env.YOUTUBE_YTDLP_ENABLED?.trim() !== '0'
  if (!enabled) {
    return {
      segments: null,
      usageEvent: null,
      attempted: false,
      reason: 'yt-dlp fallback is disabled via YOUTUBE_YTDLP_ENABLED=0.',
    }
  }

  if (!isOpenAiSttAvailable()) {
    return {
      segments: null,
      usageEvent: null,
      attempted: false,
      reason: 'OPENAI_API_KEY is not configured for audio fallback.',
    }
  }

  const videoUrl = `https://www.youtube.com/watch?v=${params.videoId}`
  const tempDir = await mkdtemp(join(tmpdir(), 'yt-dlp-audio-'))

  try {
    await params.onStatus?.({
      step: 'audio-download',
      message: 'Subtítulos bloqueados. Descargando audio del video como respaldo...',
    })

    await execFileAsync(
      DEFAULT_YTDLP_BIN,
      ['-f', 'bestaudio/best', '--output', join(tempDir, 'audio.%(ext)s'), '--no-warnings', '--no-progress', videoUrl],
      {
        timeout: Math.max(DEFAULT_YTDLP_TIMEOUT_MS, DEFAULT_STT_TIMEOUT_MS),
        maxBuffer: 2 * 1024 * 1024,
      }
    )

    const files = await readdir(tempDir)
    const audioFileName = files.find((fileName) => fileName.startsWith('audio.'))
    if (!audioFileName) {
      return {
        segments: null,
        usageEvent: null,
        attempted: true,
        reason: 'yt-dlp did not produce an audio file for STT.',
      }
    }

    const absolutePath = join(tempDir, audioFileName)
    const bytes = new Uint8Array(await readFile(absolutePath))
    if (bytes.byteLength === 0) {
      return {
        segments: null,
        usageEvent: null,
        attempted: true,
        reason: 'yt-dlp downloaded an empty audio file for STT.',
      }
    }

    let transcription: { text: string; durationSeconds: number }
    if (bytes.byteLength > DEFAULT_STT_MAX_BYTES) {
      transcription = await transcribeAudioFileInChunks({
        absolutePath,
        languageHint: params.languageHint,
        onStatus: params.onStatus,
      })
    } else {
      if (bytes.byteLength > DEFAULT_STT_DIRECT_MAX_BYTES) {
        transcription = await transcribeAudioFileInChunks({
          absolutePath,
          languageHint: params.languageHint,
          onStatus: params.onStatus,
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
          attempted: true,
          reason: null,
        }
      }

      await params.onStatus?.({
        step: 'audio-transcription',
        message: 'Transcribiendo audio del video con IA...',
      })

      try {
        transcription = await transcribeAudioFileWithOpenAi({
          absolutePath,
          languageHint: params.languageHint,
        })
      } catch (error: unknown) {
        if (!isOpenAiAudioTooLargeError(error)) {
          throw error
        }

        transcription = await transcribeAudioFileInChunks({
          absolutePath,
          languageHint: params.languageHint,
          onStatus: params.onStatus,
        })
      }
    }

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
      attempted: true,
      reason: null,
    }
  } catch (error: unknown) {
    return {
      segments: null,
      usageEvent: null,
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
  const extension = inferAudioExtensionFromMimeType(params.mimeType)
  const transcriptionFile = await toFile(params.bytes, `youtube-audio.${extension}`, { type: params.mimeType })

  const transcription = await openai.audio.transcriptions.create({
    file: transcriptionFile,
    model: DEFAULT_STT_MODEL as 'gpt-4o-mini-transcribe',
    response_format: 'json',
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

export async function resolveYoutubeTranscriptWithFallback(
  videoId: string,
  options: ResolveYoutubeTranscriptOptions = {}
): Promise<YoutubeTranscriptResolution> {
  try {
    const customSegments = await fetchTranscriptCustom(videoId)
    if (customSegments.length > 0) {
      return {
        segments: customSegments,
        source: 'custom_extractor',
        usageEvents: [],
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown custom extractor error'
    console.warn(`[youtube-transcript-fallback] Custom extractor failed for ${videoId}: ${message}`)
  }

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

  const watchPageData = await fetchYoutubeWatchPageData(videoId).catch(() => ({
    html: '',
    playerResponse: null,
    captionTracks: [],
    mediaCandidates: [],
  }))
  const availableLanguages = Array.from(new Set(watchPageData.captionTracks.map((track) => track.languageCode).filter(Boolean)))
  const ytDlpResult = await fetchTranscriptWithYtDlp(videoId, availableLanguages)
  if (ytDlpResult.segments && ytDlpResult.segments.length > 0) {
    return {
      segments: ytDlpResult.segments,
      source: 'yt_dlp_subtitles',
      usageEvents: [],
    }
  }
  if (ytDlpResult.attempted && ytDlpResult.reason) {
    console.warn(`[youtube-transcript-fallback] yt-dlp subtitles failed for ${videoId}: ${ytDlpResult.reason}`)
  }

  const sttLanguageHint = availableLanguages.includes('en') ? 'en' : availableLanguages[0]
  const ytDlpAudioSttResult = await transcribeFromYtDlpAudioDownload({
    videoId,
    languageHint: sttLanguageHint,
    onStatus: options.onStatus,
  })
  if (ytDlpAudioSttResult.segments && ytDlpAudioSttResult.usageEvent) {
    return {
      segments: ytDlpAudioSttResult.segments,
      source: 'openai_audio_transcription',
      usageEvents: [ytDlpAudioSttResult.usageEvent],
    }
  }
  if (ytDlpAudioSttResult.attempted && ytDlpAudioSttResult.reason) {
    console.warn(`[youtube-transcript-fallback] yt-dlp audio STT failed for ${videoId}: ${ytDlpAudioSttResult.reason}`)
  }

  try {
    await options.onStatus?.({
      step: 'audio-fallback',
      message: 'Probando una segunda ruta de audio automática...',
    })

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

  if (availableLanguages.length === 0) {
    if (primaryError) {
      throw primaryError
    }
    throw new YoutubeTranscriptNotAvailableError(videoId)
  }

  throw new YoutubeTranscriptTemporarilyUnavailableError(videoId, availableLanguages, {
    audioFallbackAttempted: false,
    audioFallbackReason: (() => {
      const reasons = [ytDlpResult.reason, ytDlpAudioSttResult.reason]
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
