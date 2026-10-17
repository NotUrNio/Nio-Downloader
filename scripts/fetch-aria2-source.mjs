#!/usr/bin/env node

// scripts/fetch-aria2-source.mjs
//
// Fetches the exact corresponding source tarball for the bundled aria2 engine
// matching scripts/engine.lock.json, verifying its presence and placing it in
// the release directory so it is attached to GitHub releases (GPL source offer).

import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { get } from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import engineLock from './engine.lock.json' with { type: 'json' }

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

function parseArgs() {
  const args = process.argv.slice(2)
  let outputDir = path.join(REPO_ROOT, 'release')
  for (let i = 0; i < args.length; i++) {
    if (
      args[i] === '--output' ||
      args[i] === '--output-dir' ||
      args[i] === '-o'
    ) {
      outputDir = path.resolve(process.cwd(), args[++i])
    }
  }
  return { outputDir }
}

function downloadUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        return resolve(downloadUrl(res.headers.location, destPath))
      }
      if (res.statusCode !== 200) {
        return reject(
          new Error(`Download failed with status ${res.statusCode}: ${url}`)
        )
      }
      const fileStream = createWriteStream(destPath)
      res.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close(resolve)
      })
      fileStream.on('error', (err) => {
        reject(err)
      })
    }).on('error', reject)
  })
}

async function verifyChecksum(filePath, expectedSha256) {
  if (!expectedSha256) return
  const buf = await readFile(filePath)
  const actual = createHash('sha256').update(buf).digest('hex')
  if (actual !== expectedSha256) {
    throw new Error(
      `Checksum mismatch for ${filePath}: expected ${expectedSha256}, got ${actual}`
    )
  }
  console.log(`Verified SHA-256 checksum for ${filePath}: ${actual}`)
}

async function main() {
  const { outputDir } = parseArgs()
  await mkdir(outputDir, { recursive: true })

  const version = engineLock.version
  const tag = engineLock.tag
  const targetFileName = `aria2-${version}-source.tar.gz`
  const targetPath = path.join(outputDir, targetFileName)

  if (process.env.ARIA2_SOURCE_PATH) {
    console.log(
      `Copying aria2 source tarball from local path ${process.env.ARIA2_SOURCE_PATH}...`
    )
    await copyFile(process.env.ARIA2_SOURCE_PATH, targetPath)
    await verifyChecksum(targetPath, engineLock.sourceSha256)
    console.log(`Saved aria2 source tarball to ${targetPath}`)
    return
  }

  const downloadUrlStr =
    process.env.ARIA2_SOURCE_URL ||
    `https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/aria2-${version}-source.tar.gz`
  console.log(`Fetching aria2 source tarball from ${downloadUrlStr}...`)
  try {
    await downloadUrl(downloadUrlStr, targetPath)
  } catch (err) {
    if (engineLock.repo) {
      console.warn(
        `Primary download failed (${err.message}), falling back to repo archive...`
      )
      await downloadUrl(
        `https://github.com/${engineLock.repo}/archive/refs/tags/${tag}.tar.gz`,
        targetPath
      )
    } else {
      throw err
    }
  }
  await verifyChecksum(targetPath, engineLock.sourceSha256)
  console.log(`Saved aria2 source tarball to ${targetPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
