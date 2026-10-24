# Nio Downloader Release Guide

This document outlines the standard release procedure, automated GitHub Actions release workflow, local multi-platform build instructions, artifact verification, checksum generation, manual GitHub Release publishing instructions, and unsigned build platform behavior.

---

## 1. Version Bump Procedure

1. **Update `package.json`**:
   Change `"version": "x.y.z"` to the target SemVer release version (e.g. `1.0.0`).
2. **Synchronize Workspace Packages**:
   Ensure any subpackages matching the release version are updated.
3. **Verify Lockfile**:
   If dependencies changed, update the lockfile:
   ```bash
   pnpm install --lockfile-only
   ```
4. **Create Release Notes**:
   Add release notes at `docs/release-notes/<version>.md`. The preflight release checks require this file to exist and match the version in `package.json`.
5. **Verify Notice Inventory**:
   ```bash
   pnpm run check:third-party-notices
   ```

---

## 2. GitHub Actions Release Workflow (`release-build.yml`)

The repository includes a dedicated manual-only GitHub Actions workflow at `.github/workflows/release-build.yml`. It builds native installers across macOS (arm64 & x64), Windows (x64), and Linux (x64), collects checksums, and creates a **draft** release on GitHub.

### Runner Environment Matrix
- **macOS Apple Silicon (`darwin-arm64`)**: `macos-14`
- **macOS Intel (`darwin-x64`)**: `macos-15-intel`
- **Windows x64 (`win32-x64`)**: `windows-2022`
- **Linux x64 (`linux-x64`)**: `ubuntu-24.04`

> [!NOTE]
> Intel macOS builds use the `macos-15-intel` runner image (`macos-13` having been retired by GitHub on December 4, 2025). GitHub has announced that Intel macOS runners will be dropped once macOS 15 is retired in Fall 2027, at which point x64 packages would have to be cross-built on an Apple Silicon runner.

### A. Starting the Workflow

#### Using GitHub CLI (`gh`):
```bash
# Dispatch the workflow on main (defaults to package.json version and draft creation):
gh workflow run release-build.yml -f version=1.0.0 -f create_draft=true
```

#### Using GitHub Web UI:
1. Navigate to the repository: `https://github.com/NotUrNio/Nio-Downloader/actions`.
2. Select **Release Build** in the left sidebar.
3. Click the **Run workflow** dropdown button.
4. Select branch `main`, verify the `version` input (default `1.0.0`), ensure `create_draft` is checked (`true`), and click **Run workflow**.

### B. Monitoring Workflow Execution

Track the progress of the run:
```bash
# List recent runs for the workflow:
gh run list --workflow=release-build.yml --limit 3

# Watch live output of the latest run:
gh run watch <run-id>
```

### C. Where to Find Generated Artifacts

Once all matrix build jobs finish:
1. **Per-Platform Artifacts**:
   - `release-artifacts-darwin-arm64`: macOS Apple Silicon DMG, ZIP, and `latest-mac.yml`.
   - `release-artifacts-darwin-x64`: macOS Intel DMG, ZIP, and `latest-mac.yml`.
   - `release-artifacts-win32-x64`: Windows NSIS installer (`.exe`), portable `.zip`, and `latest.yml`.
   - `release-artifacts-linux-x64`: Linux AppImage, `.deb`, `.rpm`, `.pacman`, Flatpak companion archive, and `latest-linux.yml`.
2. **Consolidated Release Bundle**:
   - `nio-downloader-v<version>-release-bundle`: Complete assembled directory containing all platform installers, merged update manifests, the bundled aria2 GPL source archive, and `SHA256SUMS.txt`.
3. Download via CLI:
   ```bash
   gh run download <run-id> -n nio-downloader-v1.0.0-release-bundle --dir ./release-v1.0.0
   ```

### D. Reviewing the Draft Release

When `create_draft` is enabled, the final workflow job automatically attaches all assets to a newly created **Draft Release** tagged `v<version>`.

1. **Verify Draft Status**:
   ```bash
   gh release view v1.0.0
   ```
