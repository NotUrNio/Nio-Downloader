import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dump, load } from 'js-yaml'
import { afterEach, describe, expect, it } from 'vitest'
import { consolidateReleaseArtifacts } from '../../scripts/consolidate-release-artifacts.mjs'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'nio-consolidate-release-test-')
  )
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('consolidateReleaseArtifacts', () => {
  it('merges latest-mac.yml manifests and copies installers', () => {
    const inputDir = makeTempDir()
    const outputDir = makeTempDir()

    const armDir = path.join(inputDir, 'release-artifacts-darwin-arm64')
    const x64Dir = path.join(inputDir, 'release-artifacts-darwin-x64')
    const winDir = path.join(inputDir, 'release-artifacts-win32-x64')
    const linuxDir = path.join(inputDir, 'release-artifacts-linux-x64')

    fs.mkdirSync(armDir)
    fs.mkdirSync(x64Dir)
    fs.mkdirSync(winDir)
    fs.mkdirSync(linuxDir)

    // macOS arm64
    fs.writeFileSync(
      path.join(armDir, 'Nio-Downloader-1.0.0-arm64.dmg'),
      'arm64 dmg content'
    )
    fs.writeFileSync(
      path.join(armDir, 'latest-mac.yml'),
      dump({
        version: '1.0.0',
        files: [
          {
            url: 'Nio-Downloader-1.0.0-arm64.zip',
            sha512: 'sha-arm64',
            size: 100,
          },
        ],
      })
    )

    // macOS x64
    fs.writeFileSync(
      path.join(x64Dir, 'Nio-Downloader-1.0.0-x64.dmg'),
      'x64 dmg content'
    )
    fs.writeFileSync(
      path.join(x64Dir, 'latest-mac.yml'),
      dump({
        version: '1.0.0',
        files: [
          { url: 'Nio-Downloader-1.0.0-x64.zip', sha512: 'sha-x64', size: 100 },
        ],
      })
    )

    // Windows
    fs.writeFileSync(
      path.join(winDir, 'Nio-Downloader-Setup-1.0.0.exe'),
      'win exe content'
    )
    fs.writeFileSync(
      path.join(winDir, 'latest.yml'),
      dump({ version: '1.0.0', path: 'Nio-Downloader-Setup-1.0.0.exe' })
    )

    // Linux
    fs.writeFileSync(
      path.join(linuxDir, 'Nio-Downloader-1.0.0-x86_64.AppImage'),
      'linux appimage content'
    )
    fs.writeFileSync(
      path.join(linuxDir, 'Nio-Downloader_1.0.0_amd64.deb'),
      'linux deb content'
    )
    fs.writeFileSync(
      path.join(linuxDir, 'latest-linux.yml'),
      dump({
        version: '1.0.0',
        files: [
          {
            url: 'Nio-Downloader_1.0.0_amd64.deb',
            sha512: 'sha-deb',
            size: 200,
          },
          {
            url: 'Nio-Downloader-1.0.0-x86_64.AppImage',
            sha512: 'sha-appimage',
            size: 300,
          },
        ],
        path: 'Nio-Downloader-1.0.0-x86_64.AppImage',
        sha512: 'sha-appimage',
      })
    )

    consolidateReleaseArtifacts({ inputDir, outputDir })

    const outputFiles = fs.readdirSync(outputDir).sort()
    expect(outputFiles).toEqual([
      'Nio-Downloader-1.0.0-arm64.dmg',
      'Nio-Downloader-1.0.0-x64.dmg',
      'Nio-Downloader-1.0.0-x86_64.AppImage',
      'Nio-Downloader-Setup-1.0.0.exe',
      'Nio-Downloader_1.0.0_amd64.deb',
      'latest-linux.yml',
      'latest-mac.yml',
      'latest.yml',
    ])

    const mergedMac = load(
      fs.readFileSync(path.join(outputDir, 'latest-mac.yml'), 'utf8')
    ) as { version: string; files: Array<{ url: string }>; path: string }
    expect(mergedMac.version).toBe('1.0.0')
    expect(mergedMac.files).toHaveLength(2)
    expect(mergedMac.path).toBe('Nio-Downloader-1.0.0-x64.zip')

    const outLinux = load(
      fs.readFileSync(path.join(outputDir, 'latest-linux.yml'), 'utf8')
    ) as {
      version: string
      files: Array<{ url: string }>
      path: string
      sha512: string
    }
    expect(outLinux.version).toBe('1.0.0')
    expect(outLinux.path).toBe('Nio-Downloader_1.0.0_amd64.deb')
    expect(outLinux.sha512).toBe('sha-deb')
  })
})
