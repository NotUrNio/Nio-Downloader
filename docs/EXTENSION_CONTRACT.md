# Nio Downloader — Extension Integration Contract

**Specification Version**: 1.0
**Host Application**: Nio Downloader (Desktop / Headless Server)
**Target Clients**: Nio Downloader Browser Extension (Chrome, Edge, Opera, Firefox, Safari)

This document is the authoritative contract for browser extension integration with Nio Downloader.

---

## 1. Native Messaging Host Identity

- **Host ID**: `com.nio.downloader.host`
- **Host Manifest Filename**: `com.nio.downloader.host.json`
- **Description**: `Nio Downloader browser download bridge`

### 1.1 Operating System Registration Locations

#### Windows (Registry HKCU)
The NSIS installer and runtime manager register the host under the following registry keys pointing to `<AppData>\Roaming\Nio Downloader\bridge\manifests\com.nio.downloader.host.json`:
- **Google Chrome**: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.nio.downloader.host`
- **Microsoft Edge**: `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.nio.downloader.host`
- **Opera**: `HKCU\Software\Opera Software\NativeMessagingHosts\com.nio.downloader.host`
- **Mozilla Firefox**: `HKCU\Software\Mozilla\NativeMessagingHosts\com.nio.downloader.host`

#### macOS
Manifest files are placed in:
- **Chrome**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.nio.downloader.host.json`
- **Edge**: `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/com.nio.downloader.host.json`
- **Firefox**: `~/Library/Application Support/Mozilla/NativeMessagingHosts/com.nio.downloader.host.json`

#### Linux
Manifest files are placed in:
- **Chrome**: `~/.config/google-chrome/NativeMessagingHosts/com.nio.downloader.host.json`
- **Chromium**: `~/.config/chromium/NativeMessagingHosts/com.nio.downloader.host.json`
- **Edge**: `~/.config/microsoft-edge/NativeMessagingHosts/com.nio.downloader.host.json`
- **Firefox**: `~/.mozilla/native-messaging-hosts/com.nio.downloader.host.json`

---

## 2. Trusted Extension Allowlist

The application verifies extension identities against a trusted allowlist before pairing.

### 2.1 Configuration File (`src/shared/config/native-messaging-extensions.json`)

```json
{
  "chromium": [
    "lggbokfckofcgjndaboioakcmincinpo",
    "efcflljngohddnmfmebiamigoikmdfbf"
  ],
  "firefox": [
    "nio-downloader-extension@mozilla.org"
  ],
  "safari": [
    "app.niodownloader.safari.extension",
    "com.nio.downloader.safari.extension"
  ]
}
```

### 2.2 Format Constraints
- **Chromium family** (Chrome, Edge, Opera, Brave, Vivaldi): 32 lowercase characters matching `/^[a-p]{32}$/`.
- **Firefox**: Extension ID matching `/^[^\s@]+@[^\s@]+$/`.
- **User Settings**: Extensions can be dynamically added or removed by the user in **Settings → Integration → Trusted Extensions**.

---

## 3. Connection & Transport Discovery

Extensions connect to Nio Downloader via a local WebSocket endpoint:
- **Loopback Ports**: Fixed candidate port range `16802` – `16806` on `127.0.0.1`.
- **Endpoint Route**: `/pair` (for handshake and encrypted session frames).
- **Native Messaging Bridge**: On Chromium/Firefox, calling `chrome.runtime.connectNative("com.nio.downloader.host")` allows the extension to query the active port and obtain a one-shot Native Messaging attestation ticket (`ticket`).

---

## 4. Pairing & Authentication Protocol (MBP1)

All frames post-handshake are encrypted with AES-256-GCM. MDXP JSON-RPC 2.0 messages travel exclusively inside this encrypted channel.

### 4.1 First-Time Pairing (8-Character Code Flow)
1. **Initiation**: The extension connects to `ws://127.0.0.1:<port>/pair` and sends a SPAKE2 (RFC 9382) initiator point `A`, along with client metadata and optional NM ticket.
2. **User Authorization**: Nio Downloader displays an approval dialog showing the requesting browser and extension ID. If accepted, Nio Downloader generates an 8-character human-friendly code (Crockford base32: uppercase digits and letters omitting I, L, O, U).
3. **Code Entry**: The user enters the 8-character code into the extension popup.
4. **Key Derivation**: Both parties derive a mutual 256-bit symmetric key (`mutualKey`).
5. **Session Established**: The extension stores `mutualKey` securely in extension local storage for future reconnection.

### 4.2 Reconnection Flow
When reconnecting, the extension and app perform a mutual challenge–response using the stored `mutualKey`. No user code entry is required.

---

## 5. MDXP Protocol (JSON-RPC 2.0)

Once the encrypted channel is established, the connection speaks JSON-RPC 2.0.

### 5.1 Initialization (`nio/initialize`)

#### Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "nio/initialize",
  "params": {
    "client": {
      "name": "nio-downloader-extension",
      "version": "1.0.0",
      "kind": "extension",
      "extensionId": "lggbokfckofcgjndaboioakcmincinpo"
    }
  }
}
```

#### Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "1.0",
    "server": {
      "name": "nio-downloader",
      "version": "2.0.0",
      "runtime": "electron"
    },
    "capabilities": {
      "ffmpegAvailable": true,
      "selectionKinds": ["direct", "hls", "dash", "mux"],
      "progress": true,
      "cancellation": true,
      "taskReveal": true,
      "downloadDirectories": true
    },
    "serverAdapters": []
  }
}
```

---

### 5.2 Read Methods

#### `task/list`
Fetch list of downloads.
- **Params**:
  - `status` *(optional)*: `'downloading' | 'completed' | 'error'`
  - `offset` *(optional)*: number (default: 0)
  - `limit` *(optional)*: number
- **Result**: `{ tasks: MdxpTask[], total: number }`

#### `task/get`
Fetch a single task by ID.
- **Params**: `{ taskId: string }`
- **Result**: `{ task: MdxpTask | null }`

#### `stats/get`
Fetch aggregate download/upload throughput.
- **Params**: `{}`
- **Result**:
  ```json
  {
    "downloadSpeed": 5242880,
    "uploadSpeed": 102400,
    "numActive": 2,
    "numWaiting": 0,
    "numStopped": 5
  }
  ```

#### `download/directories`
Fetch available download directories.
- **Params**: `{}`
- **Result**:
  ```json
  {
    "default": "D:\\Downloads",
    "current": "D:\\Downloads",
    "available": ["D:\\Downloads", "D:\\Videos"]
  }
  ```

#### `engine/status`
Fetch aria2 engine health and features.
- **Params**: `{}`
- **Result**: `{ state: "ready", featureReport: { sqlitePersistence: true, connectionLimit: 64 } }`

---

### 5.3 Write Methods

#### `download/add`
Create a new download task.
- **Params**:
  - `url` *(string, required)*: HTTP/HTTPS/FTP/Magnet URL or torrent file data URI.
  - `filename` *(string, optional)*: Desired output filename.
  - `directory` *(string, optional)*: Target directory.
  - `headers` *(object, optional)*: HTTP request headers (e.g. `Referer`, `Cookie`, `Authorization`).
  - `userAgent` *(string, optional)*: Custom User-Agent.
  - `cookies` *(string, optional)*: Raw cookie header string.
  - `selection` *(object, optional)*: Media selection mode `{ kind: "direct" | "hls" | "dash" | "mux" }`.
- **Result**: `{ taskId: string }`

#### `task/pause`
- **Params**: `{ taskId: string }`
- **Result**: `{ ok: true }`

#### `task/resume`
- **Params**: `{ taskId: string }`
- **Result**: `{ ok: true }`

#### `task/remove`
- **Params**: `{ taskId: string, deleteFiles?: boolean }`
- **Result**: `{ ok: true }`

#### `task/reveal`
Reveal downloaded file in File Explorer / Finder.
- **Params**: `{ taskId: string }`
- **Result**: `{ ok: true }`

---

### 5.4 Server-Sent Notifications (Events)

Notifications are pushed from Nio Downloader to connected extensions without request IDs:

#### `$/task/progress`
```json
{
  "jsonrpc": "2.0",
  "method": "$/task/progress",
  "params": {
    "taskId": "task-uuid",
    "completedLength": 10485760,
    "totalLength": 52428800,
    "downloadSpeed": 2097152,
    "percent": 20,
    "eta": 20
  }
}
```

#### `$/task/completed`
```json
{
  "jsonrpc": "2.0",
  "method": "$/task/completed",
  "params": {
    "taskId": "task-uuid",
    "outputPath": "D:\\Downloads\\video.mp4"
  }
}
```

#### `$/task/error`
```json
{
  "jsonrpc": "2.0",
  "method": "$/task/error",
  "params": {
    "taskId": "task-uuid",
    "errorCode": 4006,
    "errorMessage": "FFmpeg merge failure"
  }
}
```

#### `$/stats`
```json
{
  "jsonrpc": "2.0",
  "method": "$/stats",
  "params": {
    "downloadSpeed": 2097152,
    "uploadSpeed": 0,
    "numActive": 1,
    "numWaiting": 0,
    "numStopped": 3
  }
}
```

---

## 6. Error Codes

| Code | Name | Description |
|---|---|---|
| `-32700` | ParseError | Invalid JSON received by the host |
| `-32600` | InvalidRequest | JSON sent is not a valid JSON-RPC 2.0 Request |
| `-32601` | MethodNotFound | Method does not exist or is not available on this runtime |
| `-32602` | InvalidParams | Invalid method parameters |
| `-32603` | InternalError | Internal engine or system error |
| `4001` | UserDenied | The user declined the pairing request |
| `4002` | SessionExpired | The pairing code or reconnect challenge expired |
| `4003` | DuplicateTask | Download task already exists in the active queue |
| `4004` | ResourceUnavailable | Target task ID was not found |
| `4005` | UnsupportedStream | Live streams or DRM-protected streams are not supported |
| `4006` | FfmpegMergeFailed | Audio/video stream merging failed |
| `4007` | StorageError | Insufficient disk space or write permission denied |
