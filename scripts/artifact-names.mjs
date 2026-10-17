import { parseStrictSemVer } from './release-metadata.mjs'

export const PRODUCT_NAME = 'Nio Downloader'
export const ARTIFACT_BASE_NAME = 'Nio-Downloader'
export const DESKTOP_NAME = 'niodownloader'
export const EXECUTABLE_NAME = 'niodownloader'
export const PACMAN_PACKAGE_NAME = 'niodownloader'

export const APPIMAGE_ARCH = Object.freeze({
  x64: { artifact: 'x86_64', machine: 0x3e },
  arm64: { artifact: 'arm64', machine: 0xb7 },
})

export const PACMAN_ARCH_NAMES = Object.freeze({
  x64: 'x64',
  arm64: 'aarch64',
})

export const PACMAN_NATIVE_ARCH = Object.freeze({
  x64: 'x86_64',
  arm64: 'aarch64',
})

export const DEB_ARCH_NAMES = Object.freeze({
  x64: 'amd64',
  arm64: 'arm64',
})

export const RPM_ARCH_NAMES = Object.freeze({
  x64: 'x86_64',
  arm64: 'aarch64',
})

export const FLATPAK_ARCH_NAMES = Object.freeze({
  x64: 'x86_64',
  arm64: 'aarch64',
})

export function expectedPacmanName(version, arch) {
  parseStrictSemVer(version, 'release version')
  const pacmanArch = PACMAN_ARCH_NAMES[arch]
  if (!pacmanArch) {
    throw new Error(`Unsupported pacman architecture: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}-${version}-${pacmanArch}.pacman`
}

export function expectedAppImageName(version, arch) {
  parseStrictSemVer(version, 'release version')
  const architecture = APPIMAGE_ARCH[arch]
  if (!architecture) {
    throw new Error(`Unsupported AppImage arch: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}-${version}-${architecture.artifact}.AppImage`
}

export function expectedZsyncName(version, arch) {
  return `${expectedAppImageName(version, arch)}.zsync`
}

export function expectedDebName(version, arch) {
  parseStrictSemVer(version, 'release version')
  const debArch = DEB_ARCH_NAMES[arch]
  if (!debArch) {
    throw new Error(`Unsupported deb architecture: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}_${version}_${debArch}.deb`
}

export function expectedRpmName(version, arch) {
  parseStrictSemVer(version, 'release version')
  const rpmArch = RPM_ARCH_NAMES[arch]
  if (!rpmArch) {
    throw new Error(`Unsupported rpm architecture: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}-${version}.${rpmArch}.rpm`
}

export function expectedFlatpakName(version, arch) {
  parseStrictSemVer(version, 'release version')
  const flatpakArch = FLATPAK_ARCH_NAMES[arch]
  if (!flatpakArch) {
    throw new Error(`Unsupported flatpak architecture: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}-${version}-${flatpakArch}.flatpak`
}

export function expectedFlatpakCompanionName(version, arch) {
  parseStrictSemVer(version, 'release version')
  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`Unsupported Flatpak companion arch: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}-Native-Host-${version}-linux-${arch}.tar.gz`
}

export function expectedMacDmgName(version, arch) {
  parseStrictSemVer(version, 'release version')
  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`Unsupported macOS arch: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}-${version}-${arch}.dmg`
}

export function expectedMacZipName(version, arch) {
  parseStrictSemVer(version, 'release version')
  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`Unsupported macOS arch: ${arch}`)
  }
  return `${ARTIFACT_BASE_NAME}-${version}-${arch}.zip`
}

export function expectedWindowsExeName(version) {
  parseStrictSemVer(version, 'release version')
  return `${ARTIFACT_BASE_NAME}-Setup-${version}.exe`
}

export function expectedWindowsZipName(version) {
  parseStrictSemVer(version, 'release version')
  return `${ARTIFACT_BASE_NAME}-${version}-win.zip`
}
