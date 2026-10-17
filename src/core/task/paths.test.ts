import { describe, expect, it } from 'vitest'
import { isTempPath, toFinalPath, toTempPath } from './paths'

describe('toTempPath', () => {
  it('appends .nio to file path', () => {
    expect(toTempPath('/downloads/foo.mp4')).toBe('/downloads/foo.mp4.nio')
  })

  it('appends .nio to directory path', () => {
    expect(toTempPath('/downloads/ubuntu')).toBe('/downloads/ubuntu.nio')
  })

  it('no-op when path already has .nio suffix', () => {
    expect(toTempPath('/downloads/foo.mp4.nio')).toBe('/downloads/foo.mp4.nio')
  })
})

describe('toFinalPath', () => {
  it('strips .nio suffix', () => {
    expect(toFinalPath('/downloads/foo.mp4.nio')).toBe('/downloads/foo.mp4')
  })

  it('no-op when no suffix', () => {
    expect(toFinalPath('/downloads/foo.mp4')).toBe('/downloads/foo.mp4')
  })

  it('handles directory with .nio suffix', () => {
    expect(toFinalPath('/downloads/ubuntu.nio')).toBe('/downloads/ubuntu')
  })
})

describe('isTempPath', () => {
  it('true when ends with .nio', () => {
    expect(isTempPath('/downloads/foo.mp4.nio')).toBe(true)
  })

  it('false when does not end with .nio', () => {
    expect(isTempPath('/downloads/foo.mp4')).toBe(false)
  })

  it('false when .nio is in middle', () => {
    expect(isTempPath('/downloads/foo.nio/bar')).toBe(false)
  })
})
