import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error — .mjs without types
import {
  ensureMacosDevBundle,
  resolveElectronAppPath,
  updatePlistContent,
} from '../../scripts/ensure-macos-dev-bundle.mjs'

const SAMPLE_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDisplayName</key>
\t<string>Electron</string>
\t<key>CFBundleExecutable</key>
\t<string>Electron</string>
\t<key>CFBundleName</key>
\t<string>Electron</string>
\t<key>CFBundlePackageType</key>
\t<string>APPL</string>
</dict>
</plist>
`

describe('updatePlistContent', () => {
  it('updates CFBundleName and CFBundleDisplayName when they differ from appName', () => {
    const { updatedContent, changed } = updatePlistContent(
      SAMPLE_PLIST,
      'Nio Downloader'
    )
    expect(changed).toBe(true)
    expect(updatedContent).toContain(
      '<key>CFBundleName</key>\n\t<string>Nio Downloader</string>'
    )
    expect(updatedContent).toContain(
      '<key>CFBundleDisplayName</key>\n\t<string>Nio Downloader</string>'
    )
    expect(updatedContent).not.toContain(
      '<key>CFBundleName</key>\n\t<string>Electron</string>'
    )
    expect(updatedContent).not.toContain(
      '<key>CFBundleDisplayName</key>\n\t<string>Electron</string>'
    )
    expect(updatedContent).toContain(
      '<key>CFBundleExecutable</key>\n\t<string>Electron</string>'
    )
  })

  it('is idempotent when CFBundleName and CFBundleDisplayName are already set', () => {
    const { updatedContent: firstPass, changed: firstChanged } =
      updatePlistContent(SAMPLE_PLIST, 'Nio Downloader')
    expect(firstChanged).toBe(true)

    const { updatedContent: secondPass, changed: secondChanged } =
      updatePlistContent(firstPass, 'Nio Downloader')
    expect(secondChanged).toBe(false)
    expect(secondPass).toBe(firstPass)
  })

  it('inserts missing keys into dict if they are not present', () => {
    const strippedPlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
\t<key>CFBundleExecutable</key>
\t<string>Electron</string>
</dict>
</plist>
`
    const { updatedContent, changed } = updatePlistContent(
      strippedPlist,
      'Nio Downloader'
    )
    expect(changed).toBe(true)
    expect(updatedContent).toContain(
      '<key>CFBundleName</key>\n\t<string>Nio Downloader</string>'
    )
    expect(updatedContent).toContain(
      '<key>CFBundleDisplayName</key>\n\t<string>Nio Downloader</string>'
    )
  })
})

describe('resolveElectronAppPath', () => {
  it('resolves Electron.app path from electron binary location', () => {
    const binary = '/path/to/dist/Electron.app/Contents/MacOS/Electron'
    const appPath = resolveElectronAppPath(binary)
    expect(appPath).toBe(path.resolve('/path/to/dist/Electron.app'))
  })

  it('returns null if binary path does not point inside Electron.app', () => {
    const binary = '/usr/local/bin/electron'
    const appPath = resolveElectronAppPath(binary)
    expect(appPath).toBeNull()
  })
})

describe('ensureMacosDevBundle', () => {
  it('skips on non-macOS platforms', () => {
    const spawn = vi.fn()
    const fs = {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
    }

    const result = ensureMacosDevBundle({
      platform: 'linux',
      isCi: false,
      spawn,
      fs,
    })

    expect(result).toEqual({ skipped: true, reason: 'non-macOS' })
    expect(spawn).not.toHaveBeenCalled()
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })

  it('skips when running in CI', () => {
    const spawn = vi.fn()
    const fs = {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
    }

    const result = ensureMacosDevBundle({
      platform: 'darwin',
      isCi: true,
      spawn,
      fs,
    })

    expect(result).toEqual({ skipped: true, reason: 'CI' })
    expect(spawn).not.toHaveBeenCalled()
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })

  it('updates plist and codesigns when plist differs, but is idempotent on second run', () => {
    let currentPlist = SAMPLE_PLIST
    const appPath = '/mock/node_modules/electron/dist/Electron.app'
    const plistPath = path.join(appPath, 'Contents', 'Info.plist')

    const fs = {
      existsSync: vi.fn((target: string) => target === plistPath),
      readFileSync: vi.fn(() => currentPlist),
      writeFileSync: vi.fn((_target: string, content: string) => {
        currentPlist = content
      }),
    }

    const spawn = vi.fn(() => ({ status: 0, signal: null }))
    const log = vi.fn()

    // First run: plist differs, should write file and codesign
    const firstResult = ensureMacosDevBundle({
      platform: 'darwin',
      isCi: false,
      appPath,
      plistPath,
      fs,
      spawn,
      log,
    })

    expect(firstResult).toEqual({ updated: true, reSigned: true })
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(
      'codesign',
      ['--force', '--deep', '--sign', '-', appPath],
      { stdio: 'pipe' }
    )
    expect(currentPlist).toContain('<string>Nio Downloader</string>')

    // Second run: plist already has "Nio Downloader", must not write or codesign
    spawn.mockClear()
    fs.writeFileSync.mockClear()

    const secondResult = ensureMacosDevBundle({
      platform: 'darwin',
      isCi: false,
      appPath,
      plistPath,
      fs,
      spawn,
      log,
    })

    expect(secondResult).toEqual({ updated: false, reSigned: false })
    expect(fs.writeFileSync).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
  })

  it('fails soft when codesign fails, without throwing', () => {
    const appPath = '/mock/node_modules/electron/dist/Electron.app'
    const plistPath = path.join(appPath, 'Contents', 'Info.plist')

    const fs = {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => SAMPLE_PLIST),
      writeFileSync: vi.fn(),
    }

    const spawn = vi.fn(() => ({
      status: 1,
      signal: null,
      stderr: Buffer.from('codesign: permission denied'),
    }))
    const logWarn = vi.fn()

    const result = ensureMacosDevBundle({
      platform: 'darwin',
      isCi: false,
      appPath,
      plistPath,
      fs,
      spawn,
      logWarn,
    })

    expect(result.updated).toBe(true)
    expect(result.reSigned).toBe(false)
    expect(result.error).toContain('codesign: permission denied')
    expect(logWarn).toHaveBeenCalledWith(
      expect.stringContaining('codesign failed')
    )
  })

  it('fails soft when reading Info.plist throws', () => {
    const appPath = '/mock/node_modules/electron/dist/Electron.app'
    const plistPath = path.join(appPath, 'Contents', 'Info.plist')

    const fs = {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => {
        throw new Error('EACCES: permission denied')
      }),
      writeFileSync: vi.fn(),
    }

    const logWarn = vi.fn()

    const result = ensureMacosDevBundle({
      platform: 'darwin',
      isCi: false,
      appPath,
      plistPath,
      fs,
      logWarn,
    })

    expect(result.updated).toBe(false)
    expect(result.reSigned).toBe(false)
    expect(logWarn).toHaveBeenCalledWith(
      expect.stringContaining('permission denied')
    )
  })
})
