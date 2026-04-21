# 21-04 · CONFIG_PATH Reconciliation — Capture & Decision

## Live CONFIG_PATH as of 2026-04-21

Source: `railway variables --service "LibreChat 🪶" --kv | grep '^CONFIG_PATH='`

```
CONFIG_PATH=https://gist.githubusercontent.com/mirkanu/b0c89395bbefb4f7ff9124d0d9014999/raw/603952711b835350e3d086bbee47e2a945b4e18d/dev-librechat.yaml
```

**LibreChat public domain:** `librechat-production-bff2.up.railway.app`

## Gist classification

| Field | Value |
|-------|-------|
| Gist ID | `b0c89395bbefb4f7ff9124d0d9014999` |
| Pinned SHA | `603952711b835350e3d086bbee47e2a945b4e18d` |
| File | `dev-librechat.yaml` |
| Classification | **DEV Gist** (Phase 20 POC artifact — see 20-DECISIONS.md § Artifacts that survive Phase 20) |

### Note on D-10 IDs

D-10 (in `20-DECISIONS.md`) records two Gist IDs: `3206129683ee…` (dev) and `6bf08d0e…` (production).
The **actual** dev Gist ID surviving from Phase 20 (per the Artifacts block in the same file, line ~118)
is `b0c89395bbefb4f7ff9124d0d9014999`. The IDs in the D-10 prose are stale or truncated and
do not match any live Gist. Classification is by content & artifact-block cross-reference.

## Image Search verification (pre-decision)

The plan asked for `curl /api/config` + grep. That endpoint is public and only exposes login-related
config on LibreChat v0.8.x — **it does not expose `modelSpecs` without authentication**. Verified:

```
$ curl -fsS https://librechat-production-bff2.up.railway.app/api/config
{"appTitle":"LibreChat","discordLoginEnabled":false,...,"turnstile":{}}   # 758 bytes, NO modelSpecs
```

Adjusted verification (Rule 3 — plan's `/api/config` check is not executable):
fetch the raw Gist content at the exact pinned SHA that the service is serving.

```
$ curl -fsS "https://gist.githubusercontent.com/mirkanu/b0c89395bbefb4f7ff9124d0d9014999/raw/603952711b835350e3d086bbee47e2a945b4e18d/dev-librechat.yaml" > /tmp/live-gist.yaml
$ grep -n "Image Search\|image-search" /tmp/live-gist.yaml
16:# Phase 20-02: Image Search MCP server declared (dev Gist only — POC isolation D-08/D-09).
17:#   Image Search preset added after Drawing Studio. Production Gist untouched.
92:    # ---- PRESET 6: Image Search (Phase 20 POC — dev only) ----
93:    - name: image-search
94:      label: "Image Search"
154:# ---- Phase 20 POC: Image Search MCP Server declaration ----
159:  image-search:
161:    url: "https://kidschat-image-search-mcp-production.up.railway.app/mcp"
```

Both the `modelSpecs.list` "Image Search" entry (line 94) and `mcpServers.image-search` entry (line 159)
are present in the live-served Gist. Live configuration is functionally correct; the remaining
question is D-10 bookkeeping (swap vs. anoint).

## Parent checkpoint

Sent via Telegram at unix-time 1776769589 (2026-04-21):

> Phase 21-04 · CONFIG_PATH reconciliation (D-10)
> Live CONFIG_PATH (librechat service): b0c89395bbefb4f7ff9124d0d9014999 @ SHA 603952711b
> → This is the Phase 20 DEV Gist, currently serving parent-live Image Search traffic since 2026-04-20.
>
> Options:
> 1. swap → merge dev→prod Gist, pin to new SHA, railway variables --set CONFIG_PATH=<prod>, redeploy, retire dev Gist (D-10 literal)
> 2. deviate → anoint dev as production, record D-21-A superseding D-10, no churn
> 3. hold → pause Phase 21-04 entirely, escalate
>
> After you reply, Task 21-04-03 will re-grant Penelope + Sebastian their Image Search ACLs — this is the kid go-live flip.

**Poll status as of 2026-04-21T<execute-wave-2>:** no reply received in initial 90-second in-agent poll.
Per plan directive ("If parent does not reply within 30 minutes, return CHECKPOINT REACHED — do NOT
proceed without explicit GO"), executor returns a `checkpoint:human-action` to the orchestrator.

## Post-decision actions (will be filled in by continuation agent)

- [ ] Parent reply captured (`swap` / `deviate` / `hold`)
- [ ] Branch executed (A / B1 / B2)
- [ ] Post-swap grep output (Branch B1 only)
- [ ] STATE.md entry written:
      `[Phase 21 · D-10 resolution]: Live CONFIG_PATH = <gist id> (<prod|dev-as-prod|unchanged>); Image Search modelSpec + mcpServers grep-verified in live-served Gist on 2026-04-21.`
