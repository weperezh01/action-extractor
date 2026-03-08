import { type TranscriptResponse } from '@danielxceron/youtube-transcript'

export type { TranscriptResponse }

export const WATCH_PAGE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
export const WATCH_PAGE_ACCEPT_LANGUAGE = 'en-US,en;q=0.9'
export const WATCH_PAGE_CONSENT_COOKIE = 'CONSENT=YES+cb.20210328-17-p0.en+FX+999'

const PLAYER_RESPONSE_MARKERS = [
  'var ytInitialPlayerResponse = ',
  'ytInitialPlayerResponse = ',
  'window["ytInitialPlayerResponse"] = ',
] as const

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
const RE_XML_TRANSCRIPT_ASR = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
const RE_XML_TRANSCRIPT_ASR_SEGMENT = /<s[^>]*>([^<]*)<\/s>/g

export type CaptionTrack = {
  baseUrl: string
  languageCode: string
  kind: 'asr' | 'manual'
}

export type MediaCandidate = {
  url: string
  mimeType: string
  contentLength: number | null
}

type RawCaptionTrack = {
  baseUrl?: string
  languageCode?: string
  kind?: string
}

type RawStreamingFormat = {
  url?: string
  mimeType?: string
  contentLength?: string
}

export type YoutubePlayerResponse = {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: RawCaptionTrack[]
    }
  }
  streamingData?: {
    formats?: RawStreamingFormat[]
    adaptiveFormats?: RawStreamingFormat[]
  }
}

export type WatchPageData = {
  html: string
  playerResponse: YoutubePlayerResponse | null
  captionTracks: CaptionTrack[]
  mediaCandidates: MediaCandidate[]
}

export function decodeHtmlEntities(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

export function parseXmlTranscript(body: string, lang: string): TranscriptResponse[] {
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

export function parseJsonTranscript(body: string, lang: string): TranscriptResponse[] {
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

export function parseTimedTextTranscript(
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

export function parseVttTranscript(body: string, lang: string): TranscriptResponse[] {
  return parseTimedTextTranscript(body, lang, /([\d:.,]+)\s+-->\s+([\d:.,]+)/)
}

export function parseSrtTranscript(body: string, lang: string): TranscriptResponse[] {
  return parseTimedTextTranscript(body, lang, /([\d:.,]+)\s+-->\s+([\d:.,]+)/)
}

export function parseTranscriptBody(body: string, lang: string): TranscriptResponse[] {
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

export function extractInitialPlayerResponse(html: string): YoutubePlayerResponse | null {
  const markerIndex = PLAYER_RESPONSE_MARKERS
    .map((marker) => html.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]

  if (markerIndex === undefined) {
    return null
  }

  const marker = PLAYER_RESPONSE_MARKERS.find((candidate) => html.indexOf(candidate) === markerIndex)
  if (!marker) {
    return null
  }

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
    return JSON.parse(html.slice(index, endIndex)) as YoutubePlayerResponse
  } catch {
    return null
  }
}

export function normalizeCaptionTracks(rawTracks: RawCaptionTrack[] | null | undefined): CaptionTrack[] {
  return Array.isArray(rawTracks)
    ? rawTracks
        .map((track): CaptionTrack => ({
          baseUrl: typeof track.baseUrl === 'string' ? track.baseUrl : '',
          languageCode: typeof track.languageCode === 'string' ? track.languageCode : '',
          kind: track.kind === 'asr' ? 'asr' : 'manual',
        }))
        .filter((track) => track.baseUrl.length > 0)
    : []
}

export function extractCaptionTracksFromPlayerResponse(
  playerResponse: YoutubePlayerResponse | null | undefined
): CaptionTrack[] {
  return normalizeCaptionTracks(playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks)
}

export function buildMediaCandidatesFromPlayerResponse(playerResponse: YoutubePlayerResponse): MediaCandidate[] {
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
        mimeLower.includes('codecs=') &&
          (mimeLower.includes('mp4a') || mimeLower.includes('opus') || mimeLower.includes('vorbis'))
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

export async function fetchYoutubeWatchPageData(videoId: string): Promise<WatchPageData> {
  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Cookie: WATCH_PAGE_CONSENT_COOKIE,
      Pragma: 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': WATCH_PAGE_USER_AGENT,
      'Accept-Language': WATCH_PAGE_ACCEPT_LANGUAGE,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube watch page (${response.status}).`)
  }

  const html = await response.text()
  const playerResponse = extractInitialPlayerResponse(html)

  return {
    html,
    playerResponse,
    captionTracks: extractCaptionTracksFromPlayerResponse(playerResponse),
    mediaCandidates: playerResponse ? buildMediaCandidatesFromPlayerResponse(playerResponse) : [],
  }
}

export function buildTrackCandidateUrls(baseUrl: string) {
  const candidates = [baseUrl, `${baseUrl}&fmt=srv3`, `${baseUrl}&fmt=json3`, `${baseUrl}&fmt=vtt`]
  return Array.from(new Set(candidates))
}

export async function fetchTrackTranscript(track: CaptionTrack): Promise<TranscriptResponse[]> {
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

export function sortTracksByPriority(tracks: CaptionTrack[]) {
  return [...tracks].sort((a, b) => {
    const aScore = (a.kind === 'manual' ? 2 : 0) + (a.languageCode === 'en' ? 1 : 0)
    const bScore = (b.kind === 'manual' ? 2 : 0) + (b.languageCode === 'en' ? 1 : 0)
    return bScore - aScore
  })
}
