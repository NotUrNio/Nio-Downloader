import { describe, expect, it } from 'vitest'
import {
  clampColumnWidth,
  defaultTaskColumns,
  deriveTaskColumnModel,
  TASK_COLUMNS,
} from './columns'
import { sanitizeSavedColumns } from './view-preferences'

describe('Task column model', () => {
  it('derives identical visible column lists and widths for header and body across densities', () => {
    const defaultCols = defaultTaskColumns()
    const comfortableModel = deriveTaskColumnModel(defaultCols, 'comfortable')
    const compactModel = deriveTaskColumnModel(defaultCols, 'compact')

    expect(comfortableModel.density).toBe('comfortable')
    expect(comfortableModel.rowHeight).toBe(36)
    expect(comfortableModel.headerHeight).toBe(36)

    expect(compactModel.density).toBe('compact')
    expect(compactModel.rowHeight).toBe(32)
    expect(compactModel.headerHeight).toBe(32)

    // Visible column lists and column IDs must match identically
    expect(comfortableModel.visibleColumns.map((c) => c.id)).toEqual(
      compactModel.visibleColumns.map((c) => c.id)
    )
    expect(comfortableModel.widths).toEqual(compactModel.widths)

    // Selection cell track is included at the start of both grid templates
    expect(
      comfortableModel.gridStyle.gridTemplateColumns.startsWith('36px ')
    ).toBe(true)
    expect(compactModel.gridStyle.gridTemplateColumns.startsWith('36px ')).toBe(
      true
    )
    expect(comfortableModel.gridStyle.minWidth).toBe(
      compactModel.gridStyle.minWidth
    )
  })

  it('excludes hidden columns from visibleColumns, gridTemplateColumns, and minWidth', () => {
    const cols = defaultTaskColumns().map((col) =>
      col.id === 'finishedAt'
        ? { ...col, width: 215, visible: false }
        : col.id === 'eta'
          ? { ...col, visible: false }
          : col
    )
    const model = deriveTaskColumnModel(cols, 'comfortable')

    expect(model.visibleColumns.some((c) => c.id === 'finishedAt')).toBe(false)
    expect(model.visibleColumns.some((c) => c.id === 'eta')).toBe(false)
    expect(model.gridStyle.gridTemplateColumns).not.toContain('215px')

    const expectedVisibleCount = defaultTaskColumns().length - 2
    expect(model.visibleColumns).toHaveLength(expectedVisibleCount)
    expect(model.gridStyle.gridTemplateColumns.startsWith('36px minmax(')).toBe(
      true
    )
  })

  it('sanitizes saved state by dropping unknown/removed ids, filling missing ids, and clamping widths', () => {
    const rawSaved = [
      { id: 'unknown_legacy_col', width: 9999, visible: true },
      { id: 'name', width: 10, visible: true }, // below min (160)
      { id: 'size', width: 800, visible: false }, // above max (240)
    ]

    const sanitized = sanitizeSavedColumns(rawSaved, 2)

    // Unknown id is dropped
    expect(
      sanitized.some((c) => (c.id as string) === 'unknown_legacy_col')
    ).toBe(false)

    // Existing ids are clamped
    const nameCol = sanitized.find((c) => c.id === 'name')!
    expect(nameCol.width).toBe(TASK_COLUMNS.name.min)
    expect(nameCol.visible).toBe(true) // name always visible

    const sizeCol = sanitized.find((c) => c.id === 'size')!
    expect(sizeCol.width).toBe(TASK_COLUMNS.size.max)
    expect(sizeCol.visible).toBe(false)

    // Missing default columns are filled in with default widths
    expect(sanitized.some((c) => c.id === 'progress')).toBe(true)
    expect(sanitized.some((c) => c.id === 'status')).toBe(true)
    expect(sanitized.some((c) => c.id === 'down')).toBe(true)
    expect(sanitized.some((c) => c.id === 'up')).toBe(true)
    expect(sanitized.some((c) => c.id === 'eta')).toBe(true)
    expect(sanitized.some((c) => c.id === 'connections')).toBe(true)
    expect(sanitized.some((c) => c.id === 'createdAt')).toBe(true)
    expect(sanitized.some((c) => c.id === 'finishedAt')).toBe(true)

    // Total count matches TASK_SORT_COLUMNS length
    expect(sanitized).toHaveLength(defaultTaskColumns().length)

    // Clamping helper returns fallback on unknown column
    expect(clampColumnWidth('name', Number.NaN)).toBe(TASK_COLUMNS.name.width)
  })
})
