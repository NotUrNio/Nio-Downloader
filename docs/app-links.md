# Open Nio Downloader from a link

Nio Downloader supports `nio://` links in the desktop application. Links can open a page or prefill a new-task draft. They never create downloads, pause or resume tasks, install plugins, or access a local path automatically. Review and submit downloads inside Nio Downloader.

## Supported links

| Link | Result |
| --- | --- |
| `nio://` | Show the main window without changing its page |
| `nio://downloads` | All downloads |
| `nio://downloads/active` | Active downloads |
| `nio://downloads/completed` | Completed downloads |
| `nio://downloads/error` | Failed downloads |
| `nio://task-list` | Active downloads (legacy alias) |
| `nio://task-list?status=all` | All downloads; also accepts `active`, `completed`, and `error` |
| `nio://settings` or `nio://preferences` | Settings |
| `nio://about` | About in Settings |
| `nio://new-task` | Empty Links draft |
| `nio://new-task?uri=…` | Links draft with one validated HTTP, HTTPS, FTP, or Magnet address |
| `nio://new-bt-task` | Torrent draft; choose a file inside Nio Downloader |
| `nio://plugins/<id>` | Plugin details; installation still requires the in-app consent flow |
| `nio://tasks/<id>` | Existing task details using its task ID; unavailable tasks fall back to All downloads |

For `task-list`, the old `status=waiting` opens Active with an explanation. The old `status=stopped` opens All with an explanation that Completed and Error are now separate categories. An unknown status opens All and reports the invalid category. Opening a download list clears previous search/type filters, selection, and task details.

## Encode the nested address once

```js
const link = `nio://new-task?uri=${encodeURIComponent(downloadUrl)}`
```

Encode the full source address, including its query and fragment. Nio Downloader decodes the wrapper once, preserving any percent encoding inside the source address. Encode task and plugin IDs with `encodeURIComponent` as well. Scheme and command names are case-insensitive; IDs and download addresses retain their case. A single trailing slash is accepted.

Only `uri` on `new-task` and `status` on `task-list` are accepted query parameters. Duplicate parameters, malformed encoding, outer URL credentials/ports/fragments, and links over 64 KiB are rejected. Source addresses must pass the existing download-source validation, including its 16 KiB limit. Links do not accept multiple source addresses, cURL commands, or local paths.

## Changes from v1

`mo://` is retired. New installations no longer register it. If a stale system association still delivers one, Nio Downloader displays a retirement message and does not execute it. Upgrade cleanup removes an old association only when ownership by the current installation can be established; unrelated associations are preserved.

`pause-all-task`, `resume-all-task`, and `reveal-in-folder` are retired. Use the corresponding controls inside Nio Downloader.

Legacy parameters such as `silent`, `dir`, `out`, `allProxy`, `split`, `cookie`, `authorization`, `userAgent`, `referer`, `torrent`, `selectFile`, `type`, `path`, and `gid` are not supported. A link containing an unsupported parameter is rejected as a whole; it is not silently converted into a partial request. Unknown commands and malformed links produce a message without executing an action.

Direct `magnet:` links and `.torrent` file associations keep their existing behavior. Browser extensions and other authenticated integrations keep their existing APIs. This contract applies to desktop app links, not HTTP routes of the server.
