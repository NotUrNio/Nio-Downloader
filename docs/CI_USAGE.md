# CI Usage and Cost Controls

## Overview

The CI suite (`.github/workflows/ci.yml`) is structured to minimize GitHub Actions minutes while preserving strict quality guarantees across all supported platforms. Because macOS runner minutes incur approximately ten times the cost of Linux runners on GitHub Actions plans, macOS-hosted smoke and validation jobs run selectively.

## Job Execution Matrix

| Job | Runner | Triggers | Notes |
|---|---|---|---|
| `ci` (lint, i18n, notices, typecheck, tests) | `ubuntu-24.04` | push (`main`), pull_request (`main`), `workflow_dispatch`, tags (`v*`) | Required aggregate gate; evaluates all dependencies |
| `server-runtime` (`linux-x64-musl`, `linux-arm64-musl`) | `ubuntu-22.04`, `ubuntu-22.04-arm` | push (`main`), pull_request (`main`), `workflow_dispatch`, tags (`v*`) | Docker server image smoke test and size report export |
| `rust-quality` | `ubuntu-24.04` | push (`main`), pull_request (`main`), `workflow_dispatch`, tags (`v*`) | Cargo fmt, clippy, and tests for native host & finalize-fs |
| `package-targets` (`linux-x64`, `linux-arm64`, `win32-x64`) | `ubuntu-22.04`, `ubuntu-22.04-arm`, `windows-2025` | push (`main`), pull_request (`main`), `workflow_dispatch`, tags (`v*`) | Packaging smoke for Linux and Windows targets |
| `package-targets-macos` (`darwin-arm64`, `darwin-x64`) | `macos-26`, `macos-26-intel` | `workflow_dispatch`, tags (`v*`) | macOS packaging smoke; skipped on push/PR |
| `safari-native-host` | `macos-26` | `workflow_dispatch`, tags (`v*`) | Validates macOS-only Safari FFI; skipped on push/PR |

### Aggregate `ci` Job Policy

When macOS jobs are skipped on routine push or pull request events, the aggregate `ci` job treats `skipped` as non-failing. However, if any job finishes with `failure` or `cancelled` status, the aggregate `ci` job fails immediately.

## Running macOS CI Jobs via GitHub CLI

To trigger the complete workflow manually, including all macOS jobs:

```bash
gh workflow run ci.yml
```

To run against a specific branch or commit ref:

```bash
gh workflow run ci.yml --ref <branch-or-ref>
```

## Running Checks Locally (macOS)

All checks executed by macOS runners can be executed locally without incurring runner minutes:

### 1. Lint, i18n, and Typecheck
```bash
pnpm run lint
pnpm run check:i18n
pnpm run check:schema-parity
pnpm run check:third-party-notices
pnpm exec tsc --noEmit
```

### 2. Safari Native Host & Helpers
```bash
cargo fmt --manifest-path packages/native-host/Cargo.toml --all -- --check
cargo clippy --manifest-path packages/native-host/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path packages/native-host/Cargo.toml --all-targets --all-features --locked
swift test --package-path packages/safari-bootstrap
pnpm run build:safari-bootstrap -- --arch arm64 --test
```

### 3. Native File Operations & Sidecars
```bash
cargo test --manifest-path packages/finalize-fs/Cargo.toml --locked --all-targets
```

### 4. macOS Packaging Smoke
To assemble and verify the macOS package locally:

```bash
pnpm run fetch:engine --platform darwin --arch arm64
pnpm run build:builtin
pnpm run build:native-host -- --platform darwin --arch arm64
pnpm run build:finalize-fs -- --platform darwin --arch arm64
pnpm run build:electron
pnpm run stage:electron -- --platform darwin --arch arm64
pnpm exec electron-builder --mac --arm64 --dir --publish never
node scripts/verify-electron-package.mjs \
  --app-dir "release/mac-arm64/Nio Downloader.app" \
  --platform darwin \
  --arch arm64 \
  --report "release/size-reports/darwin-arm64.json"
```