2. **Web UI Review**:
   - Navigate to `https://github.com/NotUrNio/Nio-Downloader/releases`.
   - Locate the release titled `Nio Downloader <version>`. It will display a yellow **Draft** badge.
   - Draft releases are private to repository collaborators and are **never** visible to public users or downloaded by auto-updaters until published.
3. **Verify Release Contents**:
   - Confirm all expected installer files are attached:
     - `Nio-Downloader-1.0.0-arm64.dmg` & `.zip`
     - `Nio-Downloader-1.0.0-x64.dmg` & `.zip`
     - `Nio-Downloader-Setup-1.0.0.exe` & `Nio-Downloader-1.0.0-win.zip`
     - `Nio-Downloader-1.0.0-x86_64.AppImage` & `.zsync`
     - `Nio-Downloader_1.0.0_amd64.deb`
     - `Nio-Downloader-1.0.0.x86_64.rpm`
     - `Nio-Downloader-1.0.0-x64.pacman`
     - `Nio-Downloader-Native-Host-1.0.0-linux-x64.tar.gz`
     - `aria2-engine-source-1.37.0.19.tar.gz` (exact source code archive corresponding to the bundled engine build)
     - `latest.yml`, `latest-mac.yml`, `latest-linux.yml`
     - `SHA256SUMS.txt`
   - Confirm the release notes body matches `docs/release-notes/<version>.md`.

### E. Publishing the Release

Once the draft release has been reviewed and verified:

#### Using GitHub CLI:
```bash
gh release edit v1.0.0 --draft=false
```

#### Using GitHub Web UI:
1. Open the draft release edit view: `https://github.com/NotUrNio/Nio-Downloader/releases`.
2. Click the edit pencil icon next to the draft release.
3. Review title, notes, and attachments.
4. Click **Publish release**.

---

## 3. Multi-Platform Local Build Instructions

To build platform binaries locally on development machines:

### macOS (Apple Silicon & Intel)
On a macOS host:
```bash
# Build Apple Silicon (arm64):
pnpm run dist:mac

# On an Intel Mac runner for x64:
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --x64 --publish never
```

### Windows (x64)
On a Windows 10/11 or Windows Server host:
```powershell
pnpm run check:third-party-notices
pnpm run build:builtin
pnpm run build:native-host -- --platform win32 --arch x64
pnpm run build:finalize-fs -- --platform win32 --arch x64
pnpm run build:electron
pnpm run stage:electron -- --platform win32 --arch x64
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
pnpm exec electron-builder --win --x64 --publish never
```
*(See [BUILD_WINDOWS.md](BUILD_WINDOWS.md) for full setup instructions.)*

### Linux (x64 & arm64)
On an Ubuntu 22.04+ or 24.04+ host:
```bash
pnpm run check:third-party-notices
pnpm run build:builtin
pnpm run build:native-host -- --platform linux --arch x64
pnpm run build:finalize-fs -- --platform linux --arch x64
pnpm run build:electron
pnpm run stage:electron -- --platform linux --arch x64
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --linux deb rpm pacman AppImage --x64 --publish never
pnpm run package:flatpak-native-host -- --version "<version>" --arch x64 --output-dir release
```
*(See [BUILD_LINUX.md](BUILD_LINUX.md) for full setup instructions.)*

### Docker / Headless Server
```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --target runtime \
  -t niodownloader/server:<version> \
  .
```

---

## 4. Checksums and Release Assembly

### Artifact Naming Convention
All release artifacts must use hyphenated names with **no spaces**:
- macOS: `Nio-Downloader-<version>-<arch>.dmg`, `Nio-Downloader-<version>-<arch>.zip`
- Windows: `Nio-Downloader-Setup-<version>.exe`, `Nio-Downloader-<version>-win.zip`
- Linux: `Nio-Downloader-<version>-<arch>.AppImage`, `Nio-Downloader_<version>_<arch>.deb`, `Nio-Downloader-<version>.<arch>.rpm`, `Nio-Downloader-<version>-<arch>.pacman`

