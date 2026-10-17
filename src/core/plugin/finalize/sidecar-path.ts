import { existsSync } from 'node:fs'
import path from 'node:path'

export function resolveFinalizeSidecarPath(input: {
  extraResourceDir: string
  isDev: boolean
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  arch?: string
  runtimeRoot?: string
  fileExists?: (candidate: string) => boolean
}): string {
  const env = input.env ?? process.env
  const override = env.NIODOWNLOADER_FINALIZE_FS_BIN ?? env.NIO_FINALIZE_FS_BIN
  if (override) {
    if (!path.isAbsolute(override)) {
      throw new Error(
        `${env.NIODOWNLOADER_FINALIZE_FS_BIN ? 'NIODOWNLOADER_FINALIZE_FS_BIN' : 'NIO_FINALIZE_FS_BIN'} must be an absolute path`
      )
    }
    return override
  }
  const binary =
    (input.platform ?? process.platform) === 'win32'
      ? 'nio-finalize-fs.exe'
      : 'nio-finalize-fs'
  if (input.isDev) {
    return path.resolve(
      input.extraResourceDir,
      '..',
      'packages',
      'finalize-fs',
      'dist',
      `${input.platform ?? process.platform}-${input.arch ?? process.arch}`,
      binary
    )
  }

  const packaged = path.resolve(input.extraResourceDir, '..', 'bin', binary)
  if (!input.runtimeRoot) return packaged
  const localBuild = path.resolve(
    input.runtimeRoot,
    'packages',
    'finalize-fs',
    'dist',
    `${input.platform ?? process.platform}-${input.arch ?? process.arch}`,
    binary
  )
  const fileExists = input.fileExists ?? existsSync
  return !fileExists(packaged) && fileExists(localBuild) ? localBuild : packaged
}
