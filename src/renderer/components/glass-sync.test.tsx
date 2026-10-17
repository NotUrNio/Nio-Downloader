import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlassSync } from './glass-sync'

const mockUseLiquidGlass = vi.fn()

vi.mock('@renderer/hooks/use-liquid-glass', () => ({
  useLiquidGlass: () => mockUseLiquidGlass(),
}))

describe('GlassSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete document.documentElement.dataset.glass
  })

  it('sets dataset.glass to true when liquid glass is enabled', () => {
    mockUseLiquidGlass.mockReturnValue(true)
    render(<GlassSync />)
    expect(document.documentElement.dataset.glass).toBe('true')
  })

  it('sets dataset.glass to false when liquid glass is disabled', () => {
    mockUseLiquidGlass.mockReturnValue(false)
    render(<GlassSync />)
    expect(document.documentElement.dataset.glass).toBe('false')
  })
})
