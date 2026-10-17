import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeManifestPaths,
  computeRegistryEntries,
  DEVELOPMENT_HOST_CONFIG_NAME,
  NativeMessagingInstaller,
  type RegistryEntry,
  type RegistryView,
} from './native-messaging-installer'

describe('computeManifestPaths', () => {
  it('returns correct macOS Chrome path', () => {
    const paths = computeManifestPaths('darwin', '/Users/me')
    expect(paths.chrome).toContain(
      '/Users/me/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.nio.downloader.host.json'
    )
    expect(paths.firefox).toContain(
      '/Users/me/Library/Application Support/Mozilla/NativeMessagingHosts/com.nio.downloader.host.json'
    )
    expect(paths.chromium).toBeUndefined()
  })

  it('returns correct Linux paths', () => {
    const paths = computeManifestPaths('linux', '/home/me')
    expect(paths.chrome).toContain(
      '/home/me/.config/google-chrome/NativeMessagingHosts/com.nio.downloader.host.json'
    )
    expect(paths.chromium).toContain(
      '/home/me/.config/chromium/NativeMessagingHosts/com.nio.downloader.host.json'
    )
    expect(paths.firefox).toContain(
      '/home/me/.mozilla/native-messaging-hosts/com.nio.downloader.host.json'
    )
  })
})

