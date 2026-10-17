import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { convertInstallerPngs } from './render-installer-images.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const wasm = fs.readFileSync(path.join(REPO_ROOT, 'extra/tray/resvg.wasm'))
await initWasm(wasm)

function renderSvg(svgStr, width) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: width },
  })
  const pngData = resvg.render()
  return pngData.asPng()
}

function getAppIconSvg(active = false) {
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c1017"/>
      <stop offset="50%" stop-color="#121824"/>
      <stop offset="100%" stop-color="#182030"/>
    </linearGradient>
    <radialGradient id="glowGrad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#0c1017" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="leftStemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="diagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00F0FF"/>
      <stop offset="50%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="rightStemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#00E5FF" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background squircle -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#bgGrad)"/>
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#glowGrad)"/>
  <rect x="24" y="24" width="464" height="464" rx="108" fill="none" stroke="#334155" stroke-width="2" stroke-opacity="0.5"/>

  <!-- Main "N" Graphic Group with Shadow -->
  <g filter="url(#shadow)">
    <!-- Left vertical stem -->
    <rect x="136" y="128" width="60" height="256" rx="28" fill="url(#leftStemGrad)" filter="url(#glow)"/>

    <!-- Right vertical stem -->
    <rect x="316" y="128" width="60" height="256" rx="28" fill="url(#rightStemGrad)"/>

    <!-- Diagonal high-velocity slash connecting them -->
    <path d="M 148 140
             C 148 132 155 128 163 128
             L 194 128
             C 202 128 209 133 214 140
             L 348 350
             C 354 360 360 366 364 376
             C 366 382 360 384 354 384
             L 320 384
             C 310 384 303 379 298 372
             L 164 162
             C 158 152 152 146 148 140 Z"
          fill="url(#diagGrad)" filter="url(#glow)"/>

    <!-- Top Left Accent Cap Highlight -->
    <circle cx="166" cy="158" r="16" fill="#E0F2FE" fill-opacity="0.6"/>
  </g>

  ${
    active
      ? `
  <!-- Active Download Indicator Beacon -->
  <circle cx="410" cy="410" r="32" fill="#0c1017"/>
  <circle cx="410" cy="410" r="26" fill="#10B981" filter="url(#glow)"/>
  <circle cx="410" cy="410" r="14" fill="#34D399"/>
  `
      : ''
  }
</svg>`
}

function getTraySilhouetteSvg(color = '#FFFFFF', active = false) {
  return `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <title>Nio Downloader</title>
  <g fill="${color}" fill-rule="evenodd">
    <!-- Left stem -->
    <rect x="4" y="4" width="5.5" height="24" rx="2.5"/>
    <!-- Right stem -->
    <rect x="22.5" y="4" width="5.5" height="24" rx="2.5"/>
    <!-- Diagonal -->
    <path d="M 5 5 L 8.5 5 C 9.5 5 10.3 5.6 10.8 6.5 L 23.5 24.5 L 23.5 27 C 23.5 27 22.8 27 22 27 C 21 27 20.2 26.4 19.7 25.5 L 7 7.5 L 5 5 Z"/>
  </g>
  ${
    active
      ? `
  <circle cx="26" cy="26" r="4.5" fill="#10B981"/>
  <circle cx="26" cy="26" r="2" fill="#34D399"/>
  `
      : ''
  }
</svg>`
}

function getNioWordmarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="62" height="14" viewBox="0 0 62 14" class="h-auto w-full" aria-hidden="true">
  <g fill="currentColor" fill-rule="evenodd">
    <!-- N -->
    <path d="M 1 1 C 1 0.45 1.45 0 2 0 L 4.5 0 C 5.1 0 5.6 0.3 5.9 0.8 L 16.5 12.2 L 16.5 1 C 16.5 0.45 16.95 0 17.5 0 L 19.5 0 C 20.05 0 20.5 0.45 20.5 1 L 20.5 13 C 20.5 13.55 20.05 14 19.5 14 L 17 14 C 16.4 14 15.9 13.7 15.6 13.2 L 5 1.8 L 5 13 C 5 13.55 4.55 14 4 14 L 2 14 C 1.45 14 1 13.55 1 1 Z"/>

    <!-- I -->
    <rect x="27.5" y="0" width="4" height="14" rx="1.5"/>

    <!-- O -->
    <path d="M 46 0 C 41.5 0 38 3.1 38 7 C 38 10.9 41.5 14 46 14 L 54 14 C 58.5 14 62 10.9 62 7 C 62 3.1 58.5 0 54 0 Z M 46.5 3.5 L 53.5 3.5 C 55.7 3.5 57.5 5.1 57.5 7 C 57.5 8.9 55.7 10.5 53.5 10.5 L 46.5 10.5 C 44.3 10.5 42.5 8.9 42.5 7 C 42.5 5.1 44.3 3.5 46.5 3.5 Z"/>
  </g>
</svg>`
}

