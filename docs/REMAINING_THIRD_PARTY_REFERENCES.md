# Remaining Third-Party References (Category C Contracts)

This document exhaustively records every remaining reference to third-party names, contracts, and upstream packages retained in the Nio Downloader codebase, along with the technical rationale, license and copyright status, and planned removal/migration strategy for each.

Per project release policy, no owned internal identifiers or user-facing brand strings retain upstream third-party names; only genuine external contracts, pinned binary artifacts, and published dependency specifications are documented here.

---

## 1. Pinned Upstream `aria2` Engine Release (`motrixapp/aria2`)

The desktop application bundles a verified build of the `aria2` download engine with SQLite history persistence and custom RPC patches.

- **Pinned Upstream Version**: `v1.37.0-motrix.19` (engine self-reported version `1.37.0-motrix.19`)
- **Upstream Repository**: <https://github.com/motrixapp/aria2>
- **Neutral Distribution Assets**: Hosted on releases as `aria2-engine-1.37.0.19-<os>-<arch>.<ext>` and source archive `aria2-engine-source-1.37.0.19.tar.gz`
- **License**: GNU General Public License v2.0 or later (`GPL-2.0-or-later`) with OpenSSL exception. Full text preserved in `THIRD_PARTY_LICENSES/aria2-COPYING` and `THIRD_PARTY_LICENSES/aria2-LICENSE.OpenSSL`.
- **Copyright**: Copyright (C) 2006-2019 Tatsuhiro Tsujikawa and contributors.

### Affected Files and Lines

| File | Line(s) | Role / Content |
|---|---|---|
| `scripts/engine.lock.json` | 5 | Engine self-reported version string `1.37.0-motrix.19` retained for runtime `--version` validation against prebuilt binaries. |
| `flatpak/app.niodownloader.native.yml` | 104, 126, 127, 140, 142 | Flatpak build manifest pinning git source URL, release tag `v1.37.0-motrix.19`, commit `5c636cc13753a3b3384ec7f51a2587f851d2e4bd`, and version assertion. |
| `scripts/verify-flatpak-packaging.mjs` | 20, 22, 157 | Packaging integrity verifier asserting engine git URL, commit, and version pattern `\d+\.\d+\.\d+-motrix\.\d+`. |
| `.github/workflows/flatpak.yml` | 352 | CI smoke check verifying compiled binary reports `aria2 version 1.37.0-motrix.19`. |
| `THIRD_PARTY_NOTICES.md` | 91, 92 | Required third-party legal notice recording engine version and upstream source pointer URL. |
| `src/core/engine/aria2/feature-report.ts` | 22, 81 | Regex `/^\d+\.\d+\.\d+-(?:nio|motrix)\.\d+$/i` matching engine version format from upstream binaries. |
| `scripts/smoke-server-image.mjs` | 664 | Server Docker image verification regex checking engine version suffix. |
| `tests/check-third-party-notices.test.ts` | 473, 475 | Test asserting third-party notice contains exact version and source pointer. |
| `tests/generate-third-party-notices.test.ts` | 167, 270 | Test asserting legal inventory lists exact engine version. |

### Technical Rationale for Retaining the Self-Reported Version String
The pre-compiled engine binary outputs `aria2 version 1.37.0-motrix.19` when queried with `aria2c --version`. Retaining `1.37.0-motrix.19` in `scripts/engine.lock.json` is strictly necessary for runtime integrity verification and diagnostics matching. All asset filenames and distribution archives use neutral names (`aria2-engine-1.37.0.19-*`). Nio Downloader documentation explicitly acknowledges the upstream source and does not claim internal compilation of the binary.

### Planned Removal Strategy
1. Fork `motrixapp/aria2` to `NotUrNio/aria2` on GitHub.
2. Establish a GitHub Actions build workflow to compile aria2 with SQLite persistence and custom RPC patches under tag `v1.37.0-nio.1`.
3. Attach prebuilt binaries and the corresponding source tarball directly to `NotUrNio/Nio-Downloader` GitHub releases so the project is completely self-contained.
4. Update `scripts/engine.lock.json` and packaging manifests to pin `NotUrNio/aria2`.

