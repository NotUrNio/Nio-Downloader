#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const defaultFs = {
  existsSync,
  readFileSync,
  writeFileSync,
}

export function updatePlistContent(plist, appName = 'Nio Downloader') {
  let updated = plist

  const nameMatch = updated.match(
    /<key>CFBundleName<\/key>\s*<string>([^<]*)<\/string>/
  )
  const displayNameMatch = updated.match(
    /<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/
  )

  if (
    nameMatch &&
    nameMatch[1] === appName &&
    displayNameMatch &&
    displayNameMatch[1] === appName
  ) {
    return { updatedContent: plist, changed: false }
  }

  if (nameMatch) {
    updated = updated.replace(
      /(<key>CFBundleName<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${appName}$2`
    )
  } else {
    updated = updated.replace(
      /<dict>/,
      `<dict>\n\t<key>CFBundleName</key>\n\t<string>${appName}</string>`
    )
  }

  if (displayNameMatch) {
    updated = updated.replace(
      /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${appName}$2`
    )
  } else {
    updated = updated.replace(
      /<dict>/,
      `<dict>\n\t<key>CFBundleDisplayName</key>\n\t<string>${appName}</string>`
    )
  }

  return {
    updatedContent: updated,
    changed: updated !== plist,
  }
}

export function resolveElectronAppPath(electronBinary) {
  let binaryPath = electronBinary
  if (!binaryPath) {
    try {
      binaryPath = require('electron')
    } catch {
      return null
    }
  }
  if (typeof binaryPath !== 'string') return null
  const appPath = path.resolve(binaryPath, '../../..')
  if (path.basename(appPath) === 'Electron.app') {
    return appPath
  }
  return null
}

export function ensureMacosDevBundle(options = {}) {
  const platform = options.platform ?? process.platform
  const isCi = options.isCi ?? Boolean(process.env.CI)
  const appName = options.appName ?? 'Nio Downloader'
  const log = options.log ?? console.log
  const logWarn = options.logWarn ?? console.warn
  const fs = options.fs ?? defaultFs
  const spawn = options.spawn ?? spawnSync

  if (platform !== 'darwin') {
    return { skipped: true, reason: 'non-macOS' }
  }
  if (isCi) {
    return { skipped: true, reason: 'CI' }
  }

  try {
    const appPath =
      options.appPath ?? resolveElectronAppPath(options.electronBinary)
    if (!appPath) {
      logWarn(
        '[ensure-macos-dev-bundle] warning: could not resolve Electron.app path'
      )
      return { skipped: true, reason: 'app-not-found' }
    }

    const plistPath =
      options.plistPath ?? path.join(appPath, 'Contents', 'Info.plist')
    if (!fs.existsSync(plistPath)) {
      logWarn(
        `[ensure-macos-dev-bundle] warning: Info.plist not found at ${plistPath}`
      )
      return { skipped: true, reason: 'plist-not-found' }
    }

    const originalContent = fs.readFileSync(plistPath, 'utf8')
    const { updatedContent, changed } = updatePlistContent(
      originalContent,
      appName
    )

    if (!changed) {
      return { updated: false, reSigned: false }
    }

    fs.writeFileSync(plistPath, updatedContent, 'utf8')

    // Clear extended attributes (FinderInfo, resource forks) which prevent codesigning
    // on macOS filesystems (e.g. iCloud Drive or Finder-tagged folders).
    try {
      spawn('xattr', ['-cr', appPath], { stdio: 'ignore' })
    } catch {
      // Best-effort; continue to codesign even if xattr fails
    }

    const result = spawn(
      'codesign',
      ['--force', '--deep', '--sign', '-', appPath],
      { stdio: 'pipe' }
    )

    if (result.error || (result.status !== 0 && result.status !== null)) {
      const detail =
        result.error?.message ||
        result.stderr?.toString()?.trim() ||
        `exit code ${result.status}`
      logWarn(
        `[ensure-macos-dev-bundle] warning: ad-hoc codesign failed: ${detail}`
      )
      return { updated: true, reSigned: false, error: detail }
    }

    log(
      `[ensure-macos-dev-bundle] updated Electron.app bundle identity to "${appName}" and re-signed ad-hoc`
    )
    return { updated: true, reSigned: true }
  } catch (error) {
    logWarn(
      `[ensure-macos-dev-bundle] warning: failed to update macOS dev bundle: ${error?.message ?? error}`
    )
    return { error, updated: false, reSigned: false }
  }
}

const invokedAsMain =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedAsMain) {
  ensureMacosDevBundle()
}
