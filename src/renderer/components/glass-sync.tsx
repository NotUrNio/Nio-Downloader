import { useLiquidGlass } from '@renderer/hooks/use-liquid-glass'
import { useEffect } from 'react'

export function GlassSync() {
  const enabled = useLiquidGlass()

  useEffect(() => {
    document.documentElement.dataset.glass = enabled ? 'true' : 'false'
  }, [enabled])

  return null
}
