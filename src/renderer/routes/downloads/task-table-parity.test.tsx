import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('@renderer/lib/transport', () => ({
  transport: { invoke: vi.fn().mockResolvedValue({ ok: true }) },
}))
vi.mock('@renderer/lib/open-add-task-dialog', () => ({
  openAddTaskDialog: vi.fn().mockResolvedValue(undefined),
}))
const { toastAddMock } = vi.hoisted(() => ({ toastAddMock: vi.fn() }))
vi.mock('@renderer/components/ui/toast', () => ({
  toast: { add: toastAddMock, close: vi.fn() },
}))

import '@renderer/lib/i18n'
import type { DownloadTask } from '@shared/types/task'
import { makeDownloadTask } from '@test-utils/task'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  defaultTaskColumns,
  deriveTaskColumnModel,
  type TaskColumn,
  type TaskTableDensity,
} from './columns'
import { TaskColumnHeader } from './task-column-header'
import { TaskRow } from './task-row'

function fakeTask(overrides: Partial<DownloadTask> = {}): DownloadTask {
  return makeDownloadTask({
    id: 'parity-task-1',
    engineTaskId: 'gid-1',
    name: 'ubuntu-24.04.iso',
    progress: 0.65,
    totalBytes: 4_000_000_000,
    downloadedBytes: 2_600_000_000,
    downloadSpeed: 10_000_000,
    uploadSpeed: 500_000,
    etaSeconds: 140,
    saveDir: '/Downloads',
    uris: ['https://example.com/ubuntu.iso'],
    fileCount: 1,
    connections: 16,
    finishedAt: Date.now() - 3600_000,
    createdAt: Date.now() - 7200_000,
    ...overrides,
  })
}

function TableHarness({
  columns,
  density = 'comfortable',
  task,
}: {
  columns?: TaskColumn[]
  density?: TaskTableDensity
  task?: DownloadTask
}) {
  const model = deriveTaskColumnModel(columns, density)
  const currentTask = task ?? fakeTask()

  return (
    // biome-ignore lint/a11y/useSemanticElements: Virtualized grid container
    <div role="grid" aria-label="Downloads table">
      <TaskColumnHeader
        sort={null}
        onSort={() => {}}
        columnModel={model}
        headerCheckbox={{
          checked: false,
          indeterminate: false,
          onChange: () => {},
        }}
      />
      <TaskRow
        task={currentTask}
        columnModel={model}
        rowProps={{
          selected: false,
          focused: false,
          onClick: () => {},
          onCheckboxChange: () => {},
        }}
      />
    </div>
  )
}

describe('Task table header and row cell parity', () => {
  it('has identical cell counts between header and row when all default columns are visible', () => {
    const cols = defaultTaskColumns()
    render(<TableHarness columns={cols} />)

    const headerCells = screen.getAllByRole('columnheader')
    const rowCells = screen.getAllByRole('gridcell')

    // 1 selection cell + 10 column cells = 11 total cells each
    expect(headerCells).toHaveLength(11)
    expect(rowCells).toHaveLength(11)
    expect(headerCells.length).toBe(rowCells.length)

    // Name and Date completed headers are present
    expect(
      screen.getByRole('columnheader', { name: /Name/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: /Date completed/ })
    ).toBeInTheDocument()
  })

  it('excludes hidden columns from both header and row, preserving exact cell count parity', () => {
    // Hide 'finishedAt' (Date completed) and 'eta'
    const cols = defaultTaskColumns().map((col) =>
      col.id === 'finishedAt' || col.id === 'eta'
        ? { ...col, visible: false }
        : col
    )

    render(<TableHarness columns={cols} />)

    const headerCells = screen.getAllByRole('columnheader')
    const rowCells = screen.getAllByRole('gridcell')

    // 1 selection cell + 8 visible column cells = 9 total cells each
    expect(headerCells).toHaveLength(9)
    expect(rowCells).toHaveLength(9)
    expect(headerCells.length).toBe(rowCells.length)

    // Hidden column headers must not exist in the document
    expect(
      screen.queryByRole('columnheader', { name: /Date completed/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: /ETA/ })
    ).not.toBeInTheDocument()
  })

  it('maintains parity in compact density as well', () => {
    // Hide 'up', 'connections', and 'finishedAt'
    const cols = defaultTaskColumns().map((col) =>
      ['up', 'connections', 'finishedAt'].includes(col.id)
        ? { ...col, visible: false }
        : col
    )

    render(<TableHarness columns={cols} density="compact" />)

    const headerCells = screen.getAllByRole('columnheader')
    const rowCells = screen.getAllByRole('gridcell')

    // 1 selection cell + 7 visible columns = 8 total cells each
    expect(headerCells).toHaveLength(8)
    expect(rowCells).toHaveLength(8)
    expect(headerCells.length).toBe(rowCells.length)
  })
})
