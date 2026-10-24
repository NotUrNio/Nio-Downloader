import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultTaskColumns } from './columns'
import { createDownloadsViewStore } from './view-preferences'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Downloads view preferences', () => {
  it('updates the previous default layout without changing inspector preferences', () => {
    const columns = defaultTaskColumns().map((column) => ({
      ...column,
      width:
        column.id === 'name'
          ? 240
          : column.id === 'progress'
            ? 120
            : column.id === 'down' || column.id === 'up'
              ? 140
              : column.width,
    }))
    const saved = {
      version: 1,
      columns,
      inspectorVisible: true,
      inspectorSnap: 'expanded',
    }
    localStorage.setItem(
      'niodownloader.downloads.view.v1',
      JSON.stringify(saved)
    )
    const restored = createDownloadsViewStore().getState()
    expect(restored.columns).toEqual(defaultTaskColumns())
    expect(restored.inspectorVisible).toBe(true)
    expect(restored.inspectorSnap).toBe('expanded')
    restored.persist()
    expect(createDownloadsViewStore().getState().columns).toEqual(
      defaultTaskColumns()
    )

    // A customized layout must retain its other widths as well.
    columns[0].width = 320
    localStorage.setItem(
      'niodownloader.downloads.view.v1',
      JSON.stringify(saved)
    )
    expect(createDownloadsViewStore().getState().columns).toEqual(columns)
  })

  it('migrates a 1.0.0-style saved column list with legacy fields and missing columns', () => {
    // 1.0.0 format with legacy/unknown column and missing finishedAt
    const legacySaved = {
      version: 1,
      columns: [
        { id: 'name', width: 350, visible: true },
        { id: 'legacy_obsolete_col', width: 100, visible: true },
        { id: 'size', width: 150, visible: true },
        { id: 'progress', width: 180, visible: true },
        { id: 'status', width: 110, visible: true },
        { id: 'down', width: 130, visible: true },
        { id: 'up', width: 130, visible: true },
        { id: 'eta', width: 100, visible: false },
        { id: 'connections', width: 90, visible: true },
        { id: 'createdAt', width: 140, visible: true },
      ],
      inspectorVisible: true,
      inspectorSnap: 'compact',
    }

    localStorage.setItem(
      'niodownloader.downloads.view.v1',
      JSON.stringify(legacySaved)
    )

    const store = createDownloadsViewStore()
    const state = store.getState()

    // Inspector settings preserved
    expect(state.inspectorVisible).toBe(true)
    expect(state.inspectorSnap).toBe('compact')

    // Persisted state saves with version 2
    store.getState().persist()
    const stored = JSON.parse(
      localStorage.getItem('niodownloader.downloads.view.v1')!
    )
    expect(stored.version).toBe(2)

    // Obsolete column removed
    expect(
      state.columns.some((c) => (c.id as string) === 'legacy_obsolete_col')
    ).toBe(false)

    // Custom width and visibility preserved
    const nameCol = state.columns.find((c) => c.id === 'name')!
    expect(nameCol.width).toBe(350)
    expect(nameCol.visible).toBe(true)

    const etaCol = state.columns.find((c) => c.id === 'eta')!
    expect(etaCol.visible).toBe(false)

    // Missing finishedAt column restored from defaults
    const finishedAtCol = state.columns.find((c) => c.id === 'finishedAt')
    expect(finishedAtCol).toBeDefined()
    expect(finishedAtCol?.visible).toBe(true)

    // All default columns present
    expect(state.columns).toHaveLength(defaultTaskColumns().length)
  })

  it('shares the inspector tab during the session without persisting it', () => {
    const store = createDownloadsViewStore()
    store.getState().setInspectorTab('files')
    store.getState().setInspectorVisible(true)
    expect(store.getState().inspectorTab).toBe('files')
    expect(createDownloadsViewStore().getState().inspectorTab).toBe('overview')
  })
  it('restores columns, order and inspector independently of selection', () => {
    const store = createDownloadsViewStore()
    expect(store.getState().inspectorVisible).toBe(false)
    store.getState().setColumnWidth('name', 320)
    store.getState().setColumnVisible('eta', false)
    store.getState().setColumnVisible('createdAt', false)
    store.getState().moveColumn('eta', 'name')
    store.getState().setInspectorVisible(true)
    store.getState().setInspectorSnap('compact')
    const restored = createDownloadsViewStore().getState()
    expect(restored.columns[0].id).toBe('eta')
    expect(restored.columns[0].visible).toBe(false)
    expect(restored.columns[1].width).toBe(320)
    expect(restored.inspectorVisible).toBe(true)
    expect(restored.inspectorSnap).toBe('compact')
    store.getState().resetColumns()
    expect(store.getState().inspectorVisible).toBe(true)
    expect(
      createDownloadsViewStore()
        .getState()
        .columns.filter((column) => column.visible)
        .map((column) => column.id)
    ).toEqual([
      'name',
      'size',
      'progress',
      'status',
      'down',
      'up',
      'eta',
      'connections',
      'createdAt',
      'finishedAt',
    ])
  })

  it('clamps resizing and keeps the name visible without persisting every drag frame', () => {
    const store = createDownloadsViewStore()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    store.getState().setColumnWidth('name', 20000, false)
    expect(store.getState().columns[0].width).toBe(900)
    expect(write).not.toHaveBeenCalled()
    store.getState().persist()
    expect(write).toHaveBeenCalledOnce()
    store.getState().setColumnVisible('name', false)
    expect(store.getState().columns[0].visible).toBe(true)
  })

  it('falls back on corrupt or duplicated columns and blocked storage', () => {
    localStorage.setItem('niodownloader.downloads.view.v1', '{invalid')
    expect(createDownloadsViewStore().getState().columns[0].id).toBe('name')
    const store = createDownloadsViewStore()
    store.getState().persist()
    const data = JSON.parse(
      localStorage.getItem('niodownloader.downloads.view.v1')!
    )
    data.columns[1] = data.columns[0]
    localStorage.setItem(
      'niodownloader.downloads.view.v1',
      JSON.stringify(data)
    )
    expect(createDownloadsViewStore().getState().columns[1].id).toBe('size')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const blocked = createDownloadsViewStore()
    expect(() => blocked.getState().setInspectorVisible(true)).not.toThrow()
    expect(blocked.getState().inspectorVisible).toBe(true)
  })
})
