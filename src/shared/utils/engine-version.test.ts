import { describe, expect, it } from 'vitest'
import { formatEngineDisplayVersion } from './engine-version'

describe('formatEngineDisplayVersion', () => {
  it('strips legacy vendor suffix from version string', () => {
    expect(formatEngineDisplayVersion('1.37.0-motrix.16')).toBe('1.37.0')
  })

  it('strips nio suffix from version string', () => {
    expect(formatEngineDisplayVersion('1.37.0-nio.14')).toBe('1.37.0')
  })

  it('leaves clean SemVer unchanged', () => {
    expect(formatEngineDisplayVersion('1.37.0')).toBe('1.37.0')
  })

  it('extracts SemVer from strings with binary name prefix', () => {
    expect(formatEngineDisplayVersion('aria2c 1.37.0-motrix.16')).toBe('1.37.0')
  })

  it('handles null, undefined, and empty string gracefully', () => {
    expect(formatEngineDisplayVersion(null)).toBe('')
    expect(formatEngineDisplayVersion(undefined)).toBe('')
    expect(formatEngineDisplayVersion('')).toBe('')
    expect(formatEngineDisplayVersion('   ')).toBe('')
  })

  it('handles unexpected non-semver strings by stripping from dash onwards', () => {
    expect(formatEngineDisplayVersion('custom-build')).toBe('custom')
  })
})
