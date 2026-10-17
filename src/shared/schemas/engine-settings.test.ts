import { describe, expect, it } from 'vitest'
import { ENGINE_PERFORMANCE_PROFILES } from '../constants/engine-performance-profiles'
import {
  DEFAULT_ENGINE_SETTINGS,
  engineSettingsSchema,
  MAX_CONNECTIONS_PER_SERVER,
} from './engine-settings'

describe('engineSettingsSchema maxConnectionPerServer', () => {
  it('defaults to the Max Speed connection limit (16)', () => {
    expect(DEFAULT_ENGINE_SETTINGS.maxConnectionPerServer).toBe(16)
  })

  it('accepts the maximum supported Nio Downloader value in custom profile', () => {
    expect(
      engineSettingsSchema.parse({
        performanceProfile: 'custom',
        maxConnectionPerServer: MAX_CONNECTIONS_PER_SERVER,
      }).maxConnectionPerServer
    ).toBe(MAX_CONNECTIONS_PER_SERVER)
  })

  it('recovers values above the Nio Downloader limit to the default', () => {
    expect(
      engineSettingsSchema.parse({
        performanceProfile: 'custom',
        maxConnectionPerServer: MAX_CONNECTIONS_PER_SERVER + 1,
      }).maxConnectionPerServer
    ).toBe(16)
  })
})

describe('engineSettingsSchema performance profiles', () => {
  it('uses automatic performance tuning by default', () => {
    expect(DEFAULT_ENGINE_SETTINGS).toMatchObject({
      performanceProfile: 'auto',
      ...ENGINE_PERFORMANCE_PROFILES.auto,
    })
  })

  it.each(['balanced', 'high', 'maximum'] as const)(
    'links every tuning value for the %s profile',
    (performanceProfile) => {
      expect(engineSettingsSchema.parse({ performanceProfile })).toMatchObject({
        performanceProfile,
        ...ENGINE_PERFORMANCE_PROFILES[performanceProfile],
      })
    }
  )

  it('preserves individual values in the custom profile', () => {
    expect(
      engineSettingsSchema.parse({
        performanceProfile: 'custom',
        maxConnectionPerServer: 24,
        split: 12,
        minSplitSize: 2 * 1024 * 1024,
        diskCache: 48 * 1024 * 1024,
      })
    ).toMatchObject({
      performanceProfile: 'custom',
      maxConnectionPerServer: 24,
      split: 12,
      minSplitSize: 2 * 1024 * 1024,
      diskCache: 48 * 1024 * 1024,
    })
  })
})

describe('engineSettingsSchema dnsMode', () => {
  it('defaults to auto', () => {
    expect(DEFAULT_ENGINE_SETTINGS.dnsMode).toBe('auto')
  })

  it.each(['auto', 'system', 'engine'] as const)('accepts %s', (mode) => {
    expect(engineSettingsSchema.parse({ dnsMode: mode }).dnsMode).toBe(mode)
  })

  it.each(['c-ares', 'true', 42, null])(
    'recovers invalid persisted value %s to auto',
    (bad) => {
      expect(engineSettingsSchema.parse({ dnsMode: bad }).dnsMode).toBe('auto')
    }
  )
})

describe('engineSettingsSchema remoteTime', () => {
  it('uses the local modification time by default', () => {
    expect(DEFAULT_ENGINE_SETTINGS.remoteTime).toBe(false)
  })

  it.each([true, false])('accepts %s', (remoteTime) => {
    expect(engineSettingsSchema.parse({ remoteTime }).remoteTime).toBe(
      remoteTime
    )
  })

  it.each(['server', 1, null])(
    'recovers invalid persisted value %s to false',
    (bad) => {
      expect(engineSettingsSchema.parse({ remoteTime: bad }).remoteTime).toBe(
        false
      )
    }
  )
})

describe('engineSettingsSchema maxSpeed', () => {
  it('is enabled by default on fresh configurations', () => {
    expect(DEFAULT_ENGINE_SETTINGS.maxSpeed).toBe(true)
  })

  it('migrates legacy/missing settings by defaulting maxSpeed to true', () => {
    const parsed = engineSettingsSchema.parse({})
    expect(parsed.maxSpeed).toBe(true)
    expect(parsed.maxConnectionPerServer).toBe(16)
    expect(parsed.split).toBe(16)
    expect(parsed.minSplitSize).toBe(1024 * 1024)
    expect(parsed.diskCache).toBe(64 * 1024 * 1024)
  })

  it('restores previous defaults when maxSpeed is explicitly false', () => {
    const parsed = engineSettingsSchema.parse({ maxSpeed: false })
    expect(parsed.maxSpeed).toBe(false)
    expect(parsed.maxConnectionPerServer).toBe(16)
    expect(parsed.split).toBe(16)
    expect(parsed.minSplitSize).toBe(4 * 1024 * 1024)
    expect(parsed.diskCache).toBe(32 * 1024 * 1024)
  })

  it.each(['invalid', 123, null])(
    'recovers invalid value %s to true',
    (bad) => {
      expect(engineSettingsSchema.parse({ maxSpeed: bad }).maxSpeed).toBe(true)
    }
  )
})
