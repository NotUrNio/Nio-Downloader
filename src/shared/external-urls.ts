/**
 * Central registry for external URLs used across main and renderer —
 * help menu links, docs deep-links, issue tracker. Keep all hardcoded
 * public URLs here so migrations (domain change, docs restructure,
 * locale-specific redirects) only touch one file.
 */
const nioUrls = {
  home: 'https://github.com/NotUrNio/Nio-Downloader',
  acknowledgments: 'https://github.com/NotUrNio/Nio-Downloader#acknowledgments',
  plugins: 'https://github.com/NotUrNio/Nio-Downloader#plugins',
  changelog: 'https://github.com/NotUrNio/Nio-Downloader/releases',
  releaseNotes: 'https://github.com/NotUrNio/Nio-Downloader/releases',
  manual: {
    home: 'https://github.com/NotUrNio/Nio-Downloader#manual',
    ffmpeg: 'https://github.com/NotUrNio/Nio-Downloader#ffmpeg',
    linuxAutostart:
      'https://github.com/NotUrNio/Nio-Downloader#linux-autostart',
    downloadPerformance:
      'https://github.com/NotUrNio/Nio-Downloader#download-performance',
    natTroubleshooting:
      'https://github.com/NotUrNio/Nio-Downloader#port-mapping',
    advancedProxy: 'https://github.com/NotUrNio/Nio-Downloader#advanced-proxy',
    defaultApplication:
      'https://github.com/NotUrNio/Nio-Downloader#default-application',
  },
} as const

export const EXTERNAL_URLS = {
  browserExtension: {
    chrome: 'https://github.com/NotUrNio/Nio-Downloader-Browser-Extension',
    edge: 'https://github.com/NotUrNio/Nio-Downloader-Browser-Extension',
    firefox: 'https://github.com/NotUrNio/Nio-Downloader-Browser-Extension',
    // Safari packages use their own release tags; latest points to Chromium/Firefox.
    safari: 'https://github.com/NotUrNio/Nio-Downloader-Browser-Extension',
    development:
      'https://github.com/NotUrNio/Nio-Downloader-Browser-Extension#development',
  },
  github: {
    repository: 'https://github.com/NotUrNio/Nio-Downloader/',
    author: 'https://github.com/NotUrNio/',
    issues: 'https://github.com/NotUrNio/Nio-Downloader/issues/',
    ffmpegStaticReleases: 'https://github.com/NotUrNio/Nio-Downloader/releases',
  },
  nio: nioUrls,
} as const

export function getFfmpegManualUrl(_language?: string): string {
  return EXTERNAL_URLS.nio.manual.ffmpeg
}

export function getNatTroubleshootingUrl(_language?: string): string {
  return EXTERNAL_URLS.nio.manual.natTroubleshooting
}

export function getDownloadPerformanceUrl(_language?: string): string {
  return EXTERNAL_URLS.nio.manual.downloadPerformance
}

export function getLinuxAutostartUrl(_language?: string): string {
  return EXTERNAL_URLS.nio.manual.linuxAutostart
}