---

## 2. Published External npm Package: `@motrix/nat`

Cross-platform UPnP and NAT-PMP port mapping library supporting multi-adapter and VPN/Tailscale routing environments.

- **Package**: `@motrix/nat` (version `^0.1.4`)
- **Registry**: <https://www.npmjs.com/package/@motrix/nat>
- **License**: MIT License (`MIT`). Verified in package directory and reproduced in `build/legal/THIRD_PARTY_LICENSES.txt`.
- **Copyright**: Copyright (c) 2018-present Dr_rOot.

### Affected Files and Lines

| File | Line(s) | Role / Content |
|---|---|---|
| `package.json` | 127 | Runtime dependency declaration `"@motrix/nat": "^0.1.4"`. |
| `pnpm-lock.yaml` | 191, 1122, 5488 | Lockfile package resolution, integrity hash, and package tree entry. |
| `pnpm-workspace.yaml` | 41 | Workspace catalog version constraint `@motrix/nat@0.1.0 \|\| 0.1.1 \|\| 0.1.3 \|\| 0.1.4`. |
| `flatpak/generated-sources.json` | 920, 922 | Offline Flatpak tarball URL and destination filename mapping. |
| `scripts/electron-runtime-dependencies.json` | 12 | Packaged Electron app runtime dependency allowlist. |
| `src/shared/types/nat.ts` | 15 | Type re-export `from '@motrix/nat/types'`. |
| `src/core/nat/settings-nat-provider.ts` | 2 | Type import `from '@motrix/nat'`. |
| `src/main/index.ts` | 124 | Main process type import `from '@motrix/nat'`. |
| `src/main/ipc/commands.ts` | 94 | IPC commands type import `from '@motrix/nat'`. |
| `src/main/ipc/nat-commands.ts` | 1 | IPC handler import `{ type NatManager, TokenBucket } from '@motrix/nat'`. |
| `src/main/ipc/nat-commands.test.ts` | 1 | Test type import `from '@motrix/nat'`. |
| `src/main/ipc/queries.ts` | 39 | Queries handler type import `from '@motrix/nat'`. |
| `src/main/nat/nat-manager-factory.ts` | 20 | Factory implementation import `from '@motrix/nat'`. |
| `src/main/nat/nat-manager-factory.test.ts` | 37 | Test mock `vi.mock('@motrix/nat', ...)`. |
| `src/main/nat/nio-nat-manager.ts` | 9 | Manager wrapper import `from '@motrix/nat'`. |
| `src/main/nat/nio-nat-manager.test.ts` | 10 | Manager test import `from '@motrix/nat'`. |
| `tests/scripts/electron-package-contract.test.ts` | 240 | Packaged Electron bundle dependency verification. |
| `tests/scripts/audit-server-runtime.test.ts` | 330 | Server bundle runtime boundary assertion. |

### Why It Cannot Be Renamed Yet
`@motrix/nat` is an external npm package published under that specific package name on the npm public registry.

### Planned Removal Strategy
In v2.1, either vendor the codebase into `packages/nat` under `@niodownloader/nat` (mirroring how `packages/mdxp` was successfully vendored) or publish `@niodownloader/nat` to npm.

---

## 3. Published External npm Package: `@motrix/plugin-manifest-schema`

Defines the authoritative JSON/Zod schema used to validate plugin manifests (`nio-plugin.json`).

- **Package**: `@motrix/plugin-manifest-schema` (version `^2.1.1`)
- **Registry**: <https://www.npmjs.com/package/@motrix/plugin-manifest-schema>
- **License**: MIT License (`MIT`). Verified in package directory and reproduced in `build/legal/THIRD_PARTY_LICENSES.txt`.
- **Copyright**: Copyright (c) 2018-present Dr_rOot.

### Affected Files and Lines

