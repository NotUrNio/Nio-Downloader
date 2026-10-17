#!/usr/bin/env node

/**
 * scripts/build-all.mjs
 *
 * Platform-aware build orchestrator for Nio Downloader installers.
 *
 * Runs the complete standalone packaging pipeline for the current host OS,
 * and politely refuses to cross-compile native desktop modules across operating
 * systems, pointing developers to the appropriate platform build documentation.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

function printUsage() {
  console.log(`
Usage: node scripts/build-all.mjs [options]

Options:
  --platform <darwin|win32|linux>   Target OS platform (default: current host OS)
  --arch <arm64|x64>                Target architecture (default: current host arch)
  --dir                             Produce unpacked directory only (macOS)
  --help                            Show this help message
`)
}

function runCommand(command, args, options = {}) {
  const display = `${command} ${args.join(' ')}`
  console.log(`\n\x1b[36m==>\x1b[0m \x1b[1m${display}\x1b[0m`)
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status}: ${display}`
    )
  }
}

function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    dir: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--help' || token === '-h') {
      printUsage()
      process.exit(0)
    }
    if (token === '--dir') {
      options.dir = true
      continue
    }
    if (token === '--platform') {
      options.platform = argv[index + 1]
      index += 1
      continue
    }
    if (token.startsWith('--platform=')) {
      options.platform = token.slice('--platform='.length)
      continue
    }
    if (token === '--arch') {
      options.arch = argv[index + 1]
      index += 1
      continue
    }
    if (token.startsWith('--arch=')) {
      options.arch = token.slice('--arch='.length)
      continue
    }
    console.error(`Unknown argument: ${token}`)
    printUsage()
    process.exit(1)
  }

  return options
}

async function buildDarwin(arch, dirOnly) {
  console.log(`\n\x1b[32mBuilding Nio Downloader for macOS (${arch})...\x1b[0m`)

  // 1. Fetch aria2 engine
  runCommand('node', [
    'scripts/fetch-engine.mjs',
    '--platform',
    'darwin',
    '--arch',
    arch,
  ])

  // 2. Validate third party notices contract
  runCommand('pnpm', ['run', 'check:third-party-notices'])

  // 3. Builtin plugins
  runCommand('pnpm', ['run', 'build:builtin'])

  // 4. Native packages
  runCommand('pnpm', [
    'run',
    'build:native-host',
    '--',
    '--platform',
    'darwin',
    '--arch',
    arch,
  ])
  runCommand('pnpm', [
    'run',
    'build:finalize-fs',
    '--',
    '--platform',
    'darwin',
    '--arch',
    arch,
  ])
  runCommand('pnpm', ['run', 'build:safari-bootstrap', '--', '--arch', arch])

  // 5. Build electron frontend & bundles
  runCommand('pnpm', ['run', 'build:electron'])

  // 6. Stage electron app
  runCommand('pnpm', [
    'run',
    'stage:electron',
    '--',
    '--platform',
    'darwin',
    '--arch',
    arch,
  ])

  // 7. Package with electron-builder
  const builderArgs = [
    'exec',
    'electron-builder',
    '--mac',
    `--${arch}`,
    '--publish',
    'never',
  ]
  if (dirOnly) {
    builderArgs.push('-c.mac.target=dir')
  }
  runCommand('pnpm', builderArgs, {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  })

  // 8. Verify electron package
  const appDir = `release/mac-${arch}/Nio Downloader.app`
  runCommand('node', [
    'scripts/verify-electron-package.mjs',
    '--app-dir',
    appDir,
    '--platform',
    'darwin',
    '--arch',
    arch,
  ])

  console.log(
    `\n\x1b[32m✓ Successfully built and verified macOS (${arch}) installer in release/\x1b[0m`
  )
}

async function buildWin32(arch) {
  console.log(
    `\n\x1b[32mBuilding Nio Downloader for Windows (${arch})...\x1b[0m`
  )

  runCommand('node', [
    'scripts/fetch-engine.mjs',
    '--platform',
    'win32',
    '--arch',
    arch,
  ])
  runCommand('pnpm', ['run', 'check:third-party-notices'])
  runCommand('pnpm', ['run', 'build:builtin'])
  runCommand('pnpm', [
    'run',
    'build:native-host',
    '--',
    '--platform',
    'win32',
    '--arch',
    arch,
  ])
  runCommand('pnpm', [
    'run',
    'build:finalize-fs',
    '--',
    '--platform',
    'win32',
    '--arch',
    arch,
  ])
  runCommand('pnpm', ['run', 'build:electron'])
  runCommand('pnpm', [
    'run',
    'stage:electron',
    '--',
    '--platform',
    'win32',
    '--arch',
    arch,
  ])
  runCommand(
    'pnpm',
    ['exec', 'electron-builder', '--win', `--${arch}`, '--publish', 'never'],
    {
      env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    }
  )
  runCommand('node', [
    'scripts/verify-electron-package.mjs',
    '--app-dir',
    'release/win-unpacked',
    '--platform',
    'win32',
    '--arch',
    arch,
  ])

  console.log(
    `\n\x1b[32m✓ Successfully built and verified Windows (${arch}) installer in release/\x1b[0m`
  )
}

async function buildLinux(arch) {
  console.log(`\n\x1b[32mBuilding Nio Downloader for Linux (${arch})...\x1b[0m`)

  runCommand('node', [
    'scripts/fetch-engine.mjs',
    '--platform',
    'linux',
    '--arch',
    arch,
  ])
  runCommand('pnpm', ['run', 'check:third-party-notices'])
  runCommand('pnpm', ['run', 'build:builtin'])
  runCommand('pnpm', [
    'run',
    'build:native-host',
    '--',
    '--platform',
    'linux',
    '--arch',
    arch,
  ])
  runCommand('pnpm', [
    'run',
    'build:finalize-fs',
    '--',
    '--platform',
    'linux',
    '--arch',
    arch,
  ])
  runCommand('pnpm', ['run', 'build:electron'])
  runCommand('pnpm', [
    'run',
    'stage:electron',
    '--',
    '--platform',
    'linux',
    '--arch',
    arch,
  ])
  runCommand(
    'pnpm',
    [
      'exec',
      'electron-builder',
      '--linux',
      'deb',
      'rpm',
      'pacman',
      'AppImage',
      `--${arch}`,
      '--publish',
      'never',
    ],
    { env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' } }
  )
  runCommand('node', [
    'scripts/verify-electron-package.mjs',
    '--app-dir',
    'release/linux-unpacked',
    '--platform',
    'linux',
    '--arch',
    arch,
  ])

  console.log(
    `\n\x1b[32m✓ Successfully built and verified Linux (${arch}) packages in release/\x1b[0m`
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.platform !== process.platform) {
    console.error(`
\x1b[33m[Notice: Cross-compilation not supported]\x1b[0m
Cannot build for target platform '${options.platform}' while running on '${process.platform}'.

Nio Downloader depends on native C++ and Rust modules ('better-sqlite3', 'nio-native-host', 'nio-finalize-fs')
that require platform-specific SDKs, header files, and toolchains (e.g., MSVC on Windows, musl/glibc on Linux).
To ensure reproducible, tested, and secure releases, standalone installers must be built natively on each OS.

For step-by-step instructions on building on other platforms:
  - Windows x64: see docs/BUILD_WINDOWS.md
  - Linux x64/arm64: see docs/BUILD_LINUX.md
`)
    process.exit(1)
  }

  if (options.platform === 'darwin') {
    if (options.arch === 'x64' && process.arch === 'arm64') {
      console.error(`
\x1b[33m[Notice: Darwin x64 requires an Intel Mac runner]\x1b[0m
Building macOS x64 on Apple Silicon (${process.arch}) requires the x86_64-apple-darwin Rust standard library
and an x86_64 native module compilation environment.

Please run on an Intel Mac host (or macos-26-intel CI runner), or build the native arm64 target:
  node scripts/build-all.mjs --arch arm64
`)
      process.exit(1)
    }
    await buildDarwin(options.arch, options.dir)
  } else if (options.platform === 'win32') {
    await buildWin32(options.arch)
  } else if (options.platform === 'linux') {
    await buildLinux(options.arch)
  } else {
    console.error(`Unsupported platform: ${options.platform}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\n\x1b[31mBuild failed:\x1b[0m', error.message || error)
  process.exit(1)
})
