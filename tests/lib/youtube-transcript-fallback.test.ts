import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchTranscriptCustomMock = vi.hoisted(() => vi.fn())
const youtubeTranscriptFetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/youtube-transcript-custom', () => ({
  fetchTranscriptCustom: fetchTranscriptCustomMock,
}))

vi.mock('@danielxceron/youtube-transcript', () => {
  class YoutubeTranscriptDisabledError extends Error {}
  class YoutubeTranscriptEmptyError extends Error {}
  class YoutubeTranscriptNotAvailableError extends Error {}
  class YoutubeTranscriptNotAvailableLanguageError extends Error {}

  return {
    YoutubeTranscript: {
      fetchTranscript: youtubeTranscriptFetchMock,
    },
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptEmptyError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptNotAvailableLanguageError,
  }
})

import { resolveYoutubeTranscriptWithFallback } from '@/lib/youtube-transcript-fallback'

describe('lib/youtube-transcript-fallback', () => {
  beforeEach(() => {
    fetchTranscriptCustomMock.mockReset()
    youtubeTranscriptFetchMock.mockReset()
  })

  it('usa el custom extractor como Stage 0 y evita el paquete legado si hay transcript', async () => {
    fetchTranscriptCustomMock.mockResolvedValue([
      { text: 'Custom transcript', duration: 2, offset: 0, lang: 'en' },
    ])

    const result = await resolveYoutubeTranscriptWithFallback('video-custom')

    expect(result.source).toBe('custom_extractor')
    expect(result.segments).toHaveLength(1)
    expect(youtubeTranscriptFetchMock).not.toHaveBeenCalled()
  })

  it('usa youtube_transcript cuando el custom extractor no devuelve segmentos', async () => {
    fetchTranscriptCustomMock.mockResolvedValue([])
    youtubeTranscriptFetchMock.mockResolvedValue([
      { text: 'Library transcript', duration: 3, offset: 0, lang: 'en' },
    ])

    const result = await resolveYoutubeTranscriptWithFallback('video-library')

    expect(fetchTranscriptCustomMock).toHaveBeenCalledWith('video-library')
    expect(youtubeTranscriptFetchMock).toHaveBeenCalledWith('video-library')
    expect(result.source).toBe('youtube_transcript')
    expect(result.segments[0]?.text).toBe('Library transcript')
  })
})
