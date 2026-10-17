import { constants } from 'node:fs'
import { rm } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseNullDelimitedEnvironment,
  resolveExecutable,
  ShellEnvironmentResolver,
} from './shell-environment'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('resolveExecutable', () => {
  it('returns the first absolute executable and ignores relative PATH entries', async () => {
    const accessFile = vi.fn(async (candidate: string) => {
      if (candidate !== '/usr/bin/node') throw new Error('missing')
    })
    const statFile = vi.fn(async () => ({ isFile: () => true }))

    await expect(
      resolveExecutable(
        'node',
        { PATH: 'relative:/usr/bin' },
        {
          platform: 'linux',
          accessFile: accessFile as never,
          statFile: statFile as never,
        }
      )
    ).resolves.toBe('/usr/bin/node')
  })

  it('honors Windows PATHEXT order and requires a file', async () => {
    const accessFile = vi.fn(async (candidate: string) => {
      if (candidate !== 'C:\\Tools\\npm.CMD') throw new Error('missing')
    })
    const statFile = vi.fn(async () => ({ isFile: () => true }))

    await expect(
      resolveExecutable(
        'npm',
        { Path: 'C:\\Tools', PATHEXT: '.EXE;.CMD' },
        {
          platform: 'win32',
          accessFile: accessFile as never,
          statFile: statFile as never,
        }
      )
    ).resolves.toBe('C:\\Tools\\npm.CMD')
    expect(accessFile).toHaveBeenCalledWith(
      'C:\\Tools\\npm.CMD',
      constants.F_OK
    )
  })
})

describe('parseNullDelimitedEnvironment', () => {
  it('keeps only well-formed NAME=value records', () => {
    expect(
      parseNullDelimitedEnvironment(
        'PATH=/opt/bin\x00A=value=with=equals\x009BAD=no\x00BROKEN\x00'
      )
    ).toEqual({ PATH: '/opt/bin', A: 'value=with=equals' })
  })
})

describe('ShellEnvironmentResolver', () => {
  it('sees Windows PATH entries written after the app started', async () => {
    const readWindowsPaths = vi
      .fn<() => Promise<readonly string[]>>()
      .mockResolvedValueOnce(['C:\\Windows\\System32'])
      .mockResolvedValueOnce([
        'C:\\Windows\\System32;C:\\Program Files\\nodejs\\',
        '%APPDATA%\\npm',
      ])
    const resolver = new ShellEnvironmentResolver({
      inheritedEnv: {
        Path: 'C:\\Nio\\bin;C:\\Windows\\System32',
        APPDATA: 'C:\\Users\\example\\AppData\\Roaming',
      },
      platform: 'win32',
      readWindowsPaths,
    })

    await expect(resolver.resolve()).resolves.toMatchObject({
      Path: 'C:\\Nio\\bin;C:\\Windows\\System32',
    })
    await expect(resolver.resolve()).resolves.toMatchObject({
      Path: [
        'C:\\Nio\\bin',
        'C:\\Windows\\System32',
        'C:\\Program Files\\nodejs\\',
        'C:\\Users\\example\\AppData\\Roaming\\npm',
      ].join(';'),
    })
    expect(readWindowsPaths).toHaveBeenCalledTimes(2)
  })

  it('merges and caches the login-shell environment', async () => {
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout:
        'startup output that is not environment data\n__NIO_CLI_ENV__\0PATH=/shell/bin\0SHELL_FLAG=yes\0',
      stderr: '',
    })
    const resolver = new ShellEnvironmentResolver({
      inheritedEnv: { PATH: '/inherited/bin', KEEP: 'yes' },
      platform: 'darwin',
      getLoginShell: () => '/bin/zsh',
      run,
      accessFile: vi.fn().mockResolvedValue(undefined),
      statFile: vi.fn().mockResolvedValue({ isFile: () => true }) as never,
    })

    await expect(resolver.resolve()).resolves.toEqual({
      PATH: '/shell/bin',
      KEEP: 'yes',
      SHELL_FLAG: 'yes',
    })
    await resolver.resolve()
    expect(run).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-i', '-l', '-c', "printf '__NIO_CLI_ENV__\\000'; env -0"],
      expect.objectContaining({ timeoutMs: 10_000 })
    )

    await resolver.resolve(true)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it.each([
    { code: 1, stdout: '', stderr: 'failed' },
    { code: null, stdout: '', stderr: '', timedOut: true },
    { code: 0, stdout: 'PATH=/partial', stderr: '', truncated: true },
    { code: 0, stdout: 'PATH=/untrusted\0', stderr: '' },
  ])(
    'falls back to inherited env for an unusable shell result',
    async (result) => {
      const resolver = new ShellEnvironmentResolver({
        inheritedEnv: { PATH: '/safe/bin' },
        platform: 'linux',
        getLoginShell: () => '/bin/sh',
        run: vi.fn().mockResolvedValue(result),
        accessFile: vi.fn().mockResolvedValue(undefined),
        statFile: vi.fn().mockResolvedValue({ isFile: () => true }) as never,
      })

      await expect(resolver.resolve()).resolves.toEqual({ PATH: '/safe/bin' })
    }
  )
})
