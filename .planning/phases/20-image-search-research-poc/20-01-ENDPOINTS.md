# Phase 20-01 Endpoints

**Service:** `kidschat-image-search-mcp`
**Railway project:** KidsChat
**Environment:** production
**Railway service ID:** `78b1c1d5-ecb1-4e92-a7e7-9ff506e21e97`
**Deployed:** 2026-04-18

## URLs

| Purpose | URL |
| ------- | --- |
| Public base | `https://kidschat-image-search-mcp-production.up.railway.app` |
| Public health | `https://kidschat-image-search-mcp-production.up.railway.app/health` |
| Public MCP (JSON-RPC) | `https://kidschat-image-search-mcp-production.up.railway.app/mcp` |
| Internal base (for LibreChat → MCP, same project) | `http://kidschat-image-search-mcp.railway.internal:8080` |
| Internal MCP | `http://kidschat-image-search-mcp.railway.internal:8080/mcp` |

## For Plan 20-02 (dev Gist librechat.yaml)

```yaml
mcpServers:
  image-search:
    type: streamable-http
    url: "http://kidschat-image-search-mcp.railway.internal:8080/mcp"
    startup: true
    chatMenu: false
    serverInstructions: false
```

Internal URL is preferred (no public-network hop, zero egress cost). The
public URL is retained for curl-based smoke tests and parent verification.

## Verification evidence (2026-04-18)

```text
$ curl -fsS https://kidschat-image-search-mcp-production.up.railway.app/health
{"ok":true,"provider":"openverse"}

$ curl -sS -X POST -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
    https://kidschat-image-search-mcp-production.up.railway.app/mcp
event: message
data: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"kidschat-image-search-mcp","version":"0.1.0"}},"jsonrpc":"2.0","id":1}

$ tools/call image_search("origami cats", 3) → 3 thumbnails from api.openverse.org
```