| File | Line(s) | Role / Content |
|---|---|---|
| `package.json` | 128 | Runtime dependency declaration `"@motrix/plugin-manifest-schema": "^2.1.1"`. |
| `pnpm-lock.yaml` | 194, 1129, 5492 | Lockfile resolution, integrity hash, and package tree entry. |
| `pnpm-workspace.yaml` | 44 | Workspace catalog constraint `@motrix/plugin-manifest-schema@2.0.0 \|\| 2.1.1`. |
| `flatpak/generated-sources.json` | 934, 936 | Offline Flatpak tarball source URL and destination filename mapping. |
| `scripts/electron-runtime-dependencies.json` | 13 | Packaged Electron runtime dependency allowlist. |
| `scripts/server-runtime-dependencies.json` | 16 | Server runtime dependency allowlist. |
| `scripts/check-schema-parity.mjs` | 20 | Schema parity assertion verifying exact re-export `export * from '@motrix/plugin-manifest-schema'`. |
| `src/core/plugin/manifest/schema.ts` | 6 | Re-export `export * from '@motrix/plugin-manifest-schema'`. |
| `tests/scripts/electron-package-contract.test.ts` | 241 | Packaged Electron runtime dependency test. |
| `tests/scripts/audit-server-runtime.test.ts` | 305, 386, 390 | Server runtime bundle contract test. |

### Why It Cannot Be Renamed Yet
This published schema package is the single authority for plugin manifest validation across both the desktop client and server runtimes, enforced by `scripts/check-schema-parity.mjs`.

### Planned Removal Strategy
Fork `@motrix/plugin-manifest-schema` to `@niodownloader/plugin-manifest-schema`. Update the manifest schema to accept both `engines.nio` and `engines.motrix`, publish to npm, and point `src/core/plugin/manifest/schema.ts` to the new package.

---

## 4. Published External npm Packages: `@motrix/plugin-api` and `@motrix/plugin-api-2-0`

TypeScript declarations and interfaces for QuickJS guest plugins and SDK compatibility fixtures.

- **Packages**: `@motrix/plugin-api` (`2.1.0`), `@motrix/plugin-api-2-0` (`npm:@motrix/plugin-api@2.1.0`)
- **Registry**: <https://www.npmjs.com/package/@motrix/plugin-api>
- **License**: MIT License (`MIT`). Verified in package directory.
- **Copyright**: Copyright (c) 2018-present Dr_rOot.

### Affected Files and Lines

| File | Line(s) | Role / Content |
|---|---|---|
| `package.json` | 94, 95 | Development dependencies `"@motrix/plugin-api": "2.1.0"`, `"@motrix/plugin-api-2-0": "npm:@motrix/plugin-api@2.1.0"`. |
| `pnpm-lock.yaml` | 351, 354, 355, 356, 1126, 5490 | Lockfile devDependency resolutions and npm alias entries. |
| `pnpm-workspace.yaml` | 43 | Workspace catalog constraint `@motrix/plugin-api@2.1.0`. |
| `flatpak/generated-sources.json` | 927, 929 | Offline Flatpak tarball source URL and destination filename mapping. |
| `docs/plugin-hook-runtime.md` | 366, 432, 433, 802 | Technical specification describing SDK 2.0 / 2.1.0 backwards-compatibility contracts. |
| `tests/fixtures/plugins/test.hook-delivery-runtime/src/plugin.ts` | 1 | Triple-slash reference `/// <reference types="@motrix/plugin-api" />`. |
| `tests/fixtures/plugins/test.hook-delivery-runtime/tsconfig.json` | 8 | Compiler type declaration `"types": ["@motrix/plugin-api"]`. |
| `tests/fixtures/plugins/test.hook-sdk-2-0/src/plugin.ts` | 1 | Triple-slash reference `/// <reference types="@motrix/plugin-api-2-0" />`. |
| `tests/fixtures/plugins/test.hook-sdk-2-0/tsconfig.json` | 8 | Compiler type declaration `"types": ["@motrix/plugin-api-2-0"]`. |
| `src/core/plugin/host/plugin-sdk-compat.test.ts` | 14, 21, 32, 60, 68, 80 | Backwards-compatibility tests reading package.json declarations from `@motrix/plugin-api` and `@motrix/plugin-api-2-0`. |

