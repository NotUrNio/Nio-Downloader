import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type Aria2ProcessDiagnostics,
  bundledAria2Exists,
  canBindLoopbackTcp,
  getAvailablePort,
  spawnAria2ForTest,
  waitForRpc,
} from './aria2'

describe('aria2 test harness diagnostics and lifecycle', () => {
  it('assigns a valid ephemeral TCP port from the OS', async () => {
    const port = await getAvailablePort()
    expect(typeof port).toBe('number')
    expect(port).toBeGreaterThan(1024)
    expect(port).toBeLessThanOrEqual(65535)
  })

  it('fails immediately with exit code and stderr when process terminates prematurely', async () => {
    const diagnostics: Aria2ProcessDiagnostics = {
      exitCode: 1,
      signal: null,
      spawnError: null,
      stderrLines: [
        'Exception: [SocketCore.cc:310] errorCode=1 Failed to bind a socket, cause: Address already in use',
      ],
    }

    await expect(
      waitForRpc(19999, 5000, {
        getDiagnostics: () => diagnostics,
      })
    ).rejects.toThrowError(
      /aria2 process exited prematurely with exit code 1.*Failed to bind a socket/s
    )
  })

  it('fails immediately with spawn error and stderr when process fails to spawn', async () => {
    const diagnostics: Aria2ProcessDiagnostics = {
      exitCode: null,
      signal: null,
      spawnError: new Error('ENOENT: binary not found'),
      stderrLines: ['spawn failure details'],
    }

    await expect(
      waitForRpc(19999, 5000, {
        getDiagnostics: () => diagnostics,
      })
    ).rejects.toThrowError(
      /aria2 failed to spawn: ENOENT: binary not found.*spawn failure details/s
    )
  })

  it('reports timeout and process running state when timeout expires', async () => {
    const diagnostics: Aria2ProcessDiagnostics = {
      exitCode: null,
      signal: null,
      spawnError: null,
      stderrLines: ['warning: still waiting'],
    }

    await expect(
      waitForRpc(19998, 150, {
        pollIntervalMs: 25,
        getDiagnostics: () => diagnostics,
      })
    ).rejects.toThrowError(
      /aria2 RPC did not come up within 150ms.*\(process still running\).*warning: still waiting/s
    )
  })

  describe.skipIf(!bundledAria2Exists() || !canBindLoopbackTcp())(
    'with bundled aria2 binary',
    () => {
      it('captures exit code and stderr when aria2 is spawned with invalid flags', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'nio-aria2-diag-'))
        try {
          await expect(
            spawnAria2ForTest({
              baseDir: dir,
              extraArgs: ['--unrecognized-test-flag=invalid'],
            })
          ).rejects.toThrowError(
            /aria2 process exited prematurely with exit code 28.*unrecognized option/s
          )
        } finally {
          await rm(dir, { recursive: true, force: true })
        }
      })

      it('spawns, reports ready via RPC, and kills cleanly', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'nio-aria2-lifecycle-'))
        let handle: Awaited<ReturnType<typeof spawnAria2ForTest>> | undefined
        try {
          handle = await spawnAria2ForTest({ baseDir: dir })
          expect(handle.port).toBeGreaterThan(1024)
          expect(handle.proc.exitCode).toBeNull()
        } finally {
          await handle?.kill()
          await rm(dir, { recursive: true, force: true })
        }
      })
    }
  )
})
