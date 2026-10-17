import { DownloadErrorCode } from '@shared/errors'
import { TaskStatus } from '@shared/types/task'
import type { TaskTerminalOccurrence } from '@shared/types/task-occurrence'
import { describe, expect, it, vi } from 'vitest'
import { createHttpFallbackConsumer, isHttp403Or429 } from './http-fallback'

function makeOccurrence(
  errorMessage: string,
  overrides?: Partial<TaskTerminalOccurrence>
): TaskTerminalOccurrence {
  return {
    occurrenceId: 'task-1:error:1000',
    type: 'terminal',
    taskId: 'task-1',
    fromStatus: TaskStatus.Downloading,
    toStatus: TaskStatus.Error,
    cause: 'engine',
    errorGroup: {
      errorCode: DownloadErrorCode.NetworkError,
      errorMessage,
      errorDetailKey: null,
      errorDetailParams: null,
    },
    createdAt: 2000,
    ...overrides,
  }
}

function makeHarness(overrides?: {
  maxSpeed?: boolean
  taskStatus?: TaskStatus | null
  taskErrorMessage?: string | null
  startedAt?: number
}) {
  const reAddTask = vi.fn().mockResolvedValue(undefined)
  const log = { info: vi.fn(), warn: vi.fn() }
  const consumer = createHttpFallbackConsumer({
    isMaxSpeed: () => overrides?.maxSpeed ?? true,
    getTaskStatus: () =>
      overrides?.taskStatus === undefined
        ? TaskStatus.Error
        : overrides.taskStatus,
    getTaskErrorMessage: () =>
      overrides?.taskErrorMessage ??
      'errorCode=22 Error response from server: 403 Forbidden',
    reAddTask,
    log,
    now: () => overrides?.startedAt ?? 1000,
  })
  return { consumer, reAddTask, log }
}

describe('isHttp403Or429', () => {
  it.each([
    ['403 Forbidden', 403],
    ['status 403', 403],
    ['errorCode=22 Error response from server: 403 Forbidden', 403],
    ['HTTP 429 Too Many Requests', 429],
    ['status 429 rate limit', 429],
    ['Server responded with 429', 429],
  ])('matches %s with status %d', (msg, expectedStatus) => {
    const res = isHttp403Or429(msg)
    expect(res.matched).toBe(true)
    expect(res.status).toBe(expectedStatus)
  })

  it.each([
    '404 Not Found',
    '500 Internal Server Error',
    'Connection refused',
    'errorCode=1 Network failure',
    '4030 invalid code',
    '',
    null,
    undefined,
  ])('returns matched: false for %s', (msg) => {
    expect(isHttp403Or429(msg).matched).toBe(false)
  })
})

describe('createHttpFallbackConsumer', () => {
  it('retries once with 4 connections on HTTP 403 when Max Speed is active', async () => {
    const { consumer, reAddTask, log } = makeHarness()

    await consumer.consume(
      makeOccurrence('errorCode=22 Error response: 403 Forbidden')
    )

    expect(reAddTask).toHaveBeenCalledExactlyOnceWith('task-1', {
      connections: 4,
    })
    expect(log.info).toHaveBeenCalledWith(
      { taskId: 'task-1', status: 403 },
      'Server returned HTTP 403; retrying with conservative connection count'
    )
  })

  it('retries once with 4 connections on HTTP 429 when Max Speed is active', async () => {
    const { consumer, reAddTask, log } = makeHarness()

    await consumer.consume(
      makeOccurrence('errorCode=22 Error response: 429 Too Many Requests')
    )

    expect(reAddTask).toHaveBeenCalledExactlyOnceWith('task-1', {
      connections: 4,
    })
    expect(log.info).toHaveBeenCalledWith(
      { taskId: 'task-1', status: 429 },
      'Server returned HTTP 429; retrying with conservative connection count'
    )
  })

  it('never retries the same task twice (does not loop)', async () => {
    const { consumer, reAddTask } = makeHarness()

    await consumer.consume(
      makeOccurrence('403 Forbidden', {
        occurrenceId: 'occ-1',
        createdAt: 2000,
      })
    )
    await consumer.consume(
      makeOccurrence('403 Forbidden', {
        occurrenceId: 'occ-2',
        createdAt: 3000,
      })
    )

    expect(reAddTask).toHaveBeenCalledTimes(1)
  })

  it('does nothing when Max Speed is disabled', async () => {
    const { consumer, reAddTask } = makeHarness({ maxSpeed: false })

    await consumer.consume(makeOccurrence('403 Forbidden'))

    expect(reAddTask).not.toHaveBeenCalled()
  })

  it('does nothing for non-403/429 errors', async () => {
    const { consumer, reAddTask } = makeHarness()

    await consumer.consume(makeOccurrence('404 Not Found'))
    await consumer.consume(makeOccurrence('Connection timed out'))

    expect(reAddTask).not.toHaveBeenCalled()
  })

  it('ignores occurrences from user-cancel', async () => {
    const { consumer, reAddTask } = makeHarness()

    await consumer.consume(
      makeOccurrence('403 Forbidden', { cause: 'user-cancel' })
    )

    expect(reAddTask).not.toHaveBeenCalled()
  })

  it('ignores occurrences created before consumer startup', async () => {
    const { consumer, reAddTask } = makeHarness({ startedAt: 5000 })

    await consumer.consume(makeOccurrence('403 Forbidden', { createdAt: 4000 }))

    expect(reAddTask).not.toHaveBeenCalled()
  })
})
