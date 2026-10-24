import { describe, expect, it } from 'vitest'
import {
  buildFeatureReport,
  hasDurableRemoveSemantics,
  isNioFork,
  semverGte,
} from './feature-report'

describe('buildFeatureReport', () => {
  it('derives BT flags from version at the 1.37.0 threshold', () => {
    const r = buildFeatureReport('1.37.0', ['BitTorrent'])
    expect(r.hasBtSeedUnverified).toBe(true)
    expect(r.hasBtSaveMetadata).toBe(true)
  })

  it('disables BT flags below 1.37.0', () => {
    const r = buildFeatureReport('1.36.0', ['BitTorrent'])
    expect(r.hasBtSeedUnverified).toBe(false)
    expect(r.hasBtSaveMetadata).toBe(false)
  })

  it('reads hasSqlitePersistence from the features list', () => {
    expect(
      buildFeatureReport('1.37.0', ['SQLite3-Persistence']).hasSqlitePersistence
    ).toBe(true)
    expect(buildFeatureReport('1.37.0', []).hasSqlitePersistence).toBe(false)
  })

  it('passes version/features through and keeps hasMoveStorage false', () => {
    const r = buildFeatureReport('1.37.0', [
      'BitTorrent',
      'SQLite3-Persistence',
    ])
    expect(r.version).toBe('1.37.0')
    expect(r.features).toEqual(['BitTorrent', 'SQLite3-Persistence'])
    expect(r.hasMoveStorage).toBe(false)
  })
})

describe('semverGte', () => {
  it('compares dotted versions', () => {
    expect(semverGte('1.37.0', '1.37.0')).toBe(true)
    expect(semverGte('1.37.1', '1.37.0')).toBe(true)
    expect(semverGte('2.0.0', '1.37.0')).toBe(true)
    expect(semverGte('1.36.0', '1.37.0')).toBe(false)
  })

  it('fails closed on unparseable components', () => {
    expect(semverGte('1.x.0', '1.37.0')).toBe(false)
  })
})

describe('isNioFork', () => {
  it('requires both the Nio fork version suffix and fork-only persistence feature', () => {
    expect(
      isNioFork(buildFeatureReport('1.37.0-nio.10', ['SQLite3-Persistence']))
    ).toBe(true)
    expect(
      isNioFork(buildFeatureReport('1.37.0-motrix.19', ['SQLite3-Persistence']))
    ).toBe(true)
    expect(
      isNioFork(
        buildFeatureReport('1.37.0-motrix.19-dev.123', ['SQLite3-Persistence'])
      )
    ).toBe(true)
    expect(
      isNioFork(buildFeatureReport('1.37.0', ['SQLite3-Persistence']))
    ).toBe(false)
    expect(isNioFork(buildFeatureReport('1.37.0-nio.10', []))).toBe(false)
  })
})

describe('hasDurableRemoveSemantics', () => {
  it('trusts nio fork 1.37.0-nio.3 and later', () => {
    expect(hasDurableRemoveSemantics('1.37.0-nio.3')).toBe(true)
    expect(hasDurableRemoveSemantics('1.37.0-nio.4')).toBe(true)
    expect(hasDurableRemoveSemantics('1.37.0-motrix.19')).toBe(true)
    expect(hasDurableRemoveSemantics('1.37.0-motrix.19-dev.123')).toBe(true)
    expect(hasDurableRemoveSemantics('1.38.0-nio.1')).toBe(true)
  })

  it('distrusts older nio forks whose remove masks store failures', () => {
    expect(hasDurableRemoveSemantics('1.37.0-nio.1')).toBe(false)
    expect(hasDurableRemoveSemantics('1.37.0-nio.2')).toBe(false)
    expect(hasDurableRemoveSemantics('1.36.0-nio.9')).toBe(false)
  })

  it('distrusts unknown lineages that still advertise persistence', () => {
    expect(hasDurableRemoveSemantics('1.37.0')).toBe(false)
    expect(hasDurableRemoveSemantics('unknown')).toBe(false)
  })
})
