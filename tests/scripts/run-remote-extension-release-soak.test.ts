import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error -- JavaScript runner intentionally has no declarations
import {
  runRemoteExtensionReleaseSoak,
  validateReleaseBuildLocation,
  validateReleaseManifestLocation,
  validateReleasePlaywrightReport,
  validateReleaseSoakState,
} from '../../scripts/run-remote-extension-release-soak.mjs'

const PIN = '1'.repeat(40)
const NIO_PIN = '2'.repeat(40)
const NIO_HEAD = '3'.repeat(40)
const MANIFEST = 'e2e/bridge/remote-extension-compatibility.json'
const EVIDENCE_DIR = path.resolve('/evidence')

function validState() {
  return {
    repeats: 20,
    extensionDirty: false,
    nioDirty: false,
    extensionHead: PIN,
    extensionPin: PIN,
    nioChangedFiles: [MANIFEST],
    manifestRelativePath: MANIFEST,
  }
}

function context() {
  return {
    protocol: 'MDXP-over-MBP1',
    compatibilityManifest: MANIFEST,
    pins: { extension: PIN, nioDownloader: NIO_PIN },
    heads: { extension: PIN, nioDownloader: NIO_HEAD },
  }
}

function report(browserCases = 100, resultStatus = 'passed') {
  return {
    errors: [],
    suites: [
      {
        specs: [
          {
            tests: Array.from({ length: browserCases }, () => ({
              expectedStatus: 'passed',
              status: resultStatus === 'passed' ? 'expected' : 'unexpected',
              results: [{ status: resultStatus, errors: [] }],
            })),
          },
        ],
      },
    ],
  }
}

