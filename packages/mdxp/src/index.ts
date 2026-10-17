// MDXP — Nio Downloader Download eXchange Protocol
// Public API surface for both Nio Downloader desktop and the browser extension.

// vscode-jsonrpc primitives that appear in this package's public API surface,
// re-exported so consumers import them from `@niodownloader/mdxp` instead of reaching
// for a second package. Platform transport classes (StreamMessageReader,
// BrowserMessageReader, …) are re-exported from `./node` and `./browser`.
export type {
  Disposable,
  MessageConnection,
  MessageReader,
  MessageWriter,
} from 'vscode-jsonrpc'
export {
  CancellationToken,
  CancellationTokenSource,
  ResponseError,
} from 'vscode-jsonrpc'
export type {
  MdxpConnection,
  MdxpNotificationMap,
  MdxpRequestMap,
} from './connection'
export { createMdxpConnection } from './connection'
export type { ErrorCode, MdxpError, MdxpErrorData } from './errors'
export {
  ErrorCodes,
  isNioError,
  isProtocolError,
  makeMdxpError,
} from './errors'
export type { Method, Notification } from './methods'
export { Methods, Notifications } from './methods'

// Schemas (for callers that want runtime validation)
export * from './schemas/index'
export type { AgentTool, MdxpToolDef } from './tools'

// Tool registry / AI-agent tool catalog
export {
  SERVER_INITIATED_METHODS,
  Tools,
  toAgentToolCatalog,
} from './tools'
// Types (re-exported from schemas via types barrel)
export type * from './types'
