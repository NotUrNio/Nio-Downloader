#!/usr/bin/env node
// scripts/bench-download.mjs
//
// Benchmark download throughput and multi-connection concurrency using the
// bundled aria2 engine and Nio Downloader configuration profiles.

import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

const DEFAULT_URL =
  'https://cloud-images.ubuntu.com/minimal/releases/jammy/release/ubuntu-22.04-minimal-cloudimg-amd64.img'

function resolveHostAria2Path() {
  const platform = process.platform
  const arch = process.arch
  const binName = platform === 'win32' ? 'aria2c.exe' : 'aria2c'
  const localBin = path.join(REPO_ROOT, 'extra', platform, arch, binName)
  if (existsSync(localBin)) {
    return localBin
  }
  return binName
}

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    runs: 3,
    maxSpeed: undefined,
    ceiling: false,
    conservative: false,
    connections: undefined,
    split: undefined,
    minSplitSize: undefined,
    diskCache: undefined,
    fileAllocation: undefined,
    maxBytes: undefined,
    timeoutSec: 300,
    expectedSha256: undefined,
    json: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--url' && argv[i + 1]) {
      options.url = argv[++i]
    } else if (arg === '--runs' && argv[i + 1]) {
      options.runs = Math.max(1, Number.parseInt(argv[++i], 10) || 3)
    } else if (arg === '--max-speed') {
      options.maxSpeed = true
    } else if (arg === '--no-max-speed') {
      options.maxSpeed = false
    } else if (arg === '--ceiling') {
      options.ceiling = true
    } else if (arg === '--conservative') {
      options.conservative = true
    } else if (arg === '--connections' && argv[i + 1]) {
      options.connections = Number.parseInt(argv[++i], 10)
    } else if (arg === '--split' && argv[i + 1]) {
      options.split = Number.parseInt(argv[++i], 10)
    } else if (arg === '--min-split-size' && argv[i + 1]) {
      options.minSplitSize = argv[++i]
    } else if (arg === '--disk-cache' && argv[i + 1]) {
      options.diskCache = argv[++i]
    } else if (arg === '--file-allocation' && argv[i + 1]) {
      options.fileAllocation = argv[++i]
    } else if (arg === '--max-bytes' && argv[i + 1]) {
      options.maxBytes = Number.parseInt(argv[++i], 10)
    } else if (arg === '--timeout' && argv[i + 1]) {
      options.timeoutSec = Number.parseInt(argv[++i], 10)
    } else if (arg === '--sha256' && argv[i + 1]) {
      options.expectedSha256 = argv[++i].toLowerCase()
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/bench-download.mjs [options]

Options:
  --url <url>              Download target URL (default: Ubuntu minimal cloud image)
  --runs <n>               Number of benchmark iterations (default: 3)
  --max-speed              Use aggressive Max Speed preset (16 conns, 16 split, 1M min-split, 64M cache)
  --no-max-speed           Use previous behavior preset (16 conns, 16 split, 4M min-split, 32M cache)
  --ceiling                Use plain aria2c reference ceiling (-x16 -s16 -k1M --file-allocation=none)
  --conservative           Use conservative fallback preset (4 conns, 4 split, 10M min-split, 16M cache)
  --connections <n>        Explicit max-connection-per-server
  --split <n>              Explicit split count
  --min-split-size <size>  Explicit min-split-size (e.g. 1M, 4M, 10M)
  --disk-cache <size>      Explicit disk-cache (e.g. 16M, 32M, 64M)
  --file-allocation <m>    Explicit file allocation method (e.g. none, prealloc)
  --max-bytes <n>          Stop run early after downloading n bytes
  --timeout <sec>          Timeout in seconds per run (default: 300)
  --sha256 <hex>           Expected SHA256 digest to verify
  --json                   Output summary in JSON format
`)
      process.exit(0)
    }
  }

  return options
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

async function hashFileSha256(filePath) {
  if (!existsSync(filePath)) return null
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function computeStats(values) {
  if (values.length === 0) return { min: 0, median: 0, max: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return {
    min: sorted[0],
    median,
    max: sorted[sorted.length - 1],
  }
}

async function runSingleBenchmark(options, runIndex) {
  const binPath = resolveHostAria2Path()
  const port = await getAvailablePort()
  const secret = randomBytes(16).toString('hex')
  const workDir = await mkdtemp(
    path.join(os.tmpdir(), `nio-bench-${runIndex}-`)
  )
  const targetFileName = `bench-target-${runIndex}.dat`

  let maxConnectionPerServer = options.connections
  let split = options.split
  let minSplitSize = options.minSplitSize
  let diskCache = options.diskCache
  let fileAllocation = options.fileAllocation

  if (options.ceiling) {
    maxConnectionPerServer ??= 16
    split ??= 16
    minSplitSize ??= '1M'
    diskCache ??= '0'
    fileAllocation ??= 'none'
  } else if (options.maxSpeed === true) {
    maxConnectionPerServer ??= 16
    split ??= 16
    minSplitSize ??= '1M'
    diskCache ??= '64M'
    fileAllocation ??= 'none'
  } else if (options.conservative) {
    maxConnectionPerServer ??= 4
    split ??= 4
    minSplitSize ??= '10M'
    diskCache ??= '16M'
    fileAllocation ??= 'none'
  } else if (options.maxSpeed === false) {
    // Restores previous Nio default behavior
    maxConnectionPerServer ??= 16
    split ??= 16
    minSplitSize ??= '4M'
    diskCache ??= '32M'
    fileAllocation ??= 'none'
  } else {
    // Default profile
    maxConnectionPerServer ??= 16
    split ??= 16
    minSplitSize ??= '1M'
    diskCache ??= '64M'
    fileAllocation ??= 'none'
  }

  const ariaArgs = [
    '--enable-rpc=true',
    '--rpc-allow-origin-all=false',
    '--rpc-listen-all=false',
    `--rpc-listen-port=${port}`,
    `--rpc-secret=${secret}`,
    `--dir=${workDir}`,
    `--max-connection-per-server=${maxConnectionPerServer}`,
    `--split=${split}`,
    `--min-split-size=${minSplitSize}`,
    `--disk-cache=${diskCache}`,
    `--file-allocation=${fileAllocation}`,
    '--max-overall-download-limit=0',
    '--max-download-limit=0',
    '--lowest-speed-limit=0',
    '--user-agent=NioDownloader/1.0',
    '--async-dns=true',
    '--quiet=true',
  ]

  const child = spawn(binPath, ariaArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
  let exited = false
  child.on('exit', () => {
    exited = true
  })

  async function callRpc(method, params = []) {
    const res = await fetch(`http://127.0.0.1:${port}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `bench-${Date.now()}`,
        method,
        params: [`token:${secret}`, ...params],
      }),
    })
    const json = await res.json()
    if (json.error) {
      throw new Error(`aria2 RPC error: ${JSON.stringify(json.error)}`)
    }
    return json.result
  }

  // Wait for RPC server readiness
  let rpcReady = false
  for (let i = 0; i < 30; i++) {
    if (exited) {
      throw new Error('aria2 process terminated unexpectedly during startup')
    }
    try {
      await callRpc('aria2.getVersion')
      rpcReady = true
      break
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  if (!rpcReady) {
    child.kill('SIGKILL')
    throw new Error('aria2 RPC server did not become ready within 3 seconds')
  }

  const effectiveGlobal = await callRpc('aria2.getGlobalOption')

  const startTime = performance.now()
  const gid = await callRpc('aria2.addUri', [
    [options.url],
    { dir: workDir, out: targetFileName },
  ])

  let ttfbSec = null
  let peakSpeedBytes = 0
  let peakConnections = 0
  let completedBytes = 0
  let totalBytes = 0
  let terminalStatus = 'active'
  let errorMessage = ''

  const deadline = startTime + options.timeoutSec * 1000

  while (performance.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100))
    if (exited) break

    const status = await callRpc('aria2.tellStatus', [gid])
    const currentSpeed = Number.parseInt(status.downloadSpeed, 10) || 0
    const currentConnections = Number.parseInt(status.connections, 10) || 0
    completedBytes = Number.parseInt(status.completedLength, 10) || 0
    totalBytes = Number.parseInt(status.totalLength, 10) || 0

    if (ttfbSec === null && completedBytes > 0) {
      ttfbSec = Math.max(0.001, (performance.now() - startTime) / 1000)
    }

    if (currentSpeed > peakSpeedBytes) peakSpeedBytes = currentSpeed
    if (currentConnections > peakConnections)
      peakConnections = currentConnections

    if (options.maxBytes && completedBytes >= options.maxBytes) {
      await callRpc('aria2.pause', [gid]).catch(() => {})
      terminalStatus = 'complete'
      break
    }

    if (status.status === 'complete') {
      terminalStatus = 'complete'
      break
    }
    if (status.status === 'error') {
      terminalStatus = 'error'
      errorMessage = status.errorMessage || `errorCode=${status.errorCode}`
      break
    }
    if (status.status === 'removed') {
      terminalStatus = 'removed'
      break
    }
  }

  const endTime = performance.now()
  const durationSec = Math.max(0.001, (endTime - startTime) / 1000)
  ttfbSec ??= durationSec

  // Terminate aria2
  child.kill('SIGKILL')

  const targetPath = path.join(workDir, targetFileName)
  let sha256 = null
  try {
    sha256 = await hashFileSha256(targetPath)
  } catch {}

  // Clean up disk
  await rm(workDir, { recursive: true, force: true }).catch(() => {})

  if (terminalStatus === 'error') {
    throw new Error(`Download failed: ${errorMessage}`)
  }

  const avgSpeedBytesPerSec = completedBytes / durationSec
  const avgSpeedMBps = avgSpeedBytesPerSec / (1024 * 1024)
  const avgSpeedMbps = avgSpeedMBps * 8
  const peakSpeedMBps = peakSpeedBytes / (1024 * 1024)
  const peakSpeedMbps = peakSpeedMBps * 8

  return {
    run: runIndex,
    durationSec,
    ttfbSec,
    completedBytes,
    totalBytes,
    avgSpeedMBps,
    avgSpeedMbps,
    peakSpeedMBps,
    peakSpeedMbps,
    peakConnections,
    sha256,
    effectiveOptions: {
      maxConnectionPerServer: effectiveGlobal['max-connection-per-server'],
      split: effectiveGlobal.split,
      minSplitSize: effectiveGlobal['min-split-size'],
      diskCache: effectiveGlobal['disk-cache'],
      fileAllocation: effectiveGlobal['file-allocation'],
    },
  }
}

