import { describe, expect, it } from 'vitest'
import {
  isPackagedLinuxFlatpak,
  NIODOWNLOADER_FLATPAK_ID,
} from './flatpak-environment'

describe('isPackagedLinuxFlatpak', () => {
  it('recognizes the packaged Nio Downloader Flatpak', () => {
    expect(
      isPackagedLinuxFlatpak({
        platform: 'linux',
        isPackaged: true,
        env: { FLATPAK_ID: NIODOWNLOADER_FLATPAK_ID },
      })
    ).toBe(true)
  })

  it.each([
    {
      platform: 'linux' as const,
      isPackaged: false,
      env: { FLATPAK_ID: NIODOWNLOADER_FLATPAK_ID },
    },
    {
      platform: 'darwin' as const,
      isPackaged: true,
      env: { FLATPAK_ID: NIODOWNLOADER_FLATPAK_ID },
    },
    {
      platform: 'linux' as const,
      isPackaged: true,
      env: { FLATPAK_ID: 'org.example.Other' },
    },
    {
      platform: 'linux' as const,
      isPackaged: true,
      env: {},
    },
  ])('rejects a non-Nio Downloader Flatpak environment: %o', (options) => {
    expect(isPackagedLinuxFlatpak(options)).toBe(false)
  })
})
