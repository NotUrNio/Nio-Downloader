import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- JavaScript release script intentionally has no declarations
import { resolveReleaseMetadata } from '../../scripts/release-metadata.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8')
}

const packageVersion = (JSON.parse(read('package.json')) as { version: string })
  .version
const releaseTag = `v${packageVersion}`
const restrictedPublicLanguage =
  /\b(?:certificates?|credentials?|secrets?|leak(?:ed|age|s)?|rotat(?:e|ed|ing|ion)|security incidents?)\b/iu
const secretLikeIdentifier =
  /\b[A-Z][A-Z0-9_]*(?:SECRET|CERT|KEY|TOKEN|CREDENTIAL)[A-Z0-9_]*\b/u

describe('release version contract', () => {
  it('keeps package metadata, server fallback, and Flatpak metadata aligned', () => {
    expect(
      resolveReleaseMetadata({
        eventName: 'workflow_dispatch',
        refName: 'main',
        refProtected: 'false',
        packageVersion,
      }).version
    ).toBe(packageVersion)

    const serverSource = read('src/server/index.ts')
    expect(serverSource).toContain(
      "import packageJson from '../../package.json' with { type: 'json' }"
    )
    expect(serverSource).toContain(
      'process.env.NIODOWNLOADER_APP_VERSION ?? packageJson.version'
    )

    const metainfo = read('flatpak/app.niodownloader.native.metainfo.xml')
    const latestRelease =
      /<release version="([^"]+)" date="(\d{4}-\d{2}-\d{2})">/.exec(metainfo)
    expect(latestRelease?.[1]).toBe(packageVersion)
    expect(latestRelease?.[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('advertises only the current release in README', () => {
    const source = read('README.md')
    expect(source).toContain(
      'https://github.com/NotUrNio/Nio-Downloader/releases'
    )
  })

  it('ships tag-pinned notes for the current version', () => {
    const englishPath = `docs/release-notes/${packageVersion}.md`
    const english = read(englishPath)
    expect(english).toContain(`# Nio Downloader ${packageVersion}`)
  })

  it('preserves current release references', () => {
    const english = read(`docs/release-notes/${packageVersion}.md`)
    const releaseMetadata = resolveReleaseMetadata({
      eventName: 'workflow_dispatch',
      refName: 'main',
      refProtected: 'false',
      packageVersion,
    })

    expect(english).toContain(
      `https://github.com/NotUrNio/Nio-Downloader/blob/${releaseTag}/docs/docker-server.md`
    )

    for (const source of [english]) {
      expect(source).toContain(
        `docker.io/niodownloader/nio-server:${packageVersion}`
      )
      expect(source).toContain(`ghcr.io/noturnio/nio-server:${packageVersion}`)
      if (releaseMetadata.channel === 'beta') {
        expect(source).toContain('latest/edge')
      }
    }
  })

  it('validates 1.0.0 release notes contain no restricted language or secret-like identifiers', () => {
    const english = read(`docs/release-notes/${packageVersion}.md`)
    expect(english).not.toMatch(restrictedPublicLanguage)
    expect(english).not.toMatch(secretLikeIdentifier)
  })

  it('validates 1.0.0 release notes have valid documentation links and structure', () => {
    const english = read(`docs/release-notes/${packageVersion}.md`)
    expect(english).toContain(
      `https://github.com/NotUrNio/Nio-Downloader/blob/${releaseTag}/docs/flatpak.md`
    )
    expect(english).toContain(
      `https://github.com/NotUrNio/Nio-Downloader/blob/${releaseTag}/docs/RELEASING.md`
    )
    expect(english).toContain(
      `https://github.com/NotUrNio/Nio-Downloader/blob/${releaseTag}/THIRD_PARTY_NOTICES.md`
    )
    expect(english).toContain('## Key Capabilities')
    expect(english).toContain('## Verified Release Artifacts')
    expect(english).toContain('## Documentation and Guides')
  })

  it('validates 1.0.0 release notes list all primary release artifacts', () => {
    const english = read(`docs/release-notes/${packageVersion}.md`)
    expect(english).toContain(`Nio-Downloader-${packageVersion}-<arch>.dmg`)
    expect(english).toContain(`Nio-Downloader-Setup-${packageVersion}.exe`)
    expect(english).toContain(
      `Nio-Downloader-${packageVersion}-<arch>.AppImage`
    )
    expect(english).toContain(`Nio-Downloader-${packageVersion}-<arch>.flatpak`)
  })
})
