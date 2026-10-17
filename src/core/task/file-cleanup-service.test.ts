import { TaskType } from '@shared/types/task'
import { describe, expect, it, vi } from 'vitest'
import { FileCleanupServiceImpl } from './file-cleanup-service'

function makeFs() {
  return {
    removePathRecursive: vi.fn(async () => {}),
  }
}

describe('FileCleanupService.cleanup', () => {
  it('removes a direct single-file BT output and its adjacent control file', async () => {
    const fs = makeFs()
    await new FileCleanupServiceImpl(fs).cleanup(
      '/d/movie.iso',
      TaskType.Bt,
      true
    )
    expect(fs.removePathRecursive.mock.calls).toEqual([
      ['/d/movie.iso'],
      ['/d/movie.iso.aria2'],
    ])
  })
  it('HTTP: removes diskPath and .aria2 sidecar', async () => {
    const fs = makeFs()
    const svc = new FileCleanupServiceImpl(fs)
    await svc.cleanup('/d/foo.mp4.nio', TaskType.Http)

    expect(fs.removePathRecursive).toHaveBeenCalledWith('/d/foo.mp4.nio')
    expect(fs.removePathRecursive).toHaveBeenCalledWith('/d/foo.mp4.nio.aria2')
  })

  it('BT: removes container directory (no sidecar path passed)', async () => {
    const fs = makeFs()
    const svc = new FileCleanupServiceImpl(fs)
    await svc.cleanup('/d/name.nio', TaskType.Bt)

    expect(fs.removePathRecursive).toHaveBeenCalledWith('/d/name.nio')
    expect(fs.removePathRecursive).not.toHaveBeenCalledWith('/d/name.nio.aria2')
  })

  it('completed HTTP task (no .nio suffix): removes file + no sidecar', async () => {
    const fs = makeFs()
    const svc = new FileCleanupServiceImpl(fs)
    await svc.cleanup('/d/foo.mp4', TaskType.Http)

    expect(fs.removePathRecursive).toHaveBeenCalledWith('/d/foo.mp4')
  })
})
