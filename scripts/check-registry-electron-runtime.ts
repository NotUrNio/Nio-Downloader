import { readFile } from 'node:fs/promises'
import { app, BrowserWindow } from 'electron'
import { runRegistryRuntimeConformance } from './registry-runtime-conformance'

interface RendererRuntimeResult {
  userAgent: string
  language: string
  maximizeProbe: string
  conformance: ReturnType<typeof runRegistryRuntimeConformance>
}

async function main(): Promise<void> {
  const rendererBundlePath = process.env.NIODOWNLOADER_REGISTRY_RENDERER_BUNDLE
  if (!rendererBundlePath) {
    throw new Error('NIODOWNLOADER_REGISTRY_RENDERER_BUNDLE is required')
  }

  const mainResult = runRegistryRuntimeConformance()
  const rendererBundle = await readFile(rendererBundlePath, 'utf8')

  await app.whenReady()
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  await window.loadURL('about:blank')
  const rendererResult = (await window.webContents.executeJavaScript(
    `${rendererBundle}\n({\n` +
      `  userAgent: navigator.userAgent,\n` +
      `  language: navigator.language,\n` +
      `  maximizeProbe: new Intl.Locale('zh-TW').maximize().toString(),\n` +
      `  conformance: NioRegistryRuntime.runRegistryRuntimeConformance(),\n` +
      `})`
  )) as RendererRuntimeResult

  console.log(
    JSON.stringify(
      {
        executablePath: process.execPath,
        versions: process.versions,
        main: mainResult,
        renderer: rendererResult,
      },
      null,
      2
    )
  )
  window.destroy()
  app.quit()
}

void main().catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})
