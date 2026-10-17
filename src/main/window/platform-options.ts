import type { BrowserWindowConstructorOptions } from 'electron'

export interface PlatformOptionsInput {
  vibrancy?: boolean
  liquidGlass?: boolean
  shouldUseDarkColors?: boolean
}

export const WINDOW_BACKGROUND = {
  light: '#ffffff',
  dark: '#09090b',
} as const

export function buildPlatformOptions(
  platform: string = process.platform,
  {
    vibrancy = true,
    liquidGlass = false,
    shouldUseDarkColors = false,
  }: PlatformOptionsInput = {}
): BrowserWindowConstructorOptions {
  const solidBackground = shouldUseDarkColors
    ? WINDOW_BACKGROUND.dark
    : WINDOW_BACKGROUND.light

  switch (platform) {
    case 'darwin':
      if (liquidGlass) {
        return {
          titleBarStyle: 'hiddenInset',
          transparent: true,
          backgroundColor: '#00000000',
          trafficLightPosition: { x: 20, y: 20 },
        }
      }
      return vibrancy
        ? {
            titleBarStyle: 'hiddenInset',
            vibrancy: 'under-window',
            visualEffectState: 'active',
            backgroundColor: '#00000000',
            trafficLightPosition: { x: 20, y: 20 },
          }
        : {
            titleBarStyle: 'hiddenInset',
            backgroundColor: solidBackground,
            trafficLightPosition: { x: 20, y: 20 },
          }
    case 'win32':
      if (liquidGlass) {
        return {
          titleBarStyle: 'hidden',
          backgroundMaterial: 'acrylic',
          backgroundColor: shouldUseDarkColors ? '#09090bf0' : '#fffffff0',
        }
      }
      return {
        titleBarStyle: 'hidden',
        backgroundMaterial: 'none',
        backgroundColor: solidBackground,
      }
    default:
      return {
        titleBarStyle: 'hidden',
        backgroundColor: solidBackground,
      }
  }
}