function getInstallerHeaderSvg() {
  return `<svg width="150" height="57" viewBox="0 0 150 57" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="headerBg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F1F5F9"/>
    </linearGradient>
    <linearGradient id="nGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00F0FF"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <rect width="150" height="57" fill="url(#headerBg)"/>
  <!-- Mini N Logo on the right -->
  <g transform="translate(100, 6) scale(0.09)">
    <rect width="464" height="464" rx="108" fill="#111827"/>
    <rect x="136" y="128" width="60" height="256" rx="28" fill="#38BDF8"/>
    <rect x="316" y="128" width="60" height="256" rx="28" fill="#818CF8"/>
    <path d="M 148 140 L 194 128 L 348 350 L 320 384 Z" fill="url(#nGrad)"/>
  </g>
</svg>`
}

function getInstallerSidebarSvg() {
  return `<svg width="164" height="314" viewBox="0 0 164 314" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sideBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0F19"/>
      <stop offset="50%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="sideNGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00F0FF"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <rect width="164" height="314" fill="url(#sideBg)"/>
  <!-- Decorative tech grid lines -->
  <path d="M 0 50 L 164 50 M 0 100 L 164 100 M 0 200 L 164 200 M 0 260 L 164 260" stroke="#1E293B" stroke-width="1" stroke-opacity="0.6"/>
  <circle cx="82" cy="110" r="60" fill="#38BDF8" fill-opacity="0.08"/>

  <!-- Centered Emblem -->
  <g transform="translate(42, 70) scale(0.16)">
    <rect width="464" height="464" rx="108" fill="#0F172A" stroke="#334155" stroke-width="4"/>
    <rect x="136" y="128" width="60" height="256" rx="28" fill="#38BDF8"/>
    <rect x="316" y="128" width="60" height="256" rx="28" fill="#818CF8"/>
    <path d="M 148 140 L 194 128 L 348 350 L 320 384 Z" fill="url(#sideNGrad)"/>
    <circle cx="166" cy="158" r="16" fill="#E0F2FE" fill-opacity="0.6"/>
  </g>

  <!-- Typography -->
  <text x="82" y="195" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="bold" fill="#F8FAFC">Nio Downloader</text>
  <text x="82" y="215" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#94A3B8">High-Speed Download Manager</text>
</svg>`
}

function encodeIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let offset = 6 + count * 16
  const dirBuffers = []
  const dataBuffers = []

  for (const item of entries) {
    const dir = Buffer.alloc(16)
    dir.writeUInt8(item.width >= 256 ? 0 : item.width, 0)
    dir.writeUInt8(item.height >= 256 ? 0 : item.height, 1)
    dir.writeUInt8(0, 2)
    dir.writeUInt8(0, 3)
    dir.writeUInt16LE(1, 4)
    dir.writeUInt16LE(32, 6)
    dir.writeUInt32LE(item.buffer.length, 8)
    dir.writeUInt32LE(offset, 12)

    dirBuffers.push(dir)
    dataBuffers.push(item.buffer)
    offset += item.buffer.length
  }

  return Buffer.concat([header, ...dirBuffers, ...dataBuffers])
}

