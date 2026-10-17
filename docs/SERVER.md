# Nio Downloader Server (Headless / Docker)

Nio Downloader Server packages the web UI, download orchestration core, and the SQLite-persisted aria2 engine into a secure, non-root, multi-architecture (`linux/amd64` and `linux/arm64`) Docker container for NAS devices, home servers, and cloud instances.

---

## 1. Quick Start: `docker run`

Run the container with standard persistent storage:

```bash
# Create host directories
mkdir -p ./data ./downloads
chown -R 1000:1000 ./data ./downloads

# Run container
docker run -d \
  --name nio-server \
  --restart unless-stopped \
  --user 1000:1000 \
  --security-opt no-new-privileges:true \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -p 8080:8080 \
  -p 16801:16801 \
  -v "$(pwd)/data:/data" \
  -v "$(pwd)/downloads:/downloads" \
  -e NIODOWNLOADER_PUBLIC_URL="http://192.168.1.100:8080" \
  -e NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP="true" \
  niodownloader/server:local
```

Access the Web UI at `http://<your-server-ip>:8080`.

---

## 2. Docker Compose Deployment

The repository includes a production-ready [`compose.yaml`](../compose.yaml).

### Example `compose.yaml`

```yaml
name: niodownloader

services:
  server:
    image: "${NIODOWNLOADER_IMAGE:-niodownloader/server:latest}"
    init: true
    read_only: true
    user: "${NIODOWNLOADER_UID:-1000}:${NIODOWNLOADER_GID:-1000}"
    security_opt:
      - no-new-privileges:true
    restart: unless-stopped
    stop_grace_period: 2m
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64m,mode=1777
    environment:
      NIODOWNLOADER_DATA_DIR: /data
      NIODOWNLOADER_TEMP_DIR: /data/tmp
      NIODOWNLOADER_PLUGIN_DIR: /data/plugins
      NIODOWNLOADER_DEFAULT_SAVE_DIR: /downloads
      NIODOWNLOADER_ALLOWED_SAVE_DIRS: /downloads
      NIODOWNLOADER_ARIA2_RPC_LISTEN_ALL: "${NIODOWNLOADER_ARIA2_RPC_LISTEN_ALL:-false}"
      NIODOWNLOADER_TORRENT_BODY_LIMIT_MIB: "${NIODOWNLOADER_TORRENT_BODY_LIMIT_MIB:-8}"
      NIODOWNLOADER_MDXP_HOST: 0.0.0.0
      NIODOWNLOADER_MDXP_PORT: 16801
      NIODOWNLOADER_PUBLIC_URL: "${NIODOWNLOADER_PUBLIC_URL:-http://localhost:8080}"
      NIODOWNLOADER_REMOTE_EXTENSION_ENABLED: "${NIODOWNLOADER_REMOTE_EXTENSION_ENABLED:-true}"
      NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL: "${NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL:-ws://localhost:16801}"
      NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP: "${NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP:-true}"
    ports:
      - "${NIODOWNLOADER_WEB_BIND_IP:-0.0.0.0}:${NIODOWNLOADER_HTTP_PORT:-8080}:8080"
      - "${NIODOWNLOADER_MDXP_BIND_IP:-0.0.0.0}:${NIODOWNLOADER_MDXP_PUBLIC_PORT:-16801}:16801"
    volumes:
      - ./nio-data:/data
      - ./downloads:/downloads
```

To start the service:
```bash
docker compose up -d
```

---

## 3. Environment Variables Reference

All runtime configuration uses the standardized `NIODOWNLOADER_*` prefix:

| Variable | Default | Description |
| --- | --- | --- |
| `NIODOWNLOADER_DATA_DIR` | `/data` | Directory for persistent state, SQLite DB, and settings |
| `NIODOWNLOADER_TEMP_DIR` | `/data/tmp` | Temporary staging directory for active downloads |
| `NIODOWNLOADER_PLUGIN_DIR` | `/data/plugins` | Directory for installed user plugins |
| `NIODOWNLOADER_DEFAULT_SAVE_DIR` | `/downloads` | Default save path for completed downloads |
| `NIODOWNLOADER_ALLOWED_SAVE_DIRS` | `/downloads` | Colon- or comma-separated list of permitted save paths |
| `NIODOWNLOADER_PUBLIC_URL` | `""` | Publicly reachable HTTP URL of the server web UI |
| `NIODOWNLOADER_HTTP_PORT` | `8080` | Host port mapped to the web UI |
| `NIODOWNLOADER_MDXP_PUBLIC_PORT` | `16801` | Host port mapped to MDXP bridge |
| `NIODOWNLOADER_REMOTE_EXTENSION_ENABLED`| `false` | Enable browser extension pairing over WebSocket |
| `NIODOWNLOADER_REMOTE_EXTENSION_PUBLIC_URL` | `""` | WebSocket address presented to extensions |
| `NIODOWNLOADER_ALLOW_INSECURE_OPERATOR_HTTP` | `false` | Allow operator authentication over unencrypted HTTP |
| `NIODOWNLOADER_ARIA2_RPC_LISTEN_ALL` | `false` | Bind aria2 RPC to all interfaces (defaults to loopback) |
| `NIODOWNLOADER_TORRENT_BODY_LIMIT_MIB` | `8` | Maximum torrent file upload size in MiB |
| `NIODOWNLOADER_OPERATOR_TOKEN` | *(auto-generated)* | Fixed token for administrative RPC access |

---

## 4. Volume Architecture

The container requires two distinct volumes:

1. **`/data`**:
   - Stores SQLite database (`niodownloader.db`), `settings.json`, aria2 session & DHT files, plugin packages, and secret store lockbox.
   - Low bandwidth, high write safety. **Back up this volume.**
2. **`/downloads`**:
   - Destination for completed downloads.
   - High throughput. Map to your NAS bulk storage array or pool.

---

## 5. Security & Non-Root Execution

The image is hardened for container environments:
- **Non-Root**: Runs under user `node:node` (UID 1000, GID 1000) or any arbitrary non-root user via `--user <uid>:<gid>`.
- **Read-Only Root**: The root filesystem (`/`) should remain mounted read-only (`--read-only`).
- **No New Privileges**: Configured with `--security-opt no-new-privileges:true`.
- **Tmpfs**: Requires a small tmpfs mount for `/tmp` (`--tmpfs /tmp:rw,noexec,nosuid,size=64m`).

