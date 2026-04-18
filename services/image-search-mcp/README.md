# kidschat-image-search-mcp

A tiny MCP server that exposes one tool — `image_search` — backed by the
[Openverse](https://openverse.org/) public API. LibreChat v0.8.4 attaches this
as a streamable-http MCP server for the kid-facing "Image Search" preset
(Phase 20 POC / Phase 21 production).

## Why Openverse (and not Google)

The original Phase 20 plan selected Google Custom Search as primary with
Openverse as fallback. During execution, two blockers surfaced:

1. Google deprecated the "Search the entire web" toggle for new Programmable
   Search Engines. New engines can only be restricted to ≤50 listed sites — no
   `*.com` wildcard patterns that would give kids useful breadth.
2. The parent's Google Cloud project returned persistent `403 PERMISSION_DENIED`
   on the Custom Search API despite the API being enabled and key restrictions
   being configured correctly.

We dropped Google and made Openverse the sole provider. This simplifies the
architecture (zero credentials, zero user setup, zero dashboard dance) and
strengthens kid-safety: Openverse is a CC-licensed catalog curated from
Wikimedia, Flickr Commons, museums, and government archives — no SafeSearch
flag needed because the corpus is already pre-filtered.

**Trade-off:** Openverse lacks copyrighted contemporary characters (Pokémon,
Minecraft, Elsa, etc.). It is strong on animals, nature, history, art, science,
geography, vehicles, and world cultures. If breadth is insufficient after
Phase 20 UAT, the path forward is adding Pexels as a no-auth fallback — not
reintroducing Google CSE.

## Credentials

**None.** Openverse is unauthenticated.

## Environment

| Var        | Default   | Purpose                          |
| ---------- | --------- | -------------------------------- |
| `MCP_HOST` | `0.0.0.0` | Interface to bind                |
| `MCP_PORT` | `8080`    | TCP port                         |

## Endpoints

- `GET /health` — returns `{ "ok": true, "provider": "openverse" }`.
- `POST /mcp` — MCP streamable-http JSON-RPC endpoint.

## Local dev

```bash
npm install
npm run build
npm start
# in another shell:
curl -s http://localhost:8080/health | jq
```

## Tool surface

```json
{
  "name": "image_search",
  "inputSchema": {
    "query": "string (required)",
    "count": "integer 1-12 (default 10)"
  }
}
```

Response (wrapped in MCP `content[0].text` as JSON):

```json
{
  "images": [
    {
      "thumbnail": "https://api.openverse.org/v1/images/.../thumb/",
      "title": "origami cat tutorial",
      "source_domain": "flickr",
      "provider": "openverse",
      "license": "cc-by-2.0"
    }
  ],
  "provider_used": "openverse"
}
```

## Click-through policy (option iii)

`src/providers/openverse.ts` intentionally does NOT forward
`foreign_landing_url` or `url` from the Openverse response. Enforcement lives
at the tool boundary — the agent cannot leak a clickable source link because
the tool never returns one.

## Railway deploy

Configured via `railway.json`; deployed as service
`kidschat-image-search-mcp` in the KidAI Railway project. See
`.planning/phases/20-image-search-research-poc/20-01-ENDPOINTS.md` for the
live URLs.
