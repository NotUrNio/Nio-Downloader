// Browser platform entry.
//
// vscode-jsonrpc v9 split the runtime abstraction layer (RAL) out of the bare
// `vscode-jsonrpc` entry: creating/listening on a `MessageConnection` now
// requires a platform RAL to be installed first. Importing this module installs
// the browser RAL into the SAME `vscode-jsonrpc` instance that this package's
// `createMdxpConnection` resolves.
//
// A browser host (e.g. the Nio Downloader extension background script) imports
// `@niodownloader/mdxp/browser` once at startup. The full public API is re-exported, so
// `import { createMdxpConnection } from '@niodownloader/mdxp/browser'` also works.
import 'vscode-jsonrpc/browser'

// Browser transport classes, re-exported so a browser host imports its
// reader/writer from the same place as `createMdxpConnection` — no separate
// `vscode-jsonrpc` import, and guaranteed to be the instance this package
// installed the RAL into.
export {
  BrowserMessageReader,
  BrowserMessageWriter,
} from 'vscode-jsonrpc/browser'
export * from './index'
export type { WorkerLike } from './transports/worker'
export { fromWorker } from './transports/worker'
export type { WebSocketLike } from './transports/ws'
// High-level convenience constructors for browser transports.
export { fromWebSocket } from './transports/ws'