describe('remote Extension release soak', () => {
  it('requires exactly twenty repetitions', () => {
    expect(() =>
      validateReleaseSoakState({ ...validState(), repeats: 19 })
    ).toThrow(/exactly 20/)
  })

  it('rejects either dirty repository', () => {
    expect(() =>
      validateReleaseSoakState({ ...validState(), extensionDirty: true })
    ).toThrow(/clean Extension and Nio Downloader/)
    expect(() =>
      validateReleaseSoakState({ ...validState(), nioDirty: true })
    ).toThrow(/clean Extension and Nio Downloader/)
  })

  it('requires Extension HEAD to equal its pin', () => {
    expect(() =>
      validateReleaseSoakState({
        ...validState(),
        extensionHead: '4'.repeat(40),
      })
    ).toThrow(/exactly match/)
  })

  it('allows only the compatibility manifest after the Nio Downloader pin', () => {
    expect(() =>
      validateReleaseSoakState({
        ...validState(),
        nioChangedFiles: [MANIFEST, 'src/server/index.ts'],
      })
    ).toThrow(/only the pinned manifest/)
    expect(() =>
      validateReleaseSoakState({ ...validState(), nioChangedFiles: [] })
    ).toThrow(/only the pinned manifest/)
  })

  it('requires the canonical compatibility manifest path', () => {
    expect(() =>
      validateReleaseSoakState({
        ...validState(),
        manifestRelativePath: 'e2e/bridge/alternate.json',
        nioChangedFiles: ['e2e/bridge/alternate.json'],
      })
    ).toThrow(/release manifest must be/)
  })

  it('requires a regular, non-symlink compatibility manifest', () => {
    expect(
      validateReleaseManifestLocation({
        relativePath: MANIFEST,
        isFile: true,
        isSymbolicLink: false,
      })
    ).toBe(MANIFEST)
    expect(() =>
      validateReleaseManifestLocation({
        relativePath: MANIFEST,
        isFile: false,
        isSymbolicLink: true,
      })
    ).toThrow(/regular non-symlink/)
  })

  it('rejects an external or symlinked Extension build directory', () => {
    expect(
      validateReleaseBuildLocation({
        kind: 'chromium',
        actualPath: '/repo/packages/ext/dist/chromium',
        expectedPath: '/repo/packages/ext/dist/chromium',
        isSymbolicLink: false,
      })
    ).toBe('/repo/packages/ext/dist/chromium')
    expect(() =>
      validateReleaseBuildLocation({
        kind: 'chromium',
        actualPath: '/tmp/stale-build',
        expectedPath: '/repo/packages/ext/dist/chromium',
        isSymbolicLink: false,
      })
    ).toThrow(/inside the pinned Extension checkout/)
    expect(() =>
      validateReleaseBuildLocation({
        kind: 'firefox',
        actualPath: '/repo/packages/ext/dist/firefox',
        expectedPath: '/repo/packages/ext/dist/firefox',
        isSymbolicLink: true,
      })
    ).toThrow(/must not be a symbolic link/)
  })

  it('accepts exactly one hundred clean passed browser results', () => {
    expect(validateReleasePlaywrightReport(report())).toEqual({
      testEntries: 100,
      browserCases: 100,
      passed: 100,
      failed: 0,
    })
  })

  it('rejects missing, failed, or top-level-error browser evidence', () => {
    expect(() => validateReleasePlaywrightReport(report(99))).toThrow(
      /exactly 100/
    )
    expect(() =>
      validateReleasePlaywrightReport(report(100, 'failed'))
    ).toThrow(/exactly 100/)
    expect(() =>
      validateReleasePlaywrightReport({ ...report(), errors: [{}] })
    ).toThrow(/top-level errors/)
  })

  it('runs the normal soak with a JSON reporter and writes passing evidence', () => {
    const spawn = vi.fn(() => ({ status: 0 }))
    const writeEvidence = vi.fn(() => path.join(EVIDENCE_DIR, 'evidence.json'))
    const first = new Date('2026-08-31T00:00:00.000Z')
    const second = new Date('2026-08-31T00:12:24.000Z')
    const now = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)

    const result = runRemoteExtensionReleaseSoak({
      env: { NIODOWNLOADER_REMOTE_EXTENSION_SOAK_EVIDENCE_DIR: EVIDENCE_DIR },
      context: context(),
      spawn,
      now,
      writeEvidence,
      reportExists: () => true,
      validateReport: () => ({
        testEntries: 100,
        browserCases: 100,
        passed: 100,
        failed: 0,
      }),
      prepareEvidenceDirectory: () => {},
    })

    expect(spawn).toHaveBeenCalledWith(
      expect.stringMatching(/^pnpm(?:\.cmd)?$/u),
      ['test:e2e:remote-extension:soak'],
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({
          NIODOWNLOADER_REMOTE_EXTENSION_SOAK_REPEATS: '20',
          NIODOWNLOADER_REMOTE_EXTENSION_EVIDENCE_DIR: EVIDENCE_DIR,
        }),
      })
    )
    expect(result.evidence).toMatchObject({
      status: 'passed',
      repeats: 20,
      browserCases: 100,
      durationMs: 744_000,
    })
    expect(writeEvidence).toHaveBeenCalledOnce()
  })

  it('preflights, rebuilds both artifacts, then recollects their digests', () => {
    const collectContext = vi.fn(() => context())
    const prepareBuild = vi.fn()
    runRemoteExtensionReleaseSoak({
      env: { NIODOWNLOADER_REMOTE_EXTENSION_SOAK_EVIDENCE_DIR: EVIDENCE_DIR },
      collectContext,
      prepareBuild,
      spawn: () => ({ status: 0 }),
      now: () => new Date('2026-08-31T00:00:00.000Z'),
      writeEvidence: () => path.join(EVIDENCE_DIR, 'evidence.json'),
      reportExists: () => true,
      validateReport: () => ({
        testEntries: 100,
        browserCases: 100,
        passed: 100,
        failed: 0,
      }),
      prepareEvidenceDirectory: () => {},
    })

    expect(collectContext).toHaveBeenCalledTimes(2)
    expect(collectContext).toHaveBeenNthCalledWith(1, expect.anything(), {
      includeBuilds: false,
    })
    expect(collectContext).toHaveBeenNthCalledWith(2, expect.anything(), {
      includeBuilds: true,
    })
    expect(prepareBuild).toHaveBeenCalledOnce()
    expect(collectContext.mock.invocationCallOrder[0]).toBeLessThan(
      prepareBuild.mock.invocationCallOrder[0] ?? 0
    )
    expect(prepareBuild.mock.invocationCallOrder[0]).toBeLessThan(
      collectContext.mock.invocationCallOrder[1] ?? 0
    )
  })

  it('archives a failed result before rejecting it', () => {
    const writeEvidence = vi.fn(() => path.join(EVIDENCE_DIR, 'evidence.json'))
    expect(() =>
      runRemoteExtensionReleaseSoak({
        env: { NIODOWNLOADER_REMOTE_EXTENSION_SOAK_EVIDENCE_DIR: EVIDENCE_DIR },
        context: context(),
        spawn: () => ({ status: 1 }),
        now: () => new Date('2026-08-31T00:00:00.000Z'),
        writeEvidence,
        reportExists: () => true,
        prepareEvidenceDirectory: () => {},
      })
    ).toThrow(/release soak failed/)
    expect(writeEvidence).toHaveBeenCalledWith(
      EVIDENCE_DIR,
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('marks a zero-exit run incomplete when its JSON report is missing', () => {
    const writeEvidence = vi.fn(() => path.join(EVIDENCE_DIR, 'evidence.json'))
    expect(() =>
      runRemoteExtensionReleaseSoak({
        env: { NIODOWNLOADER_REMOTE_EXTENSION_SOAK_EVIDENCE_DIR: EVIDENCE_DIR },
        context: context(),
        spawn: () => ({ status: 0 }),
        now: () => new Date('2026-08-31T00:00:00.000Z'),
        writeEvidence,
        reportExists: () => false,
        prepareEvidenceDirectory: () => {},
      })
    ).toThrow(/JSON report missing/)
    expect(writeEvidence).toHaveBeenCalledWith(
      EVIDENCE_DIR,
      expect.objectContaining({
        status: 'incomplete',
        artifacts: expect.objectContaining({ reportPresent: false }),
      })
    )
  })

  it('marks a zero-exit run incomplete when the JSON report is not 100/100', () => {
    const writeEvidence = vi.fn(() => path.join(EVIDENCE_DIR, 'evidence.json'))
    expect(() =>
      runRemoteExtensionReleaseSoak({
        env: { NIODOWNLOADER_REMOTE_EXTENSION_SOAK_EVIDENCE_DIR: EVIDENCE_DIR },
        context: context(),
        spawn: () => ({ status: 0 }),
        now: () => new Date('2026-08-31T00:00:00.000Z'),
        writeEvidence,
        reportExists: () => true,
        validateReport: () => {
          throw new Error('expected 100 passed cases; got 99')
        },
        prepareEvidenceDirectory: () => {},
      })
    ).toThrow(/JSON report invalid/)
    expect(writeEvidence).toHaveBeenCalledWith(
      EVIDENCE_DIR,
      expect.objectContaining({
        status: 'incomplete',
        artifacts: expect.objectContaining({
          reportValidationError: expect.stringMatching(/got 99/),
        }),
      })
    )
  })
})
