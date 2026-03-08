import {
  extractCaptionTracksFromPlayerResponse,
  fetchTrackTranscript,
  fetchYoutubeWatchPageData,
  sortTracksByPriority,
  type CaptionTrack,
  type TranscriptResponse,
  type YoutubePlayerResponse,
} from '@/lib/youtube-transcript-shared'

const INNERTUBE_PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
type InnerTubeClientConfig = {
  label: string
  userAgent: string
  headerClientName: string
  clientName: 'ANDROID' | 'IOS' | 'TVHTML5_SIMPLY_EMBEDDED_PLAYER'
  clientVersion: string
  extraClientContext?: Record<string, unknown>
}

const INNERTUBE_CLIENTS: readonly InnerTubeClientConfig[] = [
  {
    label: 'android',
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 13; en_US; Pixel 7 Build/TQ3A.230805.001)',
    headerClientName: '3',
    clientName: 'ANDROID',
    clientVersion: '19.09.37',
    extraClientContext: {
      androidSdkVersion: 33,
      hl: 'en',
      gl: 'US',
    },
  },
  {
    label: 'ios',
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_3 like Mac OS X)',
    headerClientName: '5',
    clientName: 'IOS',
    clientVersion: '19.09.3',
    extraClientContext: {
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '17.3.1.21D61',
      hl: 'en',
      gl: 'US',
    },
  },
  {
    label: 'tv-embedded',
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/3.0 TV Safari/537.36',
    headerClientName: '85',
    clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    clientVersion: '2.0',
    extraClientContext: {
      clientScreen: 'EMBED',
      hl: 'en',
      gl: 'US',
    },
  },
]

function hasCaptchaChallenge(html: string) {
  const lowered = html.toLowerCase()
  return (
    lowered.includes('www.google.com/sorry') ||
    lowered.includes('verify you are human') ||
    lowered.includes('unusual traffic from your computer network') ||
    lowered.includes('/sorry/index')
  )
}

async function resolveTranscriptFromTracks(tracks: CaptionTrack[]): Promise<TranscriptResponse[]> {
  for (const track of sortTracksByPriority(tracks)) {
    const segments = await fetchTrackTranscript(track)
    if (segments.length > 0) {
      return segments
    }
  }

  return []
}

async function fetchInnerTubeCaptionTracks(
  videoId: string,
  client: InnerTubeClientConfig
): Promise<CaptionTrack[]> {
  const response = await fetch(INNERTUBE_PLAYER_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/',
      'User-Agent': client.userAgent,
      'X-YouTube-Client-Name': client.headerClientName,
      'X-YouTube-Client-Version': client.clientVersion,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: client.clientName,
          clientVersion: client.clientVersion,
          ...client.extraClientContext,
        },
      },
      videoId,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    return []
  }

  const payload = (await response.json().catch(() => null)) as YoutubePlayerResponse | null
  return extractCaptionTracksFromPlayerResponse(payload)
}

export async function fetchTranscriptCustom(videoId: string): Promise<TranscriptResponse[]> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const innerTubeTracks = await fetchInnerTubeCaptionTracks(videoId, client)
      const innerTubeSegments = await resolveTranscriptFromTracks(innerTubeTracks)
      if (innerTubeSegments.length > 0) {
        return innerTubeSegments
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown InnerTube error'
      console.warn(`[youtube-transcript-custom] InnerTube ${client.label} step failed for ${videoId}: ${message}`)
    }
  }

  try {
    const watchPageData = await fetchYoutubeWatchPageData(videoId)
    if (hasCaptchaChallenge(watchPageData.html)) {
      console.warn(`[youtube-transcript-custom] CAPTCHA detected for watch page ${videoId}.`)
      return []
    }

    const watchPageSegments = await resolveTranscriptFromTracks(watchPageData.captionTracks)
    if (watchPageSegments.length > 0) {
      return watchPageSegments
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown watch page error'
    console.warn(`[youtube-transcript-custom] Watch page step failed for ${videoId}: ${message}`)
  }

  return []
}
