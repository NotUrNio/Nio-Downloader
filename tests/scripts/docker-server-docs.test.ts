import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

async function text(file: string) {
  return readFile(path.join(ROOT, file), 'utf8')
}

describe('public Docker Server documentation', () => {
  it.each(['docs/docker-server.md'])(
    '%s covers the public NAS installation and lifecycle contract',
    async (file) => {
      const document = await text(file)

      for (const required of [
        'docker.io/niodownloader/nio-server',
        'ghcr.io/noturnio/nio-server',
        'linux/amd64',
        'linux/arm64',
        'stable',
        'latest',
        'compose.yaml',
        'compose.named-volumes.yaml',
        'compose.reverse-proxy.env',
        '/data',
        '/downloads',
        'NIODOWNLOADER_UID',
        'NIODOWNLOADER_GID',
        'operator-token',
        'nio-admin pairing approve ABCD-EFGH',
        'NIODOWNLOADER_PUBLIC_URL',
        'NIODOWNLOADER_REMOTE_EXTENSION_ENABLED',
        'NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL',
        'NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP',
        'NIODOWNLOADER_WEB_BIND_IP',
        'NIODOWNLOADER_MDXP_BIND_IP',
        'NIODOWNLOADER_BIND_IP',
        'NIODOWNLOADER_ARIA2_RPC_LISTEN_ALL',
        '.nio-server-bridge-owner.json',
        'binding-insecure-mode',
        'docker compose down',
        '16800',
        '/mdxp/events',
        '/healthz',
        '/api/diagnostics',
        'DSM 7',
        'fnOS',
        'read-only',
        'HTTPS',
        'digest',
      ]) {
        expect(document, `${file} must mention ${required}`).toContain(required)
      }
      expect(document).not.toContain('docker compose up --build')
    }
  )

  it.each(['README.md'])(
    '%s uses the registry-first quick start',
    async (file) => {
      const document = await text(file)
      expect(document).toContain('docker compose pull server')
      expect(document).toContain('docker compose up -d --wait')
      expect(document).toMatch(
        /(?:niodownloader|nio)-admin pairing approve ABCD-EFGH/
      )
      expect(document).not.toContain('docker compose up --build')
    }
  )
})