describe('NativeMessagingInstaller.syncManifests', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nio-nm-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes Chrome manifest with correct allowed_origins', async () => {
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/path/to/nio-native-host',
      manifestRoot: dir,
      platform: 'darwin',
    })
    await installer.syncManifests({
      chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })
    const chromeContent = JSON.parse(
      await readFile(
        join(
          dir,
          'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.nio.downloader.host.json'
        ),
        'utf-8'
      )
    )
    expect(chromeContent.name).toBe('com.nio.downloader.host')
    expect(chromeContent.path).toBe('/path/to/nio-native-host')
    expect(chromeContent.allowed_origins).toContain(
      'chrome-extension://lggbokfckofcgjndaboioakcmincinpo/'
    )
  })

  it("binds a development host to Electron's selected bridge directory", async () => {
    const hostBinaryPath = join(dir, 'native-host', 'nio-native-host')
    const developmentBridgeDataDir = join(dir, 'Nio-Downloader-dev', 'bridge')
    const installer = new NativeMessagingInstaller({
      hostBinaryPath,
      manifestRoot: dir,
      platform: 'darwin',
      developmentBridgeDataDir,
    })

    await installer.syncManifests({
      chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })

    const configPath = join(
      dirname(hostBinaryPath),
      DEVELOPMENT_HOST_CONFIG_NAME
    )
    expect(JSON.parse(await readFile(configPath, 'utf-8'))).toEqual({
      bridgeDataDir: developmentBridgeDataDir,
    })
    if (process.platform !== 'win32') {
      expect((await stat(configPath)).mode & 0o777).toBe(0o600)
    }

    await installer.unregister()
    await expect(readFile(configPath, 'utf-8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('writes the chromium-family manifest to the Debian Chromium path on Linux', async () => {
    const hostBinaryPath = '/opt/Nio-Downloader/resources/bin/nio-native-host'
    const installer = new NativeMessagingInstaller({
      hostBinaryPath,
      manifestRoot: dir,
      platform: 'linux',
    })
    await installer.syncManifests({
      chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })
    const chromium = JSON.parse(
      await readFile(
        join(
          dir,
          '.config/chromium/NativeMessagingHosts/com.nio.downloader.host.json'
        ),
        'utf-8'
      )
    )
    expect(chromium.name).toBe('com.nio.downloader.host')
    expect(chromium.path).toBe(hostBinaryPath)
    expect(chromium.allowed_origins).toEqual([
      'chrome-extension://lggbokfckofcgjndaboioakcmincinpo/',
    ])
  })

  it('writes Firefox manifest with allowed_extensions', async () => {
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/path/to/nio-native-host',
      manifestRoot: dir,
      platform: 'darwin',
    })
    await installer.syncManifests({
      chromium: [],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })
    const ff = JSON.parse(
      await readFile(
        join(
          dir,
          'Library/Application Support/Mozilla/NativeMessagingHosts/com.nio.downloader.host.json'
        ),
        'utf-8'
      )
    )
    expect(ff.allowed_extensions).toEqual([
      'nio-downloader-extension@mozilla.org',
    ])
  })

  it('leaves host-side manifests to an external Flatpak companion', async () => {
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/app/bin/nio-native-host',
      manifestRoot: dir,
      platform: 'linux',
      registrationMode: 'external',
    })
    const paths = computeManifestPaths('linux', dir)
    const chromiumSentinel = Buffer.from('companion-owned-chromium')
    const firefoxSentinel = Buffer.from('companion-owned-firefox')
    await mkdir(dirname(paths.chrome), { recursive: true })
    await mkdir(dirname(paths.firefox), { recursive: true })
    await writeFile(paths.chrome, chromiumSentinel)
    await writeFile(paths.firefox, firefoxSentinel)

    await installer.syncManifests({
      chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })
    await installer.unregister()

    expect(await readFile(paths.chrome)).toEqual(chromiumSentinel)
    expect(await readFile(paths.firefox)).toEqual(firefoxSentinel)
  })

  it('does not replace manifests owned by an installed Flatpak companion', async () => {
    const paths = computeManifestPaths('linux', dir)
    const flatpakManifest = {
      name: 'com.nio.downloader.host',
      description: 'Nio Downloader browser download bridge',
      path: `${dir}/.local/share/niodownloader/native-messaging/nio-flatpak-native-host`,
      type: 'stdio',
      allowed_origins: ['chrome-extension://lggbokfckofcgjndaboioakcmincinpo/'],
    }
    await mkdir(dirname(paths.chrome), { recursive: true })
    await writeFile(paths.chrome, JSON.stringify(flatpakManifest))

    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/opt/Nio-Downloader/resources/bin/nio-native-host',
      manifestRoot: dir,
      platform: 'linux',
    })
    await installer.syncManifests({
      chromium: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })

    expect(JSON.parse(await readFile(paths.chrome, 'utf-8'))).toEqual(
      flatpakManifest
    )
    await installer.unregister()
    expect(JSON.parse(await readFile(paths.chrome, 'utf-8'))).toEqual(
      flatpakManifest
    )
  })

  it('preserves an unowned file that only resembles a companion manifest', async () => {
    const paths = computeManifestPaths('linux', dir)
    await mkdir(dirname(paths.chrome), { recursive: true })
    await writeFile(
      paths.chrome,
      JSON.stringify({
        name: 'com.nio.downloader.host',
        path: '/tmp/nio-flatpak-native-host',
      })
    )

    const hostBinaryPath = '/opt/Nio-Downloader/resources/bin/nio-native-host'
    const installer = new NativeMessagingInstaller({
      hostBinaryPath,
      manifestRoot: dir,
      platform: 'linux',
    })
    const result = await installer.syncManifests({
      chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })
    expect(result.failures).toEqual([
      {
        browser: 'chrome',
        path: paths.chrome,
        operation: 'manifest',
        error: expect.any(Error),
      },
    ])
    expect(result.failures[0]?.error).toMatchObject({
      message: 'Native Messaging manifest conflict',
    })
    expect(JSON.parse(await readFile(paths.firefox, 'utf-8')).path).toBe(
      hostBinaryPath
    )

    expect(JSON.parse(await readFile(paths.chrome, 'utf-8')).path).toBe(
      '/tmp/nio-flatpak-native-host'
    )
  })

  it('unregisters only manifests that still point to its own host', async () => {
    const paths = computeManifestPaths('linux', dir)
    const hostBinaryPath = '/opt/Nio-Downloader/resources/bin/nio-native-host'
    const installer = new NativeMessagingInstaller({
      hostBinaryPath,
      manifestRoot: dir,
      platform: 'linux',
    })
    await installer.syncManifests({
      chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })

    const replacement = {
      name: 'com.nio.downloader.host',
      path: `${dir}/.local/share/niodownloader/native-messaging/nio-flatpak-native-host`,
    }
    await writeFile(paths.chrome, JSON.stringify(replacement))
    await installer.unregister()

    expect(JSON.parse(await readFile(paths.chrome, 'utf-8'))).toEqual(
      replacement
    )
    await expect(readFile(paths.chromium!, 'utf-8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
    await expect(readFile(paths.firefox, 'utf-8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it.each(['chrome', 'edge', 'firefox'] as const)(
    'continues after a blocked %s directory and repairs it on retry',
    async (browser) => {
      const paths = computeManifestPaths('darwin', dir)
      const blocked = dirname(paths[browser]!)
      await mkdir(dirname(blocked), { recursive: true })
      await writeFile(blocked, 'not a directory')
      const installer = new NativeMessagingInstaller({
        hostBinaryPath: '/path/to/native-host',
        manifestRoot: dir,
        platform: 'darwin',
      })
      const ids = {
        chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
        firefox: ['nio-downloader-extension@mozilla.org'],
      }
      const result = await installer.syncManifests(ids)
      expect(result.failures).toEqual([
        {
          browser,
          path: paths[browser],
          operation: 'manifest',
          error: expect.any(Error),
        },
      ])
      for (const [other, path] of Object.entries(paths)) {
        if (other !== browser)
          expect(JSON.parse(await readFile(path, 'utf-8')).name).toBe(
            'com.nio.downloader.host'
          )
      }
      expect(await readFile(blocked, 'utf-8')).toBe('not a directory')
      await rm(blocked)
      expect(await installer.syncManifests(ids)).toEqual({ failures: [] })
      expect(JSON.parse(await readFile(paths[browser]!, 'utf-8')).name).toBe(
        'com.nio.downloader.host'
      )
    }
  )

  it('reports every blocked browser when all target directories fail', async () => {
    const paths = computeManifestPaths('darwin', dir)
    for (const path of Object.values(paths)) {
      await mkdir(dirname(dirname(path)), { recursive: true })
      await writeFile(dirname(path), 'blocked')
    }
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/path/to/native-host',
      manifestRoot: dir,
      platform: 'darwin',
    })
    const result = await installer.syncManifests({ chromium: [], firefox: [] })
    expect(result.failures.map((failure) => failure.browser)).toEqual([
      'chrome',
      'edge',
      'firefox',
    ])
  })

  it('continues after an atomic manifest write fails', async () => {
    const paths = computeManifestPaths('darwin', dir)
    await mkdir(paths.edge!, { recursive: true })
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/path/to/native-host',
      manifestRoot: dir,
      platform: 'darwin',
    })
    const result = await installer.syncManifests({ chromium: [], firefox: [] })
    expect(result.failures).toEqual([
      {
        browser: 'edge',
        path: paths.edge,
        operation: 'manifest',
        error: expect.any(Error),
      },
    ])
    expect((await stat(paths.edge!)).isDirectory()).toBe(true)
    expect(JSON.parse(await readFile(paths.firefox, 'utf-8')).name).toBe(
      'com.nio.downloader.host'
    )
  })
})

