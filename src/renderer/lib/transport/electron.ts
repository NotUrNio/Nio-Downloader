import { parseProtocolEnvelope } from '@shared/protocol/errors'
import type { EventChannel } from '@shared/protocol/events'
import { Queries } from '@shared/protocol/queries'
import type { AnyChannel, EventListener, Transport } from './types'

function getNioDownloader(): NonNullable<Window['niodownloader']> {
  if (!window.niodownloader) {
    throw new Error(
      'Preload not initialized: window.niodownloader is undefined'
    )
  }
  return window.niodownloader
}

export class ElectronTransport implements Transport {
  get platform(): NodeJS.Platform | 'web' {
    return window.niodownloader?.platform ?? 'web'
  }
  async invoke(channel: AnyChannel, ...args: unknown[]): Promise<unknown> {
    const value = await getNioDownloader().invoke(channel, ...args)
    return channel === Queries.GetTaskInspectorActivity
      ? parseProtocolEnvelope(value)
      : value
  }
  on(channel: EventChannel, cb: EventListener): void {
    getNioDownloader().on(channel, cb)
  }
  off(channel: EventChannel, cb: EventListener): void {
    getNioDownloader().off(channel, cb)
  }
}
