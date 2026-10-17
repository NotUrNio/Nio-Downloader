import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isLegacySnapDefaultSaveDir,
  resolveBridgeDataDir,
  resolvePackagedLinuxSnapEnvironment,
} from './snap-environment'

const validSnapOptions = {
  platform: 'linux' as const,
  isPackaged: true,
  resourcesPath: '/snap/nio-downloader/current/resources',
  env: {
    SNAP: '/snap/nio-downloader/current',
    SNAP_REAL_HOME: '/home/user',
    SNAP_INSTANCE_NAME: 'nio-downloader',
    SNAP_NAME: 'nio-downloader',
  },
}

describe('resolvePackagedLinuxSnapEnvironment', () => {
  it('resolves the real home and instance for a packaged Linux Snap', () => {
    expect(resolvePackagedLinuxSnapEnvironment(validSnapOptions)).toEqual({
      installRoot: '/snap/nio-downloader/current',
      realHome: '/home/user',
      instanceName: 'nio-downloader',
    })
  })

  it('supports parallel instances and the SNAP_NAME fallback', () => {
    expect(
      resolvePackagedLinuxSnapEnvironment({
        ...validSnapOptions,
        resourcesPath: '/snap/nio-downloader/current/resources',
        env: {
          SNAP: '/snap/nio-downloader/current',
          SNAP_REAL_HOME: '/home/user',
          SNAP_INSTANCE_NAME: 'nio-downloader_work',
          SNAP_NAME: 'nio-downloader',
        },
      })
    ).toMatchObject({ instanceName: 'nio-downloader_work' })

    expect(
      resolvePackagedLinuxSnapEnvironment({
        ...validSnapOptions,
        env: {
          SNAP: '/snap/nio-downloader/current',
          SNAP_REAL_HOME: '/home/user',
          SNAP_NAME: 'nio-downloader',
        },
      })
    ).toMatchObject({ instanceName: 'nio-downloader' })
  })

  it('ignores Snap-looking variables outside a packaged Linux app', () => {
    const hostileEnv = {
      SNAP: '../not-a-snap',
      SNAP_REAL_HOME: '/',
      SNAP_INSTANCE_NAME: '../../escape',
    }
    expect(
      resolvePackagedLinuxSnapEnvironment({
        ...validSnapOptions,
        isPackaged: false,
        env: hostileEnv,
      })
    ).toBeNull()
    expect(
      resolvePackagedLinuxSnapEnvironment({
        ...validSnapOptions,
        platform: 'darwin',
        env: hostileEnv,
      })
    ).toBeNull()
  })

  it('treats a missing SNAP variable as a non-Snap package', () => {
    expect(
      resolvePackagedLinuxSnapEnvironment({
        ...validSnapOptions,
        env: {
          SNAP_REAL_HOME: '/home/user',
          SNAP_INSTANCE_NAME: 'nio-downloader',
        },
      })
    ).toBeNull()
  })

  it.each([
    {
      name: 'missing real home',
      env: {
        SNAP: '/snap/nio-downloader/current',
        SNAP_INSTANCE_NAME: 'nio-downloader',
      },
    },
    {
      name: 'relative real home',
      env: {
        SNAP: '/snap/nio-downloader/current',
        SNAP_REAL_HOME: '../home',
        SNAP_INSTANCE_NAME: 'nio-downloader',
      },
    },
    {
      name: 'root real home',
      env: {
        SNAP: '/snap/nio-downloader/current',
        SNAP_REAL_HOME: '/',
        SNAP_INSTANCE_NAME: 'nio-downloader',
      },
    },
    {
      name: 'traversing install root',
      env: {
        SNAP: '/snap/nio-downloader/../other/current',
        SNAP_REAL_HOME: '/home/user',
        SNAP_INSTANCE_NAME: 'nio-downloader',
      },
    },
    {
      name: 'host path injection',
      env: {
        SNAP: '/snap/nio-downloader/current',
        SNAP_REAL_HOME: '/home/user',
        SNAP_INSTANCE_NAME: '../../escape',
      },
    },
    {
      name: 'mismatched instance mount',
      env: {
        SNAP: '/snap/other/current',
        SNAP_REAL_HOME: '/home/user',
        SNAP_INSTANCE_NAME: 'nio-downloader',
      },
    },
    {
      name: 'mismatched snap and instance names',
      env: {
        SNAP: '/snap/other/current',
        SNAP_REAL_HOME: '/home/user',
        SNAP_INSTANCE_NAME: 'nio-downloader_work',
        SNAP_NAME: 'other',
      },
    },
  ])('rejects a malformed partial Snap environment: $name', ({ env }) => {
    expect(() =>
      resolvePackagedLinuxSnapEnvironment({ ...validSnapOptions, env })
    ).toThrow()
  })

  it('rejects resources outside the declared Snap mount', () => {
    expect(() =>
      resolvePackagedLinuxSnapEnvironment({
        ...validSnapOptions,
        resourcesPath: '/opt/Nio-Downloader/resources',
      })
    ).toThrow('process.resourcesPath must be inside SNAP')
  })
})

describe('isLegacySnapDefaultSaveDir', () => {
  const snap = {
    instanceName: 'nio-downloader',
    realHome: '/home/user',
  }

  it.each([
    '/home/user/snap/nio-downloader/123/Downloads',
    '/home/user/snap/nio-downloader/current/Downloads',
  ])('recognizes the historical revision-scoped default: %s', (value) => {
    expect(isLegacySnapDefaultSaveDir(value, snap)).toBe(true)
  })

  it('supports the exact parallel-instance data directory', () => {
    expect(
      isLegacySnapDefaultSaveDir(
        '/home/user/snap/nio-downloader_work/42/Downloads',
        {
          instanceName: 'nio-downloader_work',
          realHome: '/home/user',
        }
      )
    ).toBe(true)
  })

  it.each([
    '/home/user/Downloads',
    '/mnt/downloads',
    '/home/user/snap/nio-downloader/123/custom',
    '/home/user/snap/nio-downloader/0/Downloads',
    '/home/user/snap/nio-downloader_work/42/Downloads',
    '/home/user/snap/nio-downloader/123/../Downloads',
  ])('preserves non-default and malformed paths: %s', (value) => {
    expect(isLegacySnapDefaultSaveDir(value, snap)).toBe(false)
  })
})

describe('resolveBridgeDataDir', () => {
  it('preserves the userData bridge path when no override exists', () => {
    expect(
      resolveBridgeDataDir('/home/user/.config/niodownloader', undefined)
    ).toBe(join('/home/user/.config/niodownloader', 'bridge'))
  })

  it('uses an absolute revision-independent bridge directory verbatim', () => {
    const bridgeDir =
      process.platform === 'win32'
        ? String.raw`C:\Users\user\snap\nio-downloader\common\bridge`
        : '/home/user/snap/nio-downloader/common/bridge'
    expect(
      resolveBridgeDataDir(
        join(
          'home',
          'user',
          'snap',
          'nio-downloader',
          'current',
          '.config',
          'niodownloader'
        ),
        bridgeDir
      )
    ).toBe(bridgeDir)
  })

  it.each([
    '',
    ' ',
    'relative/bridge',
    '/',
    '/home/user/common/../escape',
    '/home/user/common/bridge ',
    '/home/user/common/\0bridge',
  ])('rejects a malformed bridge override: %j', (override) => {
    expect(() => resolveBridgeDataDir('/fallback', override)).toThrow(
      'NIODOWNLOADER_BRIDGE_DATA_DIR must be a canonical absolute directory'
    )
  })
})
