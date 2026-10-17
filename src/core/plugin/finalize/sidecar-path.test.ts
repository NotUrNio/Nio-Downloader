import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveFinalizeSidecarPath } from './sidecar-path'

describe('resolveFinalizeSidecarPath', () => {
  it('uses an explicit absolute override first', () => {
    expect(
      resolveFinalizeSidecarPath({
        extraResourceDir: '/app/extra',
        isDev: false,
        env: { NIODOWNLOADER_FINALIZE_FS_BIN: '/custom/nio-finalize-fs' },
      })
    ).toBe('/custom/nio-finalize-fs')
  })

  it('rejects a relative override', () => {
    expect(() =>
      resolveFinalizeSidecarPath({
        extraResourceDir: '/app/extra',
        isDev: false,
        env: { NIODOWNLOADER_FINALIZE_FS_BIN: 'relative/finalize-fs' },
      })
    ).toThrow('must be an absolute path')
  })

  it('resolves the Electron development target', () => {
    expect(
      resolveFinalizeSidecarPath({
        extraResourceDir: '/repo/extra',
        isDev: true,
        env: {},
        platform: 'darwin',
        arch: 'arm64',
      })
    ).toBe(
      path.resolve(
        '/repo/packages/finalize-fs/dist/darwin-arm64/nio-finalize-fs'
      )
    )
  })

  it('uses the staged Server binary when it exists', () => {
    const expected = path.resolve('/stage/bin/nio-finalize-fs')
    expect(
      resolveFinalizeSidecarPath({
        extraResourceDir: '/stage/extra',
        isDev: false,
        env: {},
        platform: 'linux',
        arch: 'x64',
        runtimeRoot: '/stage',
        fileExists: (candidate) => candidate === expected,
      })
    ).toBe(expected)
  })

  it('uses the locally built Server binary from a normal checkout', () => {
    const local = path.resolve(
      '/repo/packages/finalize-fs/dist/linux-x64/nio-finalize-fs'
    )
    expect(
      resolveFinalizeSidecarPath({
        extraResourceDir: '/usr/share/niodownloader/extra',
        isDev: false,
        env: {},
        platform: 'linux',
        arch: 'x64',
        runtimeRoot: '/repo',
        fileExists: (candidate) => candidate === local,
      })
    ).toBe(local)
  })

  it('keeps the packaged path when no verified local binary exists', () => {
    expect(
      resolveFinalizeSidecarPath({
        extraResourceDir: '/usr/share/niodownloader/extra',
        isDev: false,
        env: {},
        platform: 'linux',
        arch: 'x64',
        runtimeRoot: '/repo',
        fileExists: () => false,
      })
    ).toBe(path.resolve('/usr/share/niodownloader/bin/nio-finalize-fs'))
  })
})
