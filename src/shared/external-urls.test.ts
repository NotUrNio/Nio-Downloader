import { describe, expect, it } from 'vitest'
import {
  EXTERNAL_URLS,
  getFfmpegManualUrl,
  getNatTroubleshootingUrl,
} from './external-urls'

describe('getFfmpegManualUrl', () => {
  it.each(['en-US', 'de', 'fr', 'ja', ''])(
    'returns the FFmpeg manual URL for %s',
    (locale) => {
      expect(getFfmpegManualUrl(locale)).toBe(EXTERNAL_URLS.nio.manual.ffmpeg)
    }
  )
})

describe('getNatTroubleshootingUrl', () => {
  it('points FFmpeg downloads at releases', () => {
    expect(EXTERNAL_URLS.github.ffmpegStaticReleases).toBe(
      'https://github.com/NotUrNio/Nio-Downloader/releases'
    )
  })

  it('returns the NAT troubleshooting URL', () => {
    expect(getNatTroubleshootingUrl('en-US')).toBe(
      EXTERNAL_URLS.nio.manual.natTroubleshooting
    )
    expect(getNatTroubleshootingUrl('fr')).toBe(
      EXTERNAL_URLS.nio.manual.natTroubleshooting
    )
  })
})
