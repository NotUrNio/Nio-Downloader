import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface LooseRecord {
  [key: string]: unknown
}

const ROOT = process.cwd()
const require = createRequire(import.meta.url)
const parseYaml = require('js-yaml').load as (source: string) => unknown
const interpolation = (value: string) => ['$', `{${value}}`].join('')
const IMAGE = interpolation(
  'NIODOWNLOADER_IMAGE:-niodownloader/nio-server:latest'
)
const LEGACY_BIND_IP = interpolation('NIODOWNLOADER_BIND_IP:-0.0.0.0')
const WEB_BIND_IP = interpolation(
  `NIODOWNLOADER_WEB_BIND_IP:-${LEGACY_BIND_IP}`
)
const MDXP_BIND_IP = interpolation(
  `NIODOWNLOADER_MDXP_BIND_IP:-${LEGACY_BIND_IP}`
)
const HTTP_PORT = interpolation('NIODOWNLOADER_HTTP_PORT:-8080')
const MDXP_PORT = interpolation('NIODOWNLOADER_MDXP_PUBLIC_PORT:-16801')
const PUBLIC_URL = interpolation('NIODOWNLOADER_PUBLIC_URL:-')
const REMOTE_EXTENSION_ENABLED = interpolation(
  'NIODOWNLOADER_REMOTE_EXTENSION_ENABLED:-false'
)
const REMOTE_EXTENSION_PUBLIC_URL = interpolation(
  'NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL:-'
)
const ALLOW_INSECURE_OPERATOR_HTTP = interpolation(
  'NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP:-false'
)
const ARIA2_RPC_LISTEN_ALL = interpolation(
  'NIODOWNLOADER_ARIA2_RPC_LISTEN_ALL:-false'
)

function record(value: unknown, label: string): LooseRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as LooseRecord
}

async function compose(file: string) {
  return record(parseYaml(await readFile(path.join(ROOT, file), 'utf8')), file)
}

function server(document: LooseRecord) {
  return record(record(document.services, 'services').server, 'server')
}

describe('NAS-importable Compose contract', () => {
  it.each(['compose.yaml', 'compose.named-volumes.yaml'])(
    '%s pulls the official image and retains the hardened runtime',
    async (file) => {
      const service = server(await compose(file))

      expect(service).not.toHaveProperty('build')
      expect(service).not.toHaveProperty('container_name')
      expect(service).not.toHaveProperty('privileged')
      expect(service.image).toBe(IMAGE)
      expect(service.init).toBe(true)
      expect(service.read_only).toBe(true)
      expect(service.restart).toBe('unless-stopped')
      expect(service.stop_grace_period).toBe('2m')
      expect(service.security_opt).toEqual(['no-new-privileges:true'])
      expect(service.tmpfs).toEqual([
        '/tmp:rw,noexec,nosuid,size=64m,mode=1777',
      ])
      expect(service.ports).toEqual([
        `${WEB_BIND_IP}:${HTTP_PORT}:8080`,
        `${MDXP_BIND_IP}:${MDXP_PORT}:16801`,
      ])
      expect(service.environment).toEqual({
        NIODOWNLOADER_ALLOWED_SAVE_DIRS: '/downloads',
        NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP:
          ALLOW_INSECURE_OPERATOR_HTTP,
        NIODOWNLOADER_ARIA2_RPC_LISTEN_ALL: ARIA2_RPC_LISTEN_ALL,
        NIODOWNLOADER_TORRENT_BODY_LIMIT_MIB: interpolation(
          'NIODOWNLOADER_TORRENT_BODY_LIMIT_MIB:-8'
        ),
        NIODOWNLOADER_DATA_DIR: '/data',
        NIODOWNLOADER_DEFAULT_SAVE_DIR: '/downloads',
        NIODOWNLOADER_MDXP_HOST: '0.0.0.0',
        NIODOWNLOADER_MDXP_PORT: 16801,
        NIODOWNLOADER_PLUGIN_DIR: '/data/plugins',
        NIODOWNLOADER_PUBLIC_URL: PUBLIC_URL,
        NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: REMOTE_EXTENSION_ENABLED,
        NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: REMOTE_EXTENSION_PUBLIC_URL,
        NIODOWNLOADER_TEMP_DIR: '/data/tmp',
      })
    }
  )

  it('uses two independent relative bind mounts in the NAS project', async () => {
    const service = server(await compose('compose.yaml'))
    expect(service.user).toBe(
      `${interpolation('NIODOWNLOADER_UID:-1000')}:${interpolation('NIODOWNLOADER_GID:-1000')}`
    )
    expect(service.volumes).toEqual([
      './nio-data:/data',
      './downloads:/downloads',
    ])
  })

  it('offers an independent named-volume variant without changing service behavior', async () => {
    const document = await compose('compose.named-volumes.yaml')
    const service = server(document)
    expect(service.user).toBe('1000:1000')
    expect(service.volumes).toEqual([
      'nio-data:/data',
      'nio-downloads:/downloads',
    ])
    expect(document.volumes).toEqual({
      'nio-data': null,
      'nio-downloads': null,
    })
  })

  it('offers a host reverse-proxy environment without changing container listeners', async () => {
    const environment = await readFile(
      path.join(ROOT, 'compose.reverse-proxy.env'),
      'utf8'
    )
    expect(environment).toContain('NIODOWNLOADER_WEB_BIND_IP=127.0.0.1')
    expect(environment).toContain('NIODOWNLOADER_MDXP_BIND_IP=127.0.0.1')
    expect(environment).not.toContain('NIODOWNLOADER_MDXP_HOST=127.0.0.1')
    expect(environment).not.toMatch(/^NIODOWNLOADER_PUBLIC_URL=/m)
  })
})
