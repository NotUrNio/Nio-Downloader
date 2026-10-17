// Integration test harness: spawns a real aria2c process against the bundled
// binary at `extra/<platform>/<arch>/aria2c` and exposes helpers to construct
// a full Aria2Adapter wired to it.
//
// Used by L3 integration tests that exercise aria2 behaviour end-to-end.
// Gated on binary presence via `bundledAria2Exists()` so tests skip cleanly
// on platforms that do not ship the binary.

import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { accessSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { aria2BinaryName } from '@shared/platform/aria2'
import { Aria2Adapter } from '../core/engine/aria2/aria2-adapter'
import { Aria2RpcClient } from '../core/engine/aria2/aria2-rpc-client'
import { JsonRpcProtocol } from '../core/engine/aria2/json-rpc-protocol'
import { WebSocketTransport } from '../core/engine/aria2/web-socket-transport'

export interface Aria2ProcessDiagnostics {
  exitCode: number | null
  signal: NodeJS.Signals | null
  spawnError: Error | null
  stderrLines: string[]
}

export interface Aria2Handle {
  proc: ChildProcess
  port: number
  secret: string
  kill(): Promise<void>
}

export interface SpawnAria2Options {
  baseDir: string
  /** Optional explicit binary for compatibility tests against older engines. */
  binaryPath?: string
  /** Additional engine flags for focused integration scenarios. */
  extraArgs?: readonly string[]
  port?: number
  secret?: string
  waitForHttpRpc?: boolean
}

// Resolve the bundled binary path relative to the repo root.
// `src/test-utils/` sits two levels below the repo root.
const REPO_ROOT = path.resolve(__dirname, '../..')
const EXTRA_DIR = path.resolve(REPO_ROOT, 'extra')

export function bundledAria2ExtraDir(): string {
  return EXTRA_DIR
}

export function resolveBundledAria2(): string {
  if (process.env.NIODOWNLOADER_ARIA2_TEST_BIN) {
    return path.resolve(process.env.NIODOWNLOADER_ARIA2_TEST_BIN)
  }
  return path.join(
    EXTRA_DIR,
    process.platform,
    process.arch,
    aria2BinaryName(process.platform)
  )
}

/** Returns true iff the bundled aria2 binary for the current platform exists. */
export function bundledAria2Exists(): boolean {
  try {
    accessSync(resolveBundledAria2())
    return true
  } catch {
    return false
  }
}

/**
 * Returns true iff the current test process is allowed to bind a loopback TCP
 * port. Some sandboxes allow process spawning but deny `listen(2)`, which makes
 * real aria2 RPC tests impossible even when the bundled binary exists.
 */
export function canBindLoopbackTcp(): boolean {
  const script = `
    const net = require('node:net')
    const server = net.createServer()
    server.on('error', () => process.exit(1))
    server.listen(0, '127.0.0.1', () => {
      server.close(() => process.exit(0))
    })
  `

  const result = spawnSync(process.execPath, ['-e', script], {
    stdio: 'ignore',
    timeout: 3000,
  })

  return result.status === 0
}

/**
 * Returns a free ephemeral TCP port assigned by the OS.
 */
export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address()
      const port = typeof address === 'object' && address ? address.port : 0
      srv.close((err) => {
        if (err) reject(err)
        else resolve(port)
      })
    })
    srv.on('error', reject)
  })
}

export interface WaitForRpcOptions {
  getDiagnostics?: () => Aria2ProcessDiagnostics
  pollIntervalMs?: number
}

/**
 * Poll aria2's RPC endpoint until it responds or the timeout elapses.
 * Uses HTTP POST (simpler than WebSocket for readiness probing).
 * If getDiagnostics is provided, fails immediately with stderr and exit status
 * when the process terminates prematurely.
 */
