import { z } from 'zod'
import { create } from 'zustand'
import {
  clampColumnWidth,
  defaultTaskColumns,
  TASK_COLUMNS,
  type TaskColumn,
} from './columns'
import { TASK_SORT_COLUMNS, type TaskSortColumn } from './sort'

export const STORAGE_KEY = 'niodownloader.downloads.view.v1'
const PREVIOUS_DEFAULT_WIDTHS: Partial<Record<TaskSortColumn, number>> = {
  name: 240,
  progress: 120,
  down: 140,
  up: 140,
}

const RawColumnSchema = z.object({
  id: z.string(),
  width: z.number().finite().optional(),
  visible: z.boolean().optional(),
})

export const ViewPreferencesSchema = z.object({
  version: z.number().optional(),
  columns: z.array(RawColumnSchema).optional(),
  inspectorVisible: z.boolean().optional(),
  inspectorSnap: z.enum(['compact', 'medium', 'expanded']).optional(),
})

export function sanitizeSavedColumns(
  savedColumns: unknown,
  version?: number
): TaskColumn[] {
  const defaults = defaultTaskColumns()
  if (!Array.isArray(savedColumns)) return defaults

  // Corrupted state with duplicate IDs falls back to defaults
  const rawIds = savedColumns
    .map((c) =>
      c && typeof c === 'object' ? (c as { id?: unknown }).id : undefined
    )
    .filter(Boolean)
  if (new Set(rawIds).size !== rawIds.length) {
    return defaults
  }

  const validIds = new Set(TASK_SORT_COLUMNS)
  const seenIds = new Set<TaskSortColumn>()
  const parsed: TaskColumn[] = []

  for (const item of savedColumns) {
    if (!item || typeof item !== 'object') continue
    const rawId = (item as { id?: unknown }).id
    if (typeof rawId !== 'string' || !validIds.has(rawId as TaskSortColumn)) {
      // Unknown or removed column ids in saved state are dropped
      continue
    }
    const id = rawId as TaskSortColumn
    if (seenIds.has(id)) continue
    seenIds.add(id)

    const def = TASK_COLUMNS[id]
    const rawWidth =
      typeof (item as { width?: unknown }).width === 'number'
        ? (item as { width: number }).width
        : def.width
    // Widths are clamped to minimum (and maximum)
    const width = clampColumnWidth(id, rawWidth)

    const rawVisible = (item as { visible?: unknown }).visible
    const visible =
      id === 'name' ? true : typeof rawVisible === 'boolean' ? rawVisible : true

    parsed.push({ id, width, visible })
  }

  // Missing ids fall back to defaults
  for (const defCol of defaults) {
    if (!seenIds.has(defCol.id)) {
      parsed.push(defCol)
      seenIds.add(defCol.id)
    }
  }

  // 1.0.0 saved state migration: if version is 1 and columns matched the untouched old defaults,
  // migrate to the new defaultTaskColumns().
  const oldDefaults =
    version === 1 &&
    parsed.every((column, index) => {
      const current = defaults[index]
      const oldWidth = PREVIOUS_DEFAULT_WIDTHS[column.id] ?? current?.width
      return current && column.id === current.id && column.width === oldWidth
    })

  return oldDefaults ? defaults : parsed
}

function defaults() {
  return {
    version: 2 as const,
    columns: defaultTaskColumns(),
    inspectorVisible: false,
    inspectorSnap: 'medium' as const,
  }
}

function readPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults()
    const parsedJson = JSON.parse(raw)
    const saved = ViewPreferencesSchema.parse(parsedJson)
    const columns = sanitizeSavedColumns(saved.columns, saved.version)
    return {
      version: 2 as const,
      columns,
      inspectorVisible: saved.inspectorVisible ?? false,
      inspectorSnap: saved.inspectorSnap ?? ('medium' as const),
    }
  } catch {
    return defaults()
  }
}

export type InspectorTab =
  | 'overview'
  | 'files'
  | 'pieces'
  | 'peers'
  | 'trackers'
  | 'activity'

interface DownloadsViewState {
  inspectorTab: InspectorTab
  setInspectorTab: (tab: InspectorTab) => void
  columns: TaskColumn[]
  inspectorVisible: boolean
  inspectorSnap: 'compact' | 'medium' | 'expanded'
  setColumnVisible: (id: TaskSortColumn, visible: boolean) => void
  setColumnWidth: (id: TaskSortColumn, width: number, persist?: boolean) => void
  moveColumn: (id: TaskSortColumn, before: TaskSortColumn) => void
  resetColumns: () => void
  setInspectorVisible: (visible: boolean) => void
  setInspectorSnap: (snap: 'compact' | 'medium' | 'expanded') => void
  persist: () => void
}

export function createDownloadsViewStore() {
  return create<DownloadsViewState>((set, get) => ({
    ...readPreferences(),
    inspectorTab: 'overview',
    setInspectorTab: (inspectorTab) => set({ inspectorTab }),
    persist: () => {
      const { columns, inspectorVisible, inspectorSnap } = get()
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 2,
            columns,
            inspectorVisible,
            inspectorSnap,
          })
        )
      } catch {
        // The view remains usable when storage is blocked or full.
      }
    },
    setColumnVisible: (id, visible) => {
      set({
        columns: get().columns.map((column) =>
          column.id === id
            ? { ...column, visible: id === 'name' || visible }
            : column
        ),
      })
      get().persist()
    },
    setColumnWidth: (id, width, persist = true) => {
      set({
        columns: get().columns.map((column) =>
          column.id === id
            ? { ...column, width: clampColumnWidth(id, width) }
            : column
        ),
      })
      if (persist) get().persist()
    },
    moveColumn: (id, before) => {
      if (id === before) return
      const columns = [...get().columns]
      const source = columns.findIndex((column) => column.id === id)
      if (source < 0) return
      const [column] = columns.splice(source, 1)
      const target = columns.findIndex((column) => column.id === before)
      if (target < 0) return
      columns.splice(target, 0, column)
      set({ columns })
      get().persist()
    },
    resetColumns: () => {
      set({ columns: defaultTaskColumns() })
      get().persist()
    },
    setInspectorVisible: (inspectorVisible) => {
      set({ inspectorVisible })
      get().persist()
    },
    setInspectorSnap: (inspectorSnap) => {
      set({ inspectorSnap })
      get().persist()
    },
  }))
}

export const useDownloadsView = createDownloadsViewStore()