describe('computeManifestPaths (win32)', () => {
  it('returns private-folder JSON paths for Chrome, Edge, and Firefox', () => {
    const paths = computeManifestPaths('win32', 'C:/Users/me')
    expect(paths.chrome).toBe(
      join(
        'C:/Users/me/AppData/Roaming',
        'Nio Downloader/bridge/manifests/chrome.json'
      )
    )
    expect(paths.edge).toBe(
      join(
        'C:/Users/me/AppData/Roaming',
        'Nio Downloader/bridge/manifests/edge.json'
      )
    )
    expect(paths.firefox).toBe(
      join(
        'C:/Users/me/AppData/Roaming',
        'Nio Downloader/bridge/manifests/firefox.json'
      )
    )
  })

  it('uses the resolved Roaming AppData folder when it is redirected', () => {
    const paths = computeManifestPaths(
      'win32',
      'C:/Users/me',
      'Z:/Profiles/me/Roaming'
    )

    expect(paths.chrome).toBe(
      join(
        'Z:/Profiles/me/Roaming',
        'Nio Downloader/bridge/manifests/chrome.json'
      )
    )
    expect(paths.edge).toBe(
      join(
        'Z:/Profiles/me/Roaming',
        'Nio Downloader/bridge/manifests/edge.json'
      )
    )
    expect(paths.firefox).toBe(
      join(
        'Z:/Profiles/me/Roaming',
        'Nio Downloader/bridge/manifests/firefox.json'
      )
    )
  })
})

