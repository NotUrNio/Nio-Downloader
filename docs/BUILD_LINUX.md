# Building Nio Downloader for Linux

This guide describes how to build standalone Linux packages (AppImage, `.deb`, `.rpm`, `.pacman`, Flatpak, and Snap) for `x64` (x86_64 / amd64) and `arm64` (aarch64) on a Linux host or Docker container.

---

## 1. Host Prerequisites

Recommended build host: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (native x86_64 or aarch64 machine).

### System Packages
Install required packaging tools and system build essentials:

```bash
sudo apt-get update
sudo apt-get install --yes \
  build-essential \
  python3 \
  python3-pip \
  python3-venv \
  rpm \
  squashfs-tools \
  zsync \
  zstd \
  libarchive-tools \
  desktop-file-utils \
  pkg-config \
  libasound2-dev
```

*Note on tools:*
- `squashfs-tools` provides `unsquashfs`, which is used by `verify-appimage-artifact.mjs` to extract and inspect the embedded desktop entry.
- `zsync` provides `zsyncmake` for differential AppImage updates.
- `rpm` provides tools to assemble `.rpm` packages.

### Node.js & pnpm
```bash
# Node.js 22 or 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
corepack enable
corepack prepare pnpm@12.8.1 --activate
```

### Rust Toolchain
Install Rust via `rustup` with the required musl targets:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# For x64 Linux:
rustup target add x86_64-unknown-linux-musl

# For arm64 Linux:
rustup target add aarch64-unknown-linux-musl
```

---

## 2. Linux x64 Build Pipeline

```bash
# 1. Clone repository
git clone https://github.com/NotUrNio/Nio-Downloader.git
cd Nio-Downloader

# 2. Install dependencies
export NIODOWNLOADER_SKIP_ENGINE_FETCH=1
export NIODOWNLOADER_SKIP_ELECTRON_REBUILD=1
pnpm install --frozen-lockfile

# 3. Ensure Electron runtime payload
node node_modules/electron/install.js

# 4. Fetch the locked aria2 Linux x64 binary
node scripts/fetch-engine.mjs --platform linux --arch x64

# 5. Verify third-party notices contract
pnpm run check:third-party-notices

# 6. Build builtin plugins
pnpm run build:builtin

# 7. Build native host (musl target)
pnpm run build:native-host -- --platform linux --arch x64

# 8. Build finalize-fs (musl target)
pnpm run build:finalize-fs -- --platform linux --arch x64

# 9. Build frontend and Electron main bundles
pnpm run build:electron

# 10. Stage Electron package directory
pnpm run stage:electron -- --platform linux --arch x64

# 11. Run electron-builder for deb, rpm, pacman, and AppImage
export CSC_IDENTITY_AUTO_DISCOVERY=false
pnpm exec electron-builder --linux deb rpm pacman AppImage --x64 --publish never

# 12. Build Flatpak companion package
VERSION=$(node -p "require('./package.json').version")
pnpm run package:flatpak-native-host -- --version "$VERSION" --arch x64 --output-dir release
```

---

## 3. Linux arm64 Build Pipeline

On an `aarch64` Linux runner (such as `ubuntu-22.04-arm`):

```bash
export TARGET_ARCH=arm64
node scripts/fetch-engine.mjs --platform linux --arch "$TARGET_ARCH"
pnpm run build:builtin
pnpm run build:native-host -- --platform linux --arch "$TARGET_ARCH"
pnpm run build:finalize-fs -- --platform linux --arch "$TARGET_ARCH"
pnpm run build:electron
pnpm run stage:electron -- --platform linux --arch "$TARGET_ARCH"
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --linux deb rpm pacman AppImage --arm64 --publish never
VERSION=$(node -p "require('./package.json').version")
pnpm run package:flatpak-native-host -- --version "$VERSION" --arch arm64 --output-dir release
```

---

## 4. Verification and Validation

Run the repository verification scripts to assert package compliance:

```bash
VERSION=$(node -p "require('./package.json').version")

# 1. Verify unpacked electron application structure
node scripts/verify-electron-package.mjs \
  --app-dir release/linux-unpacked \
  --platform linux \
  --arch x64 \
  --report release/size-reports/linux-x64.json

# 2. Verify Arch Linux (.pacman) package
node scripts/verify-pacman-artifact.mjs \
  --dir release \
  --version "$VERSION" \
  --arch x64

# 3. Smoke test Arch Linux package in container (if docker is available)
bash scripts/smoke-pacman-package.sh release

# 4. Verify AppImage artifact and embedded metadata
node scripts/verify-appimage-artifact.mjs \
  --dir release \
  --version "$VERSION" \
  --arch x64

# 5. Verify Flatpak native host companion archive
test -f "release/Nio-Downloader-Native-Host-${VERSION}-linux-x64.tar.gz"
```

---

## 5. Output Artifacts

Generated in `release/`:
- **AppImage**: `Nio-Downloader-<version>-x86_64.AppImage` (and `*.zsync`)
- **Debian**: `Nio-Downloader_<version>_amd64.deb`
- **RPM**: `Nio-Downloader-<version>.x86_64.rpm`
- **Pacman**: `Nio-Downloader-<version>-x64.pacman`
- **Flatpak Companion**: `Nio-Downloader-Native-Host-<version>-linux-x64.tar.gz`
- **Update Manifests**: `release/latest-linux.yml` (and `beta-linux.yml`)

---

## 6. Linux Package Installation Notes

- **AppImage**:
  Make the file executable and run:
  ```bash
  chmod +x Nio-Downloader-*.AppImage
  ./Nio-Downloader-*.AppImage
  ```
- **Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo apt-get install --yes ./Nio-Downloader_*_amd64.deb
  ```
- **Fedora / RHEL / openSUSE (`.rpm`)**:
  ```bash
  sudo dnf install ./Nio-Downloader-*.x86_64.rpm
  ```
- **Arch Linux (`.pacman`)**:
  ```bash
  sudo pacman -U ./Nio-Downloader-*-x64.pacman
  ```