### Aria2 GPL Source Code Archive
To fulfill the GPL-2.0-or-later source code distribution requirement for the bundled aria2 binary, attach the exact corresponding source code tarball `aria2-engine-source-1.37.0.19.tar.gz` to each GitHub Release. The bundled binary build is compiled from the upstream aria2 tree at tag `v1.37.0-motrix.19` (<https://github.com/motrixapp/aria2/tree/v1.37.0-motrix.19>).
Fetch the exact source tarball into `release/`:
```bash
node scripts/fetch-aria2-source.mjs --output release
```
This produces `aria2-engine-source-1.37.0.19.tar.gz` matching `scripts/engine.lock.json`.

### Windows ARM64 Builds
Windows ARM64 installer packages (`win32-arm64`) are supported in build configuration but marked unverified until tested on native hardware. The GitHub Actions release workflow remains strictly manual-only.

### Generating SHA256SUMS.txt
In the `release/` directory:
```bash
cd release
files=$(find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" ! -name ".*" | sed 's|^\./||' | sort)
sha256sum $files > SHA256SUMS.txt
```

### Verifying Update Metadata
Ensure electron-builder update manifests match the release assets:
```bash
node scripts/verify-update-artifacts.mjs --dir release --version <version>
```

---

## 5. Auto-Update Capabilities & Unsigned Build Platform Behavior

| Platform | Manifest | Update Format | Auto-Update Unsigned? | User Experience on Unsigned Builds |
| --- | --- | --- | --- | --- |
| **macOS** | `latest-mac.yml` | `.zip` | **No** (Manual link) | Ad-hoc signed. See Gatekeeper instructions below. |
| **Windows** | `latest.yml` | NSIS `.exe` | **Yes** | Shows SmartScreen warning on install. Subsequent auto-updates apply directly. |
| **Linux (AppImage)** | `latest-linux.yml` | `.AppImage` (zsync) | **Yes** | Zsync differential update performs checksum verification with no OS signing barriers. |
| **Linux (deb/rpm/pacman)** | N/A | Package Managers | Via Repo | Managed via system APT/DNF/Pacman repositories. |

### macOS Gatekeeper & Ad-Hoc Signing Notes
- **Initial Launch**: Since macOS builds without an Apple Developer ID certificate are ad-hoc signed, macOS Gatekeeper blocks opening by double-click with the warning:
  `"Nio Downloader" cannot be opened because the developer cannot be verified.`
- **How Users Open the App**:
  1. In Finder, navigate to `/Applications`.
  2. **Right-click** (or Control-click) **Nio Downloader.app** and select **Open**.
  3. In the confirmation dialog, click **Open**.
  4. (Alternatively via Terminal):
     ```bash
     xattr -cr /Applications/"Nio Downloader.app"
     ```
- **Auto-Update Behavior**:
  Squirrel.Mac requires an Apple Developer ID code signature to validate update packages in the background. When running an unsigned or ad-hoc signed build, the in-app update checker detects updates but displays a **"Download update"** link button directing the user to the GitHub Releases page, rather than performing background auto-installation.

### Windows SmartScreen Notes
- **Initial Installation**: When running the unsigned `Nio-Downloader-Setup-<version>.exe`, Microsoft Defender SmartScreen displays:
  `Windows protected your PC: Microsoft Defender SmartScreen prevented an unrecognized app from starting.`
- **How Users Install the App**:
  1. Click **More info**.
  2. Click **Run anyway**.
- **Auto-Update Behavior**:
  Once installed, the NSIS auto-updater can apply subsequent updates automatically via `latest.yml`.

---

## 6. Testing Auto-Update (Version N to N+1) Locally

To test auto-updates locally without publishing to GitHub:

1. **Serve Update Manifest and Assets Locally**:
   Run a static web server from a directory containing the N+1 release files:
   ```bash
   npx serve -p 8000 release/
   ```
2. **Point Client to Local Server**:
   Configure `dev-app-update.yml` in the local application directory:
   ```yaml
   provider: generic
   url: http://localhost:8000/
   ```
3. **Launch Version N**:
   Start the version N application.
4. **Trigger Update Check**:
   In Settings > About, click **Check for updates** (or wait for background polling).
5. **Verify**:
   - Check that the download notification appears.
   - Verify that the downloaded file checksum matches the manifest.
   - Click **Restart to update** and ensure version N+1 launches cleanly with persisted settings.