function encodeIcns(entries) {
  const chunks = []
  let totalLength = 8
  for (const item of entries) {
    const chunkHeader = Buffer.alloc(8)
    chunkHeader.write(item.type, 0, 4, 'ascii')
    chunkHeader.writeUInt32BE(8 + item.buffer.length, 4)
    chunks.push(chunkHeader, item.buffer)
    totalLength += 8 + item.buffer.length
  }
  const fileHeader = Buffer.alloc(8)
  fileHeader.write('icns', 0, 4, 'ascii')
  fileHeader.writeUInt32BE(totalLength, 4)
  return Buffer.concat([fileHeader, ...chunks])
}

console.log('Generating Nio brand assets...')

// 1. App Icons
const appIcon512 = renderSvg(getAppIconSvg(false), 512, 512)
const appIcon256 = renderSvg(getAppIconSvg(false), 256, 256)
const appIcon128 = renderSvg(getAppIconSvg(false), 128, 128)
const appIcon64 = renderSvg(getAppIconSvg(false), 64, 64)
const appIcon48 = renderSvg(getAppIconSvg(false), 48, 48)
const appIcon32 = renderSvg(getAppIconSvg(false), 32, 32)
const appIcon24 = renderSvg(getAppIconSvg(false), 24, 24)
const appIcon16 = renderSvg(getAppIconSvg(false), 16, 16)
const appIcon1024 = renderSvg(getAppIconSvg(false), 1024, 1024)

fs.writeFileSync(path.join(REPO_ROOT, 'build/256x256.png'), appIcon512)
fs.writeFileSync(path.join(REPO_ROOT, 'public/app-icon.png'), appIcon512)
fs.writeFileSync(
  path.join(REPO_ROOT, 'public/apple-touch-icon.png'),
  appIcon256
)

// 2. Multi-resolution icon.ico
const icoBytes = encodeIco([
  { width: 256, height: 256, buffer: appIcon256 },
  { width: 128, height: 128, buffer: appIcon128 },
  { width: 64, height: 64, buffer: appIcon64 },
  { width: 48, height: 48, buffer: appIcon48 },
  { width: 32, height: 32, buffer: appIcon32 },
  { width: 24, height: 24, buffer: appIcon24 },
  { width: 16, height: 16, buffer: appIcon16 },
])
fs.writeFileSync(path.join(REPO_ROOT, 'build/icon.ico'), icoBytes)

// 3. Multi-resolution favicon.ico
const faviconBytes = encodeIco([
  { width: 48, height: 48, buffer: appIcon48 },
  { width: 32, height: 32, buffer: appIcon32 },
  { width: 16, height: 16, buffer: appIcon16 },
])
fs.writeFileSync(path.join(REPO_ROOT, 'public/favicon.ico'), faviconBytes)

// 4. Multi-resolution icon.icns
const icnsBytes = encodeIcns([
  { type: 'ic04', buffer: appIcon16 },
  { type: 'ic05', buffer: appIcon32 },
  { type: 'ic12', buffer: appIcon64 },
  { type: 'ic07', buffer: appIcon128 },
  { type: 'ic08', buffer: appIcon256 },
  { type: 'ic09', buffer: appIcon512 },
  { type: 'ic10', buffer: appIcon1024 },
])
fs.writeFileSync(path.join(REPO_ROOT, 'build/icon.icns'), icnsBytes)

// 4b. Torrent file association icons (.ico and .icns)
fs.writeFileSync(path.join(REPO_ROOT, 'build/torrent.ico'), icoBytes)
fs.writeFileSync(path.join(REPO_ROOT, 'build/torrent.icns'), icnsBytes)

// 4c. Linux PNG set
fs.mkdirSync(path.join(REPO_ROOT, 'build/icons'), { recursive: true })
const linuxSizes = [
  { size: 16, buf: appIcon16 },
  { size: 24, buf: appIcon24 },
  { size: 32, buf: appIcon32 },
  { size: 48, buf: appIcon48 },
  { size: 64, buf: appIcon64 },
  { size: 96, buf: renderSvg(getAppIconSvg(false), 96, 96) },
  { size: 128, buf: appIcon128 },
  { size: 256, buf: appIcon256 },
  { size: 512, buf: appIcon512 },
]
for (const { size, buf } of linuxSizes) {
  fs.writeFileSync(path.join(REPO_ROOT, `build/icons/${size}x${size}.png`), buf)
}

