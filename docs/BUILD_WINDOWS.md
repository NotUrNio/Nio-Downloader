# Building Nio Downloader for Windows

This guide describes how to build standalone Windows installers (`.exe` NSIS installer, portable `.zip`, and unpacked application directory) on a Windows 10/11 or Windows Server host.

---

## 1. Prerequisites

A clean Windows machine requires:

1. **Node.js**: Version 22.x or 24.x (LTS recommended)
   - Download from [nodejs.org](https://nodejs.org/) or install via `winget`:
     ```powershell
     winget install OpenJS.NodeJS.LTS
     ```
2. **pnpm**: Version 12.8.1
   - Install via corepack or npm:
     ```powershell
     corepack enable
     corepack prepare pnpm@12.8.1 --activate
     ```
3. **Rust Toolchain**: Stable Rust with the MSVC target (`x86_64-pc-windows-msvc`)
   - Install via `rustup` from [rustup.rs](https://rustup.rs/):
     ```powershell
     winget install Rustlang.Rustup
     rustup default stable-x86_64-pc-windows-msvc
     rustup target add x86_64-pc-windows-msvc
     ```
4. **Visual Studio Build Tools**:
   - Install **Visual Studio Build Tools 2022** with the **"Desktop development with C++"** workload:
     ```powershell
     winget install Microsoft.VisualStudio.2022.BuildTools --override "--passive --config vsbuildtools.json --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
     ```
   - Ensure the following components are selected:
     - MSVC v143 - VS 2022 C++ x64/x86 build tools
     - Windows 10 or Windows 11 SDK
     - C++ CMake tools for Windows
5. **Git**:
   ```powershell
   winget install Git.Git
   ```

---

## 2. Environment Verification

Open a **Developer PowerShell for VS 2022** (or standard PowerShell where `cl.exe` and `cargo` are in `PATH`) and run:

```powershell
node --version       # v22.x or v24.x
pnpm --version       # 12.8.1
rustc --version      # 1.94+
cargo --version
cl.exe               # Microsoft C/C++ Optimizing Compiler
```

---

## 3. Step-by-Step Build Commands

Copy and paste the following commands sequentially:

```powershell
# 1. Clone the repository (if not already cloned)
git clone https://github.com/NotUrNio/Nio-Downloader.git
cd Nio-Downloader

# 2. Install dependencies (skipping engine fetch & rebuild until needed)
$env:NIODOWNLOADER_SKIP_ENGINE_FETCH = "1"
$env:NIODOWNLOADER_SKIP_ELECTRON_REBUILD = "1"
pnpm install --frozen-lockfile

# 3. Ensure Electron runtime payload is extracted
node node_modules/electron/install.js

# 4. Fetch the locked aria2 Windows x64 binary
node scripts/fetch-engine.mjs --platform win32 --arch x64

# 5. Verify third-party notices contract
pnpm run check:third-party-notices

# 6. Build builtin plugins
pnpm run build:builtin

# 7. Compile native host (Rust MSVC)
pnpm run build:native-host -- --platform win32 --arch x64

# 8. Compile finalize-fs (Rust MSVC)
pnpm run build:finalize-fs -- --platform win32 --arch x64

# 9. Build frontend and Electron main bundles
pnpm run build:electron

# 10. Stage Electron application package
pnpm run stage:electron -- --platform win32 --arch x64

# 11. Run electron-builder to generate NSIS setup executable and ZIP
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
pnpm exec electron-builder --win --x64 --publish never
```

---

## 4. Verification and Smoke Testing

Verify the generated package using the repository verification test suite:

```powershell
# 1. Verify unpacked electron application structure and size budgets
node scripts/verify-electron-package.mjs --app-dir release/win-unpacked --platform win32 --arch x64 --report release/size-reports/win32-x64.json

# 2. Verify Windows native host dynamic runtime imports
./scripts/verify-windows-native-host-dependencies.ps1 -Binary release/win-unpacked/resources/bin/nio-native-host.exe

# 3. Verify packaged aria2 WebSocket engine contract
$env:NIODOWNLOADER_ARIA2_TEST_BIN = "release/win-unpacked/resources/extra/win32/x64/aria2c.exe"
pnpm exec vitest run src/core/engine/aria2/engine-websocket-contract.integration.test.ts --reporter=verbose
```

---

## 5. Output Artifacts

All outputs will be located in the `release/` folder:
- **NSIS Setup Installer**: `release/Nio-Downloader-Setup-<version>.exe`
- **Portable ZIP**: `release/Nio-Downloader-<version>-win.zip`
- **Blockmaps**: `*.blockmap`
- **Update Manifest**: `release/latest.yml`

---

## 6. Unsigned Build Installation Notes (Windows SmartScreen)

When running an unsigned executable or NSIS installer (`Nio-Downloader-Setup-<version>.exe`) built without a code-signing certificate, Microsoft Defender SmartScreen displays a warning:
> **Windows protected your PC**
> Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app might put your PC at risk.

To complete installation:
1. Click **More info** on the prompt dialog.
2. Click **Run anyway** to proceed with installation.

