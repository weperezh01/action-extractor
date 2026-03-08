import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchTranscriptCustom } from '@/lib/youtube-transcript-custom'

const fetchMock = vi.fn<typeof fetch>()
const originalFetch = global.fetch

function buildWatchPageHtml(playerResponse: unknown) {
  return `<html><body><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></body></html>`
}

function createTextResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

describe('lib/youtube-transcript-custom', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('usa InnerTube como primera opcion', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.startsWith('https://www.youtube.com/youtubei/v1/player')) {
        return createJsonResponse({
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  baseUrl: 'https://captions.example.com/innertube-track?lang=en',
                  languageCode: 'en',
                  kind: 'manual',
                },
              ],
            },
          },
        })
      }

      if (url.startsWith('https://captions.example.com/innertube-track')) {
        return createTextResponse('<transcript><text start="0" dur="1">InnerTube transcript</text></transcript>')
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    const segments = await fetchTranscriptCustom('video-1')

    expect(segments).toHaveLength(1)
    expect(segments[0]?.text).toBe('InnerTube transcript')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('cae a watch page cuando fallan los clientes de InnerTube', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.startsWith('https://www.youtube.com/youtubei/v1/player')) {
        return createJsonResponse({})
      }

      if (url.startsWith('https://www.youtube.com/watch')) {
        return createTextResponse(
          buildWatchPageHtml({
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: 'https://captions.example.com/watch-track?lang=en',
                    languageCode: 'en',
                    kind: 'manual',
                  },
                ],
              },
            },
          })
        )
      }

      if (url.startsWith('https://captions.example.com/watch-track')) {
        return createTextResponse('<transcript><text start="0" dur="1">Hello world</text></transcript>')
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    const segments = await fetchTranscriptCustom('video-2')

    expect(segments).toHaveLength(1)
    expect(segments[0]?.text).toBe('Hello world')
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
