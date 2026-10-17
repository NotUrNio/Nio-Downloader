import { TaskStatus } from '@shared/types/task'
import type { TaskOccurrence } from '@shared/types/task-occurrence'

/**
 * Recognizes HTTP 403 Forbidden or HTTP 429 Too Many Requests in engine error messages.
 * Matches status code boundaries for 403 and 429 (e.g. "403 Forbidden", "status 429", "errorCode=22 ... 403").
 */
export function isHttp403Or429(errorMessage: string | null | undefined): {
  matched: boolean
  status?: number
} {
  if (!errorMessage) return { matched: false }
  const match = errorMessage.match(/\b(403|429)\b/)
  if (match) {
    return { matched: true, status: Number.parseInt(match[1], 10) }
  }
  return { matched: false }
}

export interface HttpFallbackDeps {
  isMaxSpeed(): boolean
  getTaskStatus(taskId: string): TaskStatus | null
  getTaskErrorMessage(taskId: string): string | null | undefined
  reAddTask(
    taskId: string,
    options?: { connections?: number }
  ): Promise<unknown>
  log: {
    info(ctx: Record<string, unknown>, msg: string): void
    warn(ctx: Record<string, unknown>, msg: string): void
  }
  now?: () => number
}

export interface HttpFallbackConsumer {
  name: 'http-fallback'
  consume(occ: TaskOccurrence): Promise<void>
  reset(): void
}

/**
 * Occurrence consumer that intercepts HTTP 403 / 429 errors when Max Speed is active.
 * Retries the task once with a conservative connection limit (connections: 4).
 */
export function createHttpFallbackConsumer(
  deps: HttpFallbackDeps
): HttpFallbackConsumer {
  const startedAt = (deps.now ?? Date.now)()
  const retriedTaskIds = new Set<string>()

  async function consume(occ: TaskOccurrence): Promise<void> {
    if (occ.type !== 'terminal') return
    if (occ.toStatus !== TaskStatus.Error) return
    if (occ.cause === 'user-cancel') return
    if (occ.createdAt < startedAt) return
    if (!deps.isMaxSpeed()) return

    const errorMessage =
      occ.errorGroup?.errorMessage ?? deps.getTaskErrorMessage(occ.taskId)
    const check = isHttp403Or429(errorMessage)
    if (!check.matched || !check.status) return

    if (retriedTaskIds.has(occ.taskId)) return
    if (deps.getTaskStatus(occ.taskId) !== TaskStatus.Error) return

    retriedTaskIds.add(occ.taskId)

    deps.log.info(
      { taskId: occ.taskId, status: check.status },
      `Server returned HTTP ${check.status}; retrying with conservative connection count`
    )

    try {
      await deps.reAddTask(occ.taskId, { connections: 4 })
    } catch (err) {
      deps.log.warn(
        {
          taskId: occ.taskId,
          err: err instanceof Error ? err.message : String(err),
        },
        'http fallback attempt failed'
      )
    }
  }

  return {
    name: 'http-fallback',
    consume,
    reset() {
      retriedTaskIds.clear()
    },
  }
}