// 5. Tray Icons
const trayActive512 = renderSvg(getAppIconSvg(true), 512, 512)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-colorful-normal.png'),
  appIcon512
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-colorful-active.png'),
  trayActive512
)

fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-colorful-normal.ico'),
  icoBytes
)
const trayActiveIcoBytes = encodeIco([
  { width: 256, height: 256, buffer: renderSvg(getAppIconSvg(true), 256, 256) },
  { width: 128, height: 128, buffer: renderSvg(getAppIconSvg(true), 128, 128) },
  { width: 64, height: 64, buffer: renderSvg(getAppIconSvg(true), 64, 64) },
  { width: 48, height: 48, buffer: renderSvg(getAppIconSvg(true), 48, 48) },
  { width: 32, height: 32, buffer: renderSvg(getAppIconSvg(true), 32, 32) },
  { width: 16, height: 16, buffer: renderSvg(getAppIconSvg(true), 16, 16) },
])
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-colorful-active.ico'),
  trayActiveIcoBytes
)

// Monochrome tray silhouettes (32x32 @1x, 64x64 @2x)
const darkNormal = renderSvg(getTraySilhouetteSvg('#FFFFFF', false), 32, 32)
const darkNormal2x = renderSvg(getTraySilhouetteSvg('#FFFFFF', false), 64, 64)
const darkActive = renderSvg(getTraySilhouetteSvg('#FFFFFF', true), 32, 32)
const darkActive2x = renderSvg(getTraySilhouetteSvg('#FFFFFF', true), 64, 64)
const lightNormal = renderSvg(getTraySilhouetteSvg('#111827', false), 32, 32)
const lightNormal2x = renderSvg(getTraySilhouetteSvg('#111827', false), 64, 64)
const lightActive = renderSvg(getTraySilhouetteSvg('#111827', true), 32, 32)
const lightActive2x = renderSvg(getTraySilhouetteSvg('#111827', true), 64, 64)

fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-dark-normal@1x.png'),
  darkNormal
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-dark-normal@2x.png'),
  darkNormal2x
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-dark-active@1x.png'),
  darkActive
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-dark-active@2x.png'),
  darkActive2x
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-light-normal@1x.png'),
  lightNormal
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-light-normal@2x.png'),
  lightNormal2x
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-light-active@1x.png'),
  lightActive
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/nio-tray-light-active@2x.png'),
  lightActive2x
)

fs.writeFileSync(
  path.join(REPO_ROOT, 'extra/tray/tray.svg'),
  getTraySilhouetteSvg('#FFFFFF', false)
)

// 6. Wordmark SVG
const wordmarkSvg = getNioWordmarkSvg()
fs.writeFileSync(path.join(REPO_ROOT, 'public/nio-logo.svg'), wordmarkSvg)

// 7. Windows Store AppX Logos
fs.writeFileSync(
  path.join(REPO_ROOT, 'build/appx/Square150x150Logo.png'),
  renderSvg(getAppIconSvg(false), 300, 300)
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'build/appx/Square44x44Logo.png'),
  renderSvg(getAppIconSvg(false), 88, 88)
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'build/appx/StoreLogo.png'),
  renderSvg(getAppIconSvg(false), 100, 100)
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'build/appx/Wide310x150Logo.png'),
  renderSvg(
    `<svg width="620" height="300" viewBox="0 0 620 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="620" height="300" fill="#0C1017"/>
  <g transform="translate(160, 0)">
    ${getAppIconSvg(false).replace(/<svg[^>]*>|<\/svg>/g, '')}
  </g>
</svg>`,
    620,
    300
  )
)

// 8. Installer Images (PNG & 24-bit BMP)
fs.writeFileSync(
  path.join(REPO_ROOT, 'build/installer-header.png'),
  renderSvg(getInstallerHeaderSvg(), 150, 57)
)
fs.writeFileSync(
  path.join(REPO_ROOT, 'build/installer-sidebar.png'),
  renderSvg(getInstallerSidebarSvg(), 164, 314)
)

await convertInstallerPngs({ rootDir: REPO_ROOT })

console.log('All Nio brand assets generated successfully!')
