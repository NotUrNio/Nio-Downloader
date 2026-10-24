import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FileExtensionPairingProjectionStore } from '@core/bridge/file-extension-pairing-projection-store'
import { v1 } from '@core/session/migrations/v1'
import { v2 } from '@core/session/migrations/v2'
import { v3 } from '@core/session/migrations/v3'
import { v4 } from '@core/session/migrations/v4'
import { v5 } from '@core/session/migrations/v5'
import { v6 } from '@core/session/migrations/v6'
import { v7 } from '@core/session/migrations/v7'
import { NioDownloaderDatabase } from '@core/session/nio-database'
import { SettingsManager } from '@core/settings/settings-manager'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('Profile database upgrade verification (1.0.0 to 1.0.1)', () => {
  let workDir: string
  let dbPath: string
  let settingsPath: string
  let pairingsPath: string
  let preMigrationChecksum: string
  let nioDb: NioDownloaderDatabase | null = null

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nio-upgrade-test-'))
    dbPath = path.join(workDir, 'niodownloader.db')
    settingsPath = path.join(workDir, 'settings.json')
    const bridgeDir = path.join(workDir, 'bridge')
    pairingsPath = path.join(bridgeDir, 'extension-pairings.json')
    fs.mkdirSync(bridgeDir, { recursive: true })

    const db100 = new Database(dbPath)
    db100.pragma('journal_mode = WAL')
    db100.pragma('foreign_keys = ON')
    db100.exec(`CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )`)

    for (const m of [v1, v2, v3, v4, v5, v6, v7]) {
      m.up(db100)
      db100
        .prepare('INSERT INTO schema_version VALUES (?, ?)')
        .run(m.version, 1700000000000 + m.version * 1000)
    }

    const insertTask = db100.prepare(`
      INSERT INTO tasks (
        niodownloader_id, name, kind, task_type, category, priority, tags,
        created_at, updated_at, save_dir, final_path, final_name, torrent_meta_path,
        info_hash, total_bytes, downloaded_bytes, size_when_done, file_count,
        is_private, trackers, piece_length, agg_status, finished_at,
        error_message, error_code, error_detail_key, error_detail_params,
        diagnosis_revision, uploaded_bytes_baseline, source, source_meta
      ) VALUES (
        ?, ?, 'direct', ?, 'general', 0, '[]',
        1700000000000, 1700000000000, '/downloads', ?, ?, null,
        null, ?, ?, ?, 1,
        0, '[]', 0, ?, ?,
        null, null, null, null,
        0, 0, 'url', '{}'
      )
    `)

    const insertInstance = db100.prepare(`
      INSERT INTO task_instances (
        instance_id, niodownloader_id, gid, phase, status, progress, total_bytes,
        downloaded_bytes, uploaded_bytes, disk_path, transition_phase, uris,
        uri_hash, payload, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, 0, ?, 'idle', '["http://example.com/file"]',
        'hash1', '{}', 1700000000000, 1700000000000
      )
    `)

    insertTask.run(
      'task-active-1',
      'active-download.iso',
      'http',
      '/downloads/active-download.iso',
      'active-download.iso',
      100000000,
      25000000,
      100000000,
      'downloading',
      null
    )
    insertInstance.run(
      'inst-active-1',
      'task-active-1',
      'gid-active-1',
      'http_download',
      'downloading',
      0.25,
      100000000,
      25000000,
      '/downloads/active-download.iso'
    )

    insertTask.run(
      'task-paused-2',
      'paused-archive.tar.gz',
      'http',
      '/downloads/paused-archive.tar.gz',
      'paused-archive.tar.gz',
      50000000,
      10000000,
      50000000,
      'paused',
      null
    )
    insertInstance.run(
      'inst-paused-2',
      'task-paused-2',
      'gid-paused-2',
      'http_download',
      'paused',
      0.2,
      50000000,
      10000000,
      '/downloads/paused-archive.tar.gz'
    )

    insertTask.run(
      'task-completed-3',
      'completed-doc.pdf',
      'http',
      '/downloads/completed-doc.pdf',
      'completed-doc.pdf',
      5000000,
      5000000,
      5000000,
      'completed',
      1700000500000
    )
    insertInstance.run(
      'inst-completed-3',
      'task-completed-3',
      'gid-completed-3',
      'http_download',
      'completed',
      1.0,
      5000000,
      5000000,
      '/downloads/completed-doc.pdf'
    )

    insertTask.run(
      'task-v9-repair',
      'empty-gid-task.bin',
      'http',
      '/downloads/empty-gid-task.bin',
      'empty-gid-task.bin',
      1000,
      1000,
      1000,
      'completed',
      1700000600000
    )
    insertInstance.run(
      'inst-v9-repair',
      'task-v9-repair',
      '',
      'hls_segment',
      'completed',
      1.0,
      1000,
      1000,
      '/downloads/empty-gid-task.bin'
    )

    db100
      .prepare(
        `
      INSERT INTO task_tracker_state (niodownloader_id, state)
      VALUES (?, ?)
    `
      )
      .run(
        'task-paused-2',
        JSON.stringify({
          trackers: [
            {
              announce: 'udp://tracker.openbittorrent.com:80/announce',
              tier: 0,
              status: 'active',
              peers: 42,
            },
          ],
        })
      )

    db100
      .prepare(
        `
      INSERT INTO task_seeding_activity (niodownloader_id, tracking_started_at, seeding_ms)
      VALUES (?, ?, ?)
    `
      )
      .run('task-completed-3', 1700000000000, 3600000)

    db100.pragma('wal_checkpoint(TRUNCATE)')
    db100.close()

    preMigrationChecksum = createHash('sha256')
      .update(fs.readFileSync(dbPath))
      .digest('hex')

    const initialSettings = {
      version: 13,
      app: {
        defaultSaveDir: '/custom/save/dir',
        autofillClipboardLinks: true,
        fileDeletionMode: 'trash',
        speedLimitUnits: 'kib',
      },
      engine: {
        performanceProfile: 'high',
        maxSpeed: true,
        maxConcurrentDownloads: 16,
        maxConnectionPerServer: 8,
        split: 8,
        minSplitSize: 1048576,
        userAgent: 'NioDownloader/1.0.0-CustomAgent',
        connectTimeout: 45,
        socketTimeout: 45,
        maxTries: 10,
        retryWait: 5,
        lowestSpeedLimit: 0,
        fileAllocation: 'falloc',
        remoteTime: true,
        diskCache: 33554432,
      },
      speedLimit: {
        mode: 'manual',
        base: { download: 10000000, upload: 5000000 },
        alt: { download: 1000000, upload: 500000 },
        auto: {
          adaptive: {
            linkDown: 100000000,
            linkUp: 50000000,
            headroomPercent: 10,
          },
        },
      },
    }
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(initialSettings, null, 2),
      'utf8'
    )

    const pairingProjectionDoc = {
      version: 1,
      revision: 1,
      records: [
        {
          identity: {
            kind: 'extension',
            browser: 'chromium',
            extensionId: 'abcdefghijklmnopabcdefghijklmnop',
          },
          identityTrust: 'official',
          authorizationEpoch: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          status: 'ready',
          pairedAt: 1700000000000,
          lastActiveAt: 1700000100000,
        },
      ],
    }
    fs.writeFileSync(
      pairingsPath,
      JSON.stringify(pairingProjectionDoc, null, 2),
      'utf8'
    )

    nioDb = new NioDownloaderDatabase(dbPath)
    nioDb.init()
  })

  afterAll(() => {
    if (nioDb?.database) {
      try {
        nioDb.database.close()
      } catch {}
    }
    if (fs.existsSync(workDir)) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true })
      } catch {}
    }
  })

  it('creates an exact pre-migration backup before applying migrations', () => {
    const workFiles = fs.readdirSync(workDir)
    const backupFiles = workFiles.filter((f) =>
      f.startsWith('niodownloader.db.bak-')
    )
    expect(backupFiles.length).toBe(1)
    const backupPath = path.join(workDir, backupFiles[0])
    const backupChecksum = createHash('sha256')
      .update(fs.readFileSync(backupPath))
      .digest('hex')
    expect(backupChecksum).toBe(preMigrationChecksum)
  })

  it('advances database schema version to 9', () => {
    const currentDb = nioDb!.database
    const versionRow = currentDb
      .prepare('SELECT MAX(version) AS v FROM schema_version')
      .get() as { v: number }
    expect(versionRow.v).toBe(9)
  })

  it('preserves all tasks with zero data loss across statuses', () => {
    const currentDb = nioDb!.database
    const allTasks = currentDb
      .prepare('SELECT * FROM tasks ORDER BY niodownloader_id ASC')
      .all() as any[]
    expect(allTasks.length).toBe(4)

    const activeTask = allTasks.find(
      (t) => t.niodownloader_id === 'task-active-1'
    )
    expect(activeTask).toBeDefined()
    expect(activeTask.agg_status).toBe('downloading')
    expect(activeTask.downloaded_bytes).toBe(25000000)
    expect(activeTask.total_bytes).toBe(100000000)

    const pausedTask = allTasks.find(
      (t) => t.niodownloader_id === 'task-paused-2'
    )
    expect(pausedTask).toBeDefined()
    expect(pausedTask.agg_status).toBe('paused')
    expect(pausedTask.downloaded_bytes).toBe(10000000)

    const completedTask = allTasks.find(
      (t) => t.niodownloader_id === 'task-completed-3'
    )
    expect(completedTask).toBeDefined()
    expect(completedTask.agg_status).toBe('completed')
    expect(completedTask.finished_at).toBe(1700000500000)
  })

  it('converts empty string gid to null via migration v9', () => {
    const currentDb = nioDb!.database
    const v9TaskInstance = currentDb
      .prepare(
        "SELECT gid FROM task_instances WHERE instance_id='inst-v9-repair'"
      )
      .get() as { gid: string | null }
    expect(v9TaskInstance.gid).toBeNull()
  })

  it('preserves custom tracker state and seeding activity', () => {
    const currentDb = nioDb!.database
    const trackerRow = currentDb
      .prepare(
        "SELECT * FROM task_tracker_state WHERE niodownloader_id='task-paused-2'"
      )
      .get() as any
    expect(trackerRow).toBeDefined()
    const trackerState = JSON.parse(trackerRow.state)
    expect(trackerState.trackers[0].announce).toBe(
      'udp://tracker.openbittorrent.com:80/announce'
    )
    expect(trackerState.trackers[0].peers).toBe(42)

    const seeding = currentDb
      .prepare(
        "SELECT * FROM task_seeding_activity WHERE niodownloader_id='task-completed-3'"
      )
      .get() as any
    expect(seeding).toBeDefined()
    expect(seeding.seeding_ms).toBe(3600000)
  })

  it('loads legacy settings into SettingsManager without data loss', async () => {
    const settingsMgr = new SettingsManager(settingsPath)
    await settingsMgr.load()
    const loadedSettings = settingsMgr.get()
    expect(loadedSettings.app.defaultSaveDir).toBe('/custom/save/dir')
    expect(loadedSettings.app.fileDeletionMode).toBe('trash')
    expect(loadedSettings.engine.performanceProfile).toBe('high')
    expect(loadedSettings.engine.maxConcurrentDownloads).toBe(16)
    expect(loadedSettings.engine.userAgent).toBe(
      'NioDownloader/1.0.0-CustomAgent'
    )
    expect(loadedSettings.speedLimit.base.download).toBe(10000000)
  })

  it('preserves extension pairings with ready status without re-approval', async () => {
    const store = new FileExtensionPairingProjectionStore(pairingsPath)
    const snapshot = await store.load()
    expect(snapshot.records).toBeDefined()
    expect(snapshot.records.length).toBe(1)
    const ext = snapshot.records[0]
    expect(ext.identity.extensionId).toBe('abcdefghijklmnopabcdefghijklmnop')
    expect(ext.identityTrust).toBe('official')
    expect(ext.status).toBe('ready')
    expect(ext.authorizationEpoch).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })
})