export async function waitForRpc(
  port: number,
  timeoutMs: number,
  options?: WaitForRpcOptions
): Promise<void> {
  const start = Date.now()
  let lastErr: unknown = null
  const pollInterval = options?.pollIntervalMs ?? 50

  while (Date.now() - start < timeoutMs) {
    if (options?.getDiagnostics) {
      const diag = options.getDiagnostics()
      if (diag.spawnError) {
        const stderr =
          diag.stderrLines.length > 0
            ? `\nLast stderr:\n${diag.stderrLines.join('\n')}`
            : ''
        throw new Error(
          `aria2 failed to spawn: ${diag.spawnError.message}${stderr}`
        )
      }
      if (diag.exitCode !== null || diag.signal !== null) {
        const exitDesc =
          diag.exitCode !== null
            ? `exit code ${diag.exitCode}`
            : `signal ${diag.signal}`
        const stderrDesc =
          diag.stderrLines.length > 0
            ? `\nLast stderr:\n${diag.stderrLines.join('\n')}`
            : '\n(no stderr captured)'
        throw new Error(
          `aria2 process exited prematurely with ${exitDesc} before RPC became ready on port ${port}.${stderrDesc}`
        )
      }
    }

    try {
      const res = await fetch(`http://127.0.0.1:${port}/jsonrpc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'probe',
          method: 'system.listMethods',
          params: [],
        }),
      })
      if (res.ok) return
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, pollInterval))
  }

  const diag = options?.getDiagnostics ? options.getDiagnostics() : undefined
  const detail = lastErr instanceof Error ? `: ${lastErr.message}` : ''
  const statusDesc = diag
    ? diag.exitCode !== null || diag.signal !== null
      ? ` (process exited with ${diag.exitCode !== null ? `code ${diag.exitCode}` : `signal ${diag.signal}`})`
      : ' (process still running)'
    : ''
  const stderrDesc =
    diag && diag.stderrLines.length > 0
      ? `\nLast stderr:\n${diag.stderrLines.join('\n')}`
      : ''

  throw new Error(
    `aria2 RPC did not come up within ${timeoutMs}ms${detail}${statusDesc}${stderrDesc}`
  )
}

/**
 * Spawn a fresh aria2c process for a test suite. The caller MUST invoke
 * `handle.kill()` in `afterAll` to avoid leaking processes.
 */
export async function spawnAria2ForTest(
  opts: SpawnAria2Options
): Promise<Aria2Handle> {
  const maxAttempts = opts.port ? 1 : 3
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const port = opts.port ?? (await getAvailablePort())
    const secret = opts.secret ?? 'test_secret'
    const bin = opts.binaryPath ?? resolveBundledAria2()

    const stderrLines: string[] = []
    let spawnError: Error | null = null
    let exitCode: number | null = null
    let exitSignal: NodeJS.Signals | null = null

    const proc = spawn(
      bin,
      [
        '--no-conf=true',
        '--no-netrc=true',
        '--enable-rpc=true',
        `--rpc-listen-port=${port}`,
        `--rpc-secret=${secret}`,
        '--rpc-allow-origin-all=true',
        '--enable-dht=false',
        '--enable-peer-exchange=false',
        '--bt-save-metadata=true',
        '--auto-file-renaming=false',
        '--allow-overwrite=false',
        '--bt-metadata-only=false',
        '--rpc-save-upload-metadata=true',
        '--console-log-level=warn',
        `--dir=${opts.baseDir}`,
        ...(opts.extraArgs ?? []),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    proc.stdout?.on('data', () => {})
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      for (const line of text.split('\n')) {
        if (line.trim()) {
          stderrLines.push(line)
          if (stderrLines.length > 30) stderrLines.shift()
        }
      }
    })

    proc.on('error', (err) => {
      spawnError = err
    })
    proc.on('exit', (code, signal) => {
      exitCode = code
      exitSignal = signal
    })

    const getDiagnostics = (): Aria2ProcessDiagnostics => ({
      exitCode,
      signal: exitSignal,
      spawnError,
      stderrLines: [...stderrLines],
    })

    if (opts.waitForHttpRpc !== false) {
      try {
        await waitForRpc(port, 5000, { getDiagnostics })
      } catch (err) {
        if (!proc.killed) proc.kill('SIGKILL')
        const isPortCollision = stderrLines.some(
          (l) =>
            l.includes('Failed to bind a socket') ||
            l.includes('Address already in use')
        )
        if (isPortCollision && attempt < maxAttempts) {
          lastError = err
          continue
        }
        throw err
      }
    }

    return {
      proc,
      port,
      secret,
      kill: async () => {
        if (proc.killed || proc.exitCode !== null) return
        await new Promise<void>((resolve) => {
          const hardKill = setTimeout(() => {
            if (!proc.killed && proc.exitCode === null) {
              proc.kill('SIGKILL')
            }
          }, 1000)
          hardKill.unref()
          proc.once('exit', () => {
            clearTimeout(hardKill)
            resolve()
          })
          proc.kill('SIGTERM')
        })
      },
    }
  }

  throw lastError
}

/**
 * Build an `Aria2Adapter` connected to a running test aria2. The caller is
 * responsible for disconnecting the transport during cleanup via the returned
 * `disconnect` callback (which tears down the shared WebSocket).
 */
export async function connectAdapter(handle: Aria2Handle): Promise<{
  adapter: Aria2Adapter
  rpc: Aria2RpcClient
  disconnect: () => void
}> {
  const transport = new WebSocketTransport()
  const protocol = new JsonRpcProtocol(transport)
  const rpc = new Aria2RpcClient(transport, protocol, handle.secret)
  await rpc.connect(handle.port)
  const adapter = new Aria2Adapter(rpc)
  await adapter.connect()
  return {
    adapter,
    rpc,
    disconnect: () => rpc.disconnect(),
  }
}
