import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/home/u' },
}))

import {
  detectLinuxPackageKind,
  getLinuxDefaultAssociations,
  setLinuxDefaultTorrentHandler,
} from './linux-default-apps'

const NATIVE_ENTRY =
  '[Desktop Entry]\nType=Application\nExec=/opt/Nio-Downloader/nio-downloader %U\n'
const PACKAGE_ENTRY =
  '[Desktop Entry]\nType=Application\nExec=/app/bin/nio-downloader %U\n'

describe('Linux default app integration', () => {
  it.each([
    [{ APPIMAGE: '/apps/Nio-Downloader.AppImage' }, true, 'appimage'],
    [{ FLATPAK_ID: 'app.niodownloader.native' }, true, 'flatpak'],
    [{ SNAP: '/snap/nio-downloader/current' }, true, 'snap'],
    [{}, true, 'native'],
    [{}, false, 'unknown'],
  ] as const)('detects package kind', (env, packaged, expected) => {
    expect(detectLinuxPackageKind(env, packaged)).toBe(expected)
  })

  it('reports unsupported outside packaged Linux', async () => {
    await expect(
      getLinuxDefaultAssociations({ platform: 'darwin', packaged: true })
    ).resolves.toMatchObject({ supported: false, packageKind: null })
    await expect(
      getLinuxDefaultAssociations({ platform: 'linux', packaged: false })
    ).resolves.toMatchObject({ supported: false, packageKind: null })
  })

  it('reports native defaults against an installed desktop id', async () => {
    const queryDefault = vi.fn(async (mime: string) => ({
      ok: true,
      id:
        mime === 'application/x-bittorrent'
          ? 'nio-downloader.desktop'
          : 'org.qbittorrent.qBittorrent.desktop',
    }))

    await expect(
      getLinuxDefaultAssociations({
        platform: 'linux',
        packaged: true,
        env: {},
        home: '/home/u',
        currentExecutable: '/opt/Nio-Downloader/nio-downloader',
        readDesktopFile: vi.fn(async (filePath) =>
          filePath.endsWith('/nio-downloader.desktop') ? NATIVE_ENTRY : null
        ),
        queryDefault,
      })
    ).resolves.toEqual({
      supported: true,
      packageKind: 'native',
      registered: true,
      canSetTorrentDefault: true,
      torrent: true,
      magnet: false,
    })
  })

  it('recognizes AppImage and Flatpak desktop ids', async () => {
    const readDesktopFile = vi.fn(async () => PACKAGE_ENTRY)
    const queryDefault = vi.fn(async () => ({
      ok: true,
      id: 'nio-appimage.desktop',
    }))
    await expect(
      getLinuxDefaultAssociations({
        platform: 'linux',
        packaged: true,
        env: { APPIMAGE: '/apps/Nio-Downloader.AppImage' },
        home: '/home/u',
        readDesktopFile,
        queryDefault,
      })
    ).resolves.toMatchObject({
      packageKind: 'appimage',
      registered: true,
      canSetTorrentDefault: false,
      torrent: true,
      magnet: true,
    })

    await expect(
      getLinuxDefaultAssociations({
        platform: 'linux',
        packaged: true,
        env: { FLATPAK_ID: 'app.niodownloader.native' },
        home: '/home/u',
        readDesktopFile,
        queryDefault: vi.fn(async () => ({
          ok: true,
          id: 'app.niodownloader.native.desktop',
        })),
      })
    ).resolves.toMatchObject({
      packageKind: 'flatpak',
      registered: true,
      canSetTorrentDefault: false,
      torrent: true,
    })
  })

  it('maps a confined Snap desktop source to its host-exported id', async () => {
    await expect(
      getLinuxDefaultAssociations({
        platform: 'linux',
        packaged: true,
        env: {
          SNAP: '/snap/nio-downloader/current',
          SNAP_INSTANCE_NAME: 'nio-downloader',
        },
        home: '/home/u',
        readDesktopFile: vi.fn(async (filePath) =>
          filePath.endsWith('/meta/gui/nio-downloader.desktop')
            ? PACKAGE_ENTRY
            : null
        ),
        queryDefault: vi.fn(async () => ({
          ok: true,
          id: 'nio-downloader_nio-downloader.desktop',
        })),
      })
    ).resolves.toMatchObject({
      packageKind: 'snap',
      registered: true,
      torrent: true,
      magnet: true,
    })
  })

  it('distinguishes an unreadable default from not being default', async () => {
    await expect(
      getLinuxDefaultAssociations({
        platform: 'linux',
        packaged: true,
        env: {},
        home: '/home/u',
        currentExecutable: '/opt/Nio-Downloader/nio-downloader',
        readDesktopFile: vi.fn(async (filePath) =>
          filePath.endsWith('/nio-downloader.desktop') ? NATIVE_ENTRY : null
        ),
        queryDefault: vi.fn(async () => ({ ok: false, id: null })),
      })
    ).resolves.toMatchObject({ torrent: null, magnet: null })
  })

  it('sets and verifies the native torrent default', async () => {
    let torrentDefault = 'other.desktop'
    const deps = {
      platform: 'linux' as const,
      packaged: true,
      env: {},
      home: '/home/u',
      currentExecutable: '/opt/Nio-Downloader/nio-downloader',
      readDesktopFile: vi.fn(async (filePath: string) =>
        filePath.endsWith('/nio-downloader.desktop') ? NATIVE_ENTRY : null
      ),
      queryDefault: vi.fn(async (mime: string) => ({
        ok: true,
        id:
          mime === 'application/x-bittorrent'
            ? torrentDefault
            : 'other.desktop',
      })),
      setDefault: vi.fn(async (desktopId: string) => {
        torrentDefault = desktopId
        return true
      }),
    }

    await expect(setLinuxDefaultTorrentHandler(deps)).resolves.toMatchObject({
      torrent: true,
    })
    expect(deps.setDefault).toHaveBeenCalledWith(
      'nio-downloader.desktop',
      'application/x-bittorrent'
    )
  })

  it('does not bypass AppImage or sandbox package ownership', async () => {
    await expect(
      setLinuxDefaultTorrentHandler({
        platform: 'linux',
        packaged: true,
        env: { APPIMAGE: '/apps/Nio-Downloader.AppImage' },
        home: '/home/u',
        readDesktopFile: vi.fn(async () => PACKAGE_ENTRY),
        queryDefault: vi.fn(async () => ({ ok: true, id: null })),
      })
    ).rejects.toThrow('does not support direct default selection')
  })

  it('rejects a stale user desktop entry that shadows the native package', async () => {
    const readDesktopFile = vi.fn(async (filePath: string) => {
      if (
        filePath === '/home/u/.local/share/applications/nio-downloader.desktop'
      ) {
        return '[Desktop Entry]\nType=Application\nExec=/old/Nio-Downloader.AppImage %U\n'
      }
      if (filePath === '/usr/share/applications/nio-downloader.desktop') {
        return NATIVE_ENTRY
      }
      return null
    })

    await expect(
      getLinuxDefaultAssociations({
        platform: 'linux',
        packaged: true,
        env: {},
        home: '/home/u',
        currentExecutable: '/opt/Nio-Downloader/nio-downloader',
        readDesktopFile,
        queryDefault: vi.fn(async () => ({
          ok: true,
          id: 'nio-downloader.desktop',
        })),
      })
    ).resolves.toMatchObject({
      registered: false,
      canSetTorrentDefault: false,
      torrent: false,
      magnet: false,
    })
    expect(readDesktopFile).not.toHaveBeenCalledWith(
      '/usr/share/applications/nio-downloader.desktop'
    )
  })

  it('does not attribute a concurrent native Nio Downloader default to Snap', async () => {
    await expect(
      getLinuxDefaultAssociations({
        platform: 'linux',
        packaged: true,
        env: {
          SNAP: '/snap/nio-downloader/current',
          SNAP_INSTANCE_NAME: 'nio-downloader',
        },
        home: '/home/u',
        readDesktopFile: vi.fn(async (filePath) =>
          filePath.endsWith('/meta/gui/nio-downloader.desktop')
            ? PACKAGE_ENTRY
            : null
        ),
        queryDefault: vi.fn(async () => ({
          ok: true,
          id: 'nio-downloader.desktop',
        })),
      })
    ).resolves.toMatchObject({
      packageKind: 'snap',
      registered: true,
      torrent: false,
      magnet: false,
    })
  })
})
