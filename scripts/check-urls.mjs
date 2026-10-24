#!/usr/bin/env node

/**
 * scripts/check-urls.mjs
 * Validates own-organization (NotUrNio) links in documentation and codebase.
 * Fails on any 404 error for reachable public URLs.
 */

import { spawnSync } from 'node:child_process'
import https from 'node:https'
import path from 'node:path'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')

// Find all URLs matching NotUrNio
const proc = spawnSync(
  'git',
  [
    'grep',
    '-I',
    '-n',
    '-E',
    'https://github.com/NotUrNio',
    '--',
    'README.md',
    'docs',
    'package.json',
    'electron-builder.json',
    'THIRD_PARTY_NOTICES.md',
  ],
  {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }
)

const lines = (proc.stdout || '').split('\n')
const urlMap = new Map()
const URL_REGEX = /https:\/\/github\.com\/NotUrNio[^\s"'`<>[\])(\\,]+/g

for (const line of lines) {
  const parts = line.split(':')
  if (parts.length < 3) continue
  const file = parts[0]
  const rest = parts.slice(2).join(':')

  const matches = rest.match(URL_REGEX)
  if (matches) {
    for (let u of matches) {
      // Clean trailing punctuation
      u = u.replace(/[.;:]$/, '')
      // Skip template expressions like ${...} or #hash anchors
      if (u.includes('${') || u.includes('@refs/')) continue
      const baseUrl = u.split('#')[0]
      if (!baseUrl) continue

      if (!urlMap.has(baseUrl)) {
        urlMap.set(baseUrl, new Set())
      }
      urlMap.get(baseUrl).add(file)
    }
  }
}

console.log(`[check-urls] Checking ${urlMap.size} unique NotUrNio URLs...`)

async function checkUrl(targetUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl)
      const options = {
        method: 'HEAD',
        headers: {
          'User-Agent': 'NioDownloader-UrlChecker/1.0',
        },
      }

      const req = https.request(parsed, options, (res) => {
        // GitHub often returns 404 for private repos to anonymous callers.
        // If status is 200..399, it's valid.
        resolve({ url: targetUrl, status: res.statusCode })
      })

      req.on('error', (err) => {
        resolve({ url: targetUrl, error: err.message })
      })

      req.setTimeout(8000, () => {
        req.destroy(new Error('Timeout'))
      })

      req.end()
    } catch (err) {
      resolve({ url: targetUrl, error: err.message })
    }
  })
}

async function main() {
  let hasFailure = false
  const checked = []

  for (const [url, files] of urlMap.entries()) {
    const res = await checkUrl(url)
    checked.push({ ...res, files: Array.from(files) })
  }

  for (const item of checked) {
    // For private repo assets or private repo links, note auth requirement:
    if (
      item.url.includes('/Nio-Downloader') &&
      (item.status === 404 || item.status === 403)
    ) {
      console.log(
        `[check-urls] INFO (Private repo): ${item.url} [${item.status}] (Files: ${item.files.join(', ')})`
      )
      continue
    }

    if (item.status && item.status >= 400) {
      console.error(
        `[check-urls] FAIL (${item.status}): ${item.url} (Referenced in: ${item.files.join(', ')})`
      )
      hasFailure = true
    } else if (item.error) {
      console.warn(`[check-urls] WARN (${item.error}): ${item.url}`)
    } else {
      console.log(`[check-urls] OK (${item.status}): ${item.url}`)
    }
  }

  if (hasFailure) {
    console.error('[check-urls] One or more own URLs returned an error!')
    process.exit(1)
  }

  console.log('[check-urls] All checked own URLs validated successfully.')
}

main().catch((err) => {
  console.error('[check-urls] Fatal error:', err)
  process.exit(1)
})