export async function runBenchmark(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const runs = options.runs
  const results = []

  const modeLabel = options.ceiling
    ? 'Ceiling Reference (plain aria2c -x16 -s16 -k1M)'
    : options.maxSpeed === true
      ? 'Max speed (ON)'
      : options.maxSpeed === false
        ? 'Max speed (OFF / previous behavior)'
        : options.conservative
          ? 'Conservative Fallback (4 conns, 4 split, 10M min-split)'
          : 'Default (Max speed ON)'

  if (!options.json) {
    console.log('='.repeat(72))
    console.log(`Nio Downloader — Speed Benchmark [Mode: ${modeLabel}]`)
    console.log(`Target URL: ${options.url}`)
    console.log(`Planned Iterations: ${runs}`)
    console.log('='.repeat(72))
  }

  for (let i = 1; i <= runs; i++) {
    if (!options.json) {
      process.stdout.write(`Run ${i}/${runs}... `)
    }
    const result = await runSingleBenchmark(options, i)
    results.push(result)
    if (!options.json) {
      console.log(
        `done in ${result.durationSec.toFixed(2)}s | TTFB: ${result.ttfbSec.toFixed(2)}s | Avg: ${result.avgSpeedMBps.toFixed(2)} MB/s (${result.avgSpeedMbps.toFixed(2)} Mbps) | Peak: ${result.peakSpeedMBps.toFixed(2)} MB/s (${result.peakSpeedMbps.toFixed(2)} Mbps) | Conns: ${result.peakConnections}`
      )
    }
  }

  const durations = results.map((r) => r.durationSec)
  const ttfbs = results.map((r) => r.ttfbSec)
  const avgSpeeds = results.map((r) => r.avgSpeedMBps)
  const avgSpeedsMbps = results.map((r) => r.avgSpeedMbps)
  const peakSpeeds = results.map((r) => r.peakSpeedMBps)
  const peakSpeedsMbps = results.map((r) => r.peakSpeedMbps)
  const connections = results.map((r) => r.peakConnections)

  const summary = {
    mode: modeLabel,
    url: options.url,
    runs: results.length,
    effectiveOptions: results[0]?.effectiveOptions,
    durationSec: computeStats(durations),
    ttfbSec: computeStats(ttfbs),
    avgSpeedMBps: computeStats(avgSpeeds),
    avgSpeedMbps: computeStats(avgSpeedsMbps),
    peakSpeedMBps: computeStats(peakSpeeds),
    peakSpeedMbps: computeStats(peakSpeedsMbps),
    peakConnections: computeStats(connections),
    sha256: results[0]?.sha256,
    verified: options.expectedSha256
      ? results[0]?.sha256 === options.expectedSha256
      : null,
    runsDetail: results,
  }

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2))
    return summary
  }

  console.log(`\n${'-'.repeat(72)}`)
  console.log('Benchmark Summary Statistics:')
  console.log(
    `  Duration (s):   Min: ${summary.durationSec.min.toFixed(2)}s | Median: ${summary.durationSec.median.toFixed(2)}s | Max: ${summary.durationSec.max.toFixed(2)}s`
  )
  console.log(
    `  TTFB (s):       Min: ${summary.ttfbSec.min.toFixed(2)}s | Median: ${summary.ttfbSec.median.toFixed(2)}s | Max: ${summary.ttfbSec.max.toFixed(2)}s`
  )
  console.log(
    `  Avg Speed:      Min: ${summary.avgSpeedMBps.min.toFixed(2)} MB/s (${summary.avgSpeedMbps.min.toFixed(2)} Mbps) | Median: ${summary.avgSpeedMBps.median.toFixed(2)} MB/s (${summary.avgSpeedMbps.median.toFixed(2)} Mbps) | Max: ${summary.avgSpeedMBps.max.toFixed(2)} MB/s (${summary.avgSpeedMbps.max.toFixed(2)} Mbps)`
  )
  console.log(
    `  Peak Speed:     Min: ${summary.peakSpeedMBps.min.toFixed(2)} MB/s (${summary.peakSpeedMbps.min.toFixed(2)} Mbps) | Median: ${summary.peakSpeedMBps.median.toFixed(2)} MB/s (${summary.peakSpeedMbps.median.toFixed(2)} Mbps) | Max: ${summary.peakSpeedMBps.max.toFixed(2)} MB/s (${summary.peakSpeedMbps.max.toFixed(2)} Mbps)`
  )
  console.log(
    `  Connections:    Min: ${summary.peakConnections.min} | Median: ${summary.peakConnections.median} | Max: ${summary.peakConnections.max}`
  )
  if (summary.sha256) {
    console.log(`  SHA-256 Digest: ${summary.sha256}`)
  }
  console.log(`${'-'.repeat(72)}\n`)

  return summary
}

const invokedAsMain =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedAsMain) {
  runBenchmark()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`Benchmark failed: ${err.message}`)
      process.exit(1)
    })
}