describe('computeRegistryEntries', () => {
  it('returns no entries on non-Windows platforms', () => {
    const paths = computeManifestPaths('darwin', '/Users/me')
    expect(computeRegistryEntries('darwin', paths)).toEqual([])
    expect(
      computeRegistryEntries('linux', computeManifestPaths('linux', '/home/me'))
    ).toEqual([])
  })

  it('registers Chrome and Edge under their own HKCU keys pointing at the JSON files', () => {
    const paths = computeManifestPaths('win32', 'C:/Users/me')
    const entries = computeRegistryEntries('win32', paths)

    expect(entries).toContainEqual({
      hive: 'HKCU',
      keyPath:
        'SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.nio.downloader.host',
      value: paths.chrome,
    })
    expect(entries).toContainEqual({
      hive: 'HKCU',
      keyPath:
        'SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\com.nio.downloader.host',
      value: paths.edge,
    })
  })

  it('also registers the Firefox host under the Mozilla key', () => {
    const paths = computeManifestPaths('win32', 'C:/Users/me')
    const entries = computeRegistryEntries('win32', paths)
    expect(entries).toContainEqual({
      hive: 'HKCU',
      keyPath:
        'SOFTWARE\\Mozilla\\NativeMessagingHosts\\com.nio.downloader.host',
      value: paths.firefox,
    })
  })
})

