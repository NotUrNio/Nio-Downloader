import { describe, expect, it } from 'vitest'
import { INCOMPLETE_SUFFIX, MAX_DEDUP_ATTEMPTS } from './incomplete'

describe('incomplete constants', () => {
  it('exports INCOMPLETE_SUFFIX = ".nio"', () => {
    expect(INCOMPLETE_SUFFIX).toBe('.nio')
  })

  it('exports MAX_DEDUP_ATTEMPTS = 9999', () => {
    expect(MAX_DEDUP_ATTEMPTS).toBe(9999)
  })
})
