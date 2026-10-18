# Nio Downloader Installation Guide

This document provides installation instructions for Nio Downloader across supported platforms.

## Download

Download release files for version 1.0.0 from [GitHub Releases](https://github.com/NotUrNio/Nio-Downloader/releases/tag/v1.0.0):

| Platform | Architecture | Installer | Format | Notes |
| --- | --- | --- | --- | --- |
| macOS | Apple Silicon (arm64) | [Nio-Downloader-1.0.0-arm64.dmg](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/Nio-Downloader-1.0.0-arm64.dmg) | DMG | Right-click Open to bypass Gatekeeper |
| macOS | Intel (x64) | [Nio-Downloader-1.0.0-x64.dmg](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/Nio-Downloader-1.0.0-x64.dmg) | DMG | Right-click Open to bypass Gatekeeper |
| Windows | x64 | [Nio-Downloader-Setup-1.0.0.exe](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/Nio-Downloader-Setup-1.0.0.exe) | NSIS EXE | SmartScreen: More info then Run anyway |
| Linux | x86_64 | [Nio-Downloader-1.0.0-x86_64.AppImage](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/Nio-Downloader-1.0.0-x86_64.AppImage) | AppImage | Make executable with chmod +x |
| Linux | amd64 | [Nio-Downloader_1.0.0_amd64.deb](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/Nio-Downloader_1.0.0_amd64.deb) | DEB | Debian and Ubuntu |
| Linux | x86_64 | [Nio-Downloader-1.0.0.x86_64.rpm](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/Nio-Downloader-1.0.0.x86_64.rpm) | RPM | Fedora and RHEL |
| Linux | x64 | [Nio-Downloader-1.0.0-x64.pacman](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/Nio-Downloader-1.0.0-x64.pacman) | PACMAN | Arch Linux |

Checksums for all packages are published in [SHA256SUMS.txt](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/SHA256SUMS.txt). Matching aria2 engine source code is available in [aria2-1.37.0-motrix.16-source.tar.gz](https://github.com/NotUrNio/Nio-Downloader/releases/download/v1.0.0/aria2-1.37.0-motrix.16-source.tar.gz). Releases archive: [GitHub Releases](https://github.com/NotUrNio/Nio-Downloader/releases).

---

## macOS Installation

### 1. Download
Download the appropriate installer for your Mac architecture from the release page:
- **Apple Silicon (M1/M2/M3/M4/M5):** `Nio-Downloader-<version>-arm64.dmg` or `Nio-Downloader-<version>-arm64.zip`
- **Intel Mac (x86_64):** `Nio-Downloader-<version>-x64.dmg` or `Nio-Downloader-<version>-x64.zip`

### 2. Install
1. Open the `.dmg` file.
2. Drag **Nio Downloader** into the **Applications** folder.
3. Eject the DMG disk image.

*(If using the `.zip` archive, extract it and move `Nio Downloader.app` to `/Applications`.)*

### 3. Gatekeeper Bypass (Unsigned / Ad-hoc Signed Builds)
Official public releases signed with an Apple Developer ID and notarized by Apple launch automatically. However, local or ad-hoc builds produced without Apple Developer signing credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `CSC_LINK`) will be flagged by macOS Gatekeeper:

> *"Nio Downloader cannot be opened because Apple cannot check it for malicious software"* or *"Apple could not verify that Nio Downloader is free of malware."*

To open the application:

#### Option A: Context Menu (Quickest GUI method)
1. In Finder, open `/Applications`.
2. **Right-click** (or Control-click) `Nio Downloader.app`.
3. Select **Open** from the menu.
4. When the confirmation prompt appears, click **Open**. (macOS remembers this choice).

#### Option B: System Settings
1. Open **System Settings** > **Privacy & Security**.
2. Scroll down to the **Security** section.
3. You will see: *"Nio Downloader was blocked from use because it is not from an identified developer"*.
4. Click **Open Anyway** and confirm with your password or Touch ID.

#### Option C: Terminal (Remove Quarantine Extended Attribute)
Run the following command in Terminal:
```bash
xattr -d com.apple.quarantine "/Applications/Nio Downloader.app"
```
Or recursively strip quarantine and metadata attributes:
```bash
xattr -cr "/Applications/Nio Downloader.app"
```

### Security & Hardened Runtime
Nio Downloader is built with macOS Hardened Runtime enabled and uses strict entitlements (`build/entitlements.mac.plist`):
- `com.apple.security.cs.allow-jit`: Required for Chromium/V8 JavaScript execution.
- `com.apple.security.cs.allow-unsigned-executable-memory`: Required for V8 JIT code generation.
- `com.apple.security.cs.disable-library-validation`: Required to load native bindings (`better-sqlite3`) packaged inside the app bundle.
- `com.apple.security.cs.allow-dyld-environment-variables`: Required to execute bundled engine processes (`aria2c`).
- `com.apple.security.network.client` / `com.apple.security.network.server`: Required for HTTP/BitTorrent downloads and local RPC socket communication.

---

## Windows Installation

### 1. Download
- **NSIS Installer:** `Nio-Downloader-Setup-<version>.exe`
- **Portable ZIP:** `Nio-Downloader-<version>-win.zip`

### 2. Install
- Run `Nio-Downloader-Setup-<version>.exe` and follow the on-screen setup wizard.
- Select your destination directory and desktop shortcut preferences.
- If Windows SmartScreen displays *"Windows protected your PC"*, click **More info** and then click **Run anyway**.

---

## Linux Installation

### AppImage (Universal)
```bash
chmod +x Nio-Downloader-<version>-x86_64.AppImage
./Nio-Downloader-<version>-x86_64.AppImage
```

### Debian / Ubuntu (`.deb`)
```bash
sudo dpkg -i Nio-Downloader_<version>_amd64.deb
sudo apt-get install -f # resolve any missing runtime dependencies
```

### Fedora / RHEL (`.rpm`)
```bash
sudo dnf install Nio-Downloader-<version>.x86_64.rpm
# or on older systems:
sudo rpm -ivh Nio-Downloader-<version>.x86_64.rpm
```

### Arch Linux (`.pacman`)
```bash
sudo pacman -U Nio-Downloader-<version>-x64.pacman
```

### Flatpak
```bash
flatpak install --user Nio-Downloader-<version>-x86_64.flatpak
```

---

## Docker / Headless Server

To run Nio Downloader in headless server mode on a NAS or Linux server, see [SERVER.md](SERVER.md).