### Why It Cannot Be Renamed Yet
These packages are published SDK contracts needed to compile and verify plugin test fixtures against the published plugin ecosystem.

### Planned Removal Strategy
Publish `@niodownloader/plugin-api` and update fixtures while preserving backwards-compatibility shims for community plugins written against `@motrix/plugin-api`.

---

## 5. Published External npm Package: `@motrix/cli` (E2E Test devDependency)

Command-line client for MDXP protocol validation in end-to-end integration tests.

- **Package**: `@motrix/cli` (`^0.5.0`)
- **Registry**: <https://www.npmjs.com/package/@motrix/cli>
- **License**: MIT License (`MIT`). Verified in package directory.
- **Copyright**: Copyright (c) 2018-present Dr_rOot.

### Affected Files and Lines

| File | Line(s) | Role / Content |
|---|---|---|
| `package.json` | 93 | Development dependency `"@motrix/cli": "^0.5.0"`. |
| `pnpm-lock.yaml` | 348, 1117, 5484 | Lockfile entry and resolution. |
| `pnpm-workspace.yaml` | 42 | Workspace catalog constraint `@motrix/cli@0.1.0`. |
| `flatpak/generated-sources.json` | 906, 908 | Offline Flatpak tarball source URL and destination filename mapping. |
| `e2e/bridge/cli-pair-and-download.spec.ts` | 32 | Resolving CLI binary entrypoint `'@motrix/cli/dist/bin/motrix.js'`. |
| `e2e/bridge/server-leg.mjs` | 62 | Resolving CLI binary entrypoint `'@motrix/cli/dist/bin/motrix.js'`. |

### Why It Cannot Be Renamed Yet
It is a third-party npm package used solely in test automation to verify that standard MDXP client tools can discover, pair with, and download through Nio Downloader.

### Planned Removal Strategy
Publish `@niodownloader/cli` with entrypoint binary `nio` and point E2E tests to it in v2.1.

---

## 6. Plugin Manifest Contract Field: `engines.motrix`

Specifies the host engine semver compatibility range in plugin manifests (`nio-plugin.json`).

- **Defined by**: External schema package `@motrix/plugin-manifest-schema`
- **Field Name**: `engines.motrix` (e.g. `">=2.0.0"`)

### Affected Files and Lines

| File | Line(s) | Role / Content |
|---|---|---|
| `src/shared/types/plugin.ts` | 47 | TypeScript interface definition `engines: { motrix: string; ffmpeg?: string }`. |
| `src/shared/schemas/registry.ts` | 166 | Registry Zod schema `const enginesShape = { motrix: z.string().min(1) }`. |
| `src/shared/schemas/registry.conformance.json` | 25 | Schema conformance test fixture `"engines": { "motrix": ">=2.0.0" }`. |
| `src/shared/schemas/registry.fixture.json` | 39, 72, 95 | Registry test fixtures. |
| `src/core/plugin/manifest/parse.ts` | 149, 150 | Reading `manifest.engines.motrix` for pre-validation host version check. |
| `src/core/plugin/queries.ts` | 50 | Evaluating `manifest.engines.motrix` range against running host version. |
| `src/core/plugin/registry/registry-client.ts` | 131 | Evaluating compatibility `semverSatisfies(hostVersion, entry.engines.motrix)`. |
| `src/core/plugin/install/consent-payload.ts` | 118 | Mapping `enginesNio: manifest.engines.motrix`. |
| `src/core/plugin/install/plugin-installer.ts` | 346, 494 | Passing `enginesNio: parsedManifest.engines.motrix`. |
| `src/core/plugin/install/registry-expectation.ts` | 27, 60, 61 | Asserting registry expectation against `manifest.engines.motrix`. |
| `src/renderer/routes/plugins/components/registry-plugin-card.tsx` | 61 | UI component rendering required range `range: entry.engines.motrix`. |
| `src/renderer/routes/plugins/components/registry-detail-panel.tsx` | 93 | UI panel rendering required range `range: entry.engines.motrix`. |
| Test fixtures in `tests/fixtures/plugins/*/nio-plugin.json` | 8 | Fixture manifests specifying `"engines": { "motrix": ">=2.0.0" }`. |
| Plugin test files across `src/core/plugin/` | Various | Mock manifests and semver tests asserting range satisfaction. |