describe('NativeMessagingInstaller.syncManifests (win32)', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nio-nm-win-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes the Edge manifest with both store IDs in allowed_origins', async () => {
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: 'C:/Program Files/Nio Downloader/bin/nio-native-host.exe',
      manifestRoot: dir,
      platform: 'win32',
      registryWriter: async () => {},
    })
    await installer.syncManifests({
      chromium: [
        'chromewebstoreidaaaaaaaaaaaaaaaa',
        'edgeaddonsidbbbbbbbbbbbbbbbbbbbb',
      ],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })
    const edge = JSON.parse(
      await readFile(
        join(dir, 'AppData/Roaming/Nio Downloader/bridge/manifests/edge.json'),
        'utf-8'
      )
    )
    expect(edge.name).toBe('com.nio.downloader.host')
    expect(edge.allowed_origins).toEqual([
      'chrome-extension://chromewebstoreidaaaaaaaaaaaaaaaa/',
      'chrome-extension://edgeaddonsidbbbbbbbbbbbbbbbbbbbb/',
    ])
  })

  it('registers Chrome and Edge native-messaging hosts in the registry', async () => {
    const written: Array<{ entry: RegistryEntry; view: RegistryView }> = []
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: 'C:/Program Files/Nio Downloader/bin/nio-native-host.exe',
      manifestRoot: dir,
      platform: 'win32',
      registryWriter: async (entry, view) => {
        written.push({ entry, view })
      },
    })
    await installer.syncManifests({
      chromium: [
        'chromewebstoreidaaaaaaaaaaaaaaaa',
        'edgeaddonsidbbbbbbbbbbbbbbbbbbbb',
      ],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })

    const keyPaths = written.map(({ entry }) => entry.keyPath)
    expect(keyPaths).toContain(
      'SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.nio.downloader.host'
    )
    expect(keyPaths).toContain(
      'SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\com.nio.downloader.host'
    )
    expect(written.every(({ entry }) => entry.hive === 'HKCU')).toBe(true)
    expect(
      written
        .filter(({ entry }) =>
          entry.keyPath.includes('Google\\Chrome\\NativeMessagingHosts')
        )
        .map(({ view }) => view)
    ).toEqual(['32', '64'])
  })

  it('does not touch the registry on macOS', async () => {
    const written: RegistryEntry[] = []
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/path/to/nio-native-host',
      manifestRoot: dir,
      platform: 'darwin',
      registryWriter: async (entry) => {
        written.push(entry)
      },
    })
    await installer.syncManifests({
      chromium: ['lggbokfckofcgjndaboioakcmincinpo'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })
    expect(written).toEqual([])
  })

  it('isolates a denied registry view and still registers every other target', async () => {
    const error = Object.assign(new Error('denied'), { code: 'EPERM' })
    const registryWriter = vi.fn(
      async (entry: RegistryEntry, view: RegistryView) => {
        if (entry.keyPath.includes('Google') && view === '32') throw error
      }
    )
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/native-host.exe',
      manifestRoot: dir,
      platform: 'win32',
      registryWriter,
    })
    const result = await installer.syncManifests({ chromium: [], firefox: [] })
    expect(registryWriter).toHaveBeenCalledTimes(8)
    expect(result.failures).toEqual([
      {
        browser: 'chrome',
        path: 'HKCU\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.nio.downloader.host',
        operation: 'registry',
        registryView: '32',
        error,
      },
    ])
  })

  it('does not register a failed manifest but still registers later browsers', async () => {
    const paths = computeManifestPaths('win32', dir)
    await mkdir(paths.edge!, { recursive: true })
    const registryWriter = vi.fn(async () => {})
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/native-host.exe',
      manifestRoot: dir,
      platform: 'win32',
      registryWriter,
    })
    const result = await installer.syncManifests({ chromium: [], firefox: [] })
    expect(result.failures.map((failure) => failure.browser)).toEqual(['edge'])
    expect(registryWriter).toHaveBeenCalledTimes(6)
    expect(registryWriter).not.toHaveBeenCalledWith(
      expect.objectContaining({ value: paths.edge }),
      expect.anything()
    )
  })

  it('cleans other registry entries and manifests even when one removal fails', async () => {
    const error = new Error('registry denied')
    const registryDeleter = vi.fn(
      async (entry: RegistryEntry, view: RegistryView) => {
        if (entry.keyPath.includes('Google') && view === '32') throw error
      }
    )
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: '/native-host.exe',
      manifestRoot: dir,
      platform: 'win32',
      registryWriter: async () => {},
      registryDeleter,
    })
    await installer.syncManifests({ chromium: [], firefox: [] })
    await expect(installer.unregister()).rejects.toMatchObject({
      errors: [error],
    })
    expect(registryDeleter).toHaveBeenCalledTimes(8)
    for (const path of Object.values(computeManifestPaths('win32', dir))) {
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
    }
  })

  it('unregisters all Windows hosts and removes their manifests', async () => {
    const deleted: Array<{ entry: RegistryEntry; view: RegistryView }> = []
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: 'C:/Program Files/Nio Downloader/bin/nio-native-host.exe',
      manifestRoot: dir,
      platform: 'win32',
      registryWriter: async () => {},
      registryDeleter: async (entry, view) => {
        deleted.push({ entry, view })
      },
    })
    await installer.syncManifests({
      chromium: ['chromewebstoreidaaaaaaaaaaaaaaaa'],
      firefox: ['nio-downloader-extension@mozilla.org'],
    })

    await installer.unregister()

    expect(
      deleted.map(({ entry, view }) => `${view}:${entry.keyPath}`)
    ).toEqual([
      '32:SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.nio.downloader.host',
      '64:SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.nio.downloader.host',
      '32:SOFTWARE\\Mozilla\\NativeMessagingHosts\\com.nio.downloader.host',
      '64:SOFTWARE\\Mozilla\\NativeMessagingHosts\\com.nio.downloader.host',
      '32:SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\com.nio.downloader.host',
      '64:SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\com.nio.downloader.host',
      '32:SOFTWARE\\Opera Software\\NativeMessagingHosts\\com.nio.downloader.host',
      '64:SOFTWARE\\Opera Software\\NativeMessagingHosts\\com.nio.downloader.host',
    ])
    await expect(
      readFile(
        join(
          dir,
          'AppData/Roaming/Nio Downloader/bridge/manifests/chrome.json'
        ),
        'utf-8'
      )
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      readFile(
        join(dir, 'AppData/Roaming/Nio Downloader/bridge/manifests/edge.json'),
        'utf-8'
      )
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      readFile(
        join(
          dir,
          'AppData/Roaming/Nio Downloader/bridge/manifests/firefox.json'
        ),
        'utf-8'
      )
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('can unregister repeatedly when manifests are already absent', async () => {
    const installer = new NativeMessagingInstaller({
      hostBinaryPath: 'C:/Program Files/Nio Downloader/bin/nio-native-host.exe',
      manifestRoot: dir,
      platform: 'win32',
      registryDeleter: async () => {},
    })

    await installer.unregister()
    await installer.unregister()
  })
})