### Why It Cannot Be Renamed Yet
`engines.motrix` is an established public plugin ecosystem compatibility contract across all published and community-authored plugin manifests. Furthermore, the external `@motrix/plugin-manifest-schema` package strictly requires the `engines.motrix` property. If removed or renamed without forking the schema, manifest schema validation fails immediately for existing community plugins.

### Planned Removal Strategy
In v2.1:
1. Support `engines.nio` as an alias alongside `engines.motrix`.
2. Normalize manifests during pre-parsing (`src/core/plugin/manifest/parse.ts`) by copying `engines.nio` into `engines.motrix` if absent.
3. Fork `@niodownloader/plugin-manifest-schema` to officially accept `engines.nio`.

---

## 7. Ambient Module Specifier: `motrix:plugin-api`

Guest virtual module import specifier supported in QuickJS guest plugin sandboxes.

- **Specifier**: `motrix:plugin-api`

### Affected Files and Lines

| File | Line(s) | Role / Content |
|---|---|---|
| `src/core/plugin/host/capability-bridge.ts` | 2123, 2132 | Dispatcher regex rewriting both `nio:plugin-api` and `motrix:plugin-api` imports to guest runtime bindings. |
| `tests/fixtures/plugins/test.hook-delivery-runtime/dist/plugin.js` | 1 | Compiled fixture import `import { commands, hooks } from "motrix:plugin-api"`. |
| `tests/fixtures/plugins/test.hook-delivery-runtime/src/plugin.ts` | 7, 8 | Source fixture import `from 'motrix:plugin-api'`. |
| `tests/fixtures/plugins/test.hook-sdk-2-0/dist/plugin.js` | 1 | Compiled fixture import `import { commands, hooks, storage } from "motrix:plugin-api"`. |
| `tests/fixtures/plugins/test.hook-sdk-2-0/src/plugin.ts` | 3, 4 | Source fixture import `from 'motrix:plugin-api'`. |

### Why It Cannot Be Renamed Yet
`motrix:plugin-api` is a public plugin ecosystem compatibility contract. Community and third-party plugins compiled against the v2.0 SDK contain compiled import statements referencing `"motrix:plugin-api"`. Removing support or renaming the virtual specifier would break runtime execution of pre-existing plugins across the ecosystem.

### Planned Removal Strategy
Retain `motrix:plugin-api` as a permanent backwards-compatibility alias inside `capability-bridge.ts` while documenting `nio:plugin-api` as the standard import for new plugins.

---

## 8. Stale Generated Build Artifact: `flatpak/generated-sources.json`

Offline package source map used by Flatpak builder.

- **File**: `flatpak/generated-sources.json` (lines 915, 7046)
- **Token**: `@motrix__mdxp-0.8.1.tgz`

### Why It Cannot Be Renamed Yet
`flatpak/generated-sources.json` is a machine-generated file produced by `flatpak-node-generator`. Hand-editing generated files is strictly forbidden by project engineering policy. The file contains a historical entry from when `mdxp` was an npm package rather than a vendored workspace package. Regenerating requires `flatpak-builder-tools` with Python `>=3.10` and Linux.

### Planned Removal Strategy
Regenerate `flatpak/generated-sources.json` on a Linux CI builder running Python 3.10+ and commit the cleanly regenerated output.
