---
quick_id: 260420-upl
status: complete
date: 2026-04-20
related_phases: [19]
---

# Fix image upload on kid-facing LibreChat (10MB + agents endpoint)

## Symptom
Penelope (daily user) reported "an error occurred while uploading your file" when trying to analyse an image. Parent account reproduced. LibreChat logs showed `ErrorController => error File too large`.

## Root cause (two layers)

1. **`fileConfig.serverFileSizeLimit: 2`** — set by Phase 19-04 as a cost guardrail (research estimated ~3,000 vision tokens per 2MB photo). Modern iPhone photos routinely exceed 2MB.
2. **`fileConfig.endpoints.default.disabled: true`** with no explicit `agents` endpoint entry → kids' requests (which route through the `agents` endpoint) fell through to the disabled default, blocking uploads regardless of file size.

## Fix (config-only, no code changes)

Updated both Gists (dev `b0c89395…` + prod `e23b999f…`):
- `serverFileSizeLimit: 10` (10MB — balances phone photos with the ~$0.003/image cost at Haiku 4.5 vision rates)
- Explicit `endpoints.agents` entry: `fileSizeLimit: 10`, `supportedMimeTypes: ["image/.*", "application/pdf"]`
- Same for `endpoints.anthropic` (in case any preset routes there)
- Kept `endpoints.default.disabled: true` as a deny-by-default for any future endpoint

Railway `CONFIG_PATH` updated to the new dev Gist commit hash; LibreChat redeployed.

## Verification

`GET /api/files/config` returns:
```json
{
  "serverFileSizeLimit": 10,
  "avatarSizeLimit": 2,
  "endpoints": {
    "agents":    { "fileSizeLimit": 10, "supportedMimeTypes": ["image/.*", "application/pdf"] },
    "anthropic": { "fileSizeLimit": 10, "supportedMimeTypes": ["image/.*", "application/pdf"] },
    "default":   { "disabled": true, "fileSizeLimit": 10 }
  }
}
```

Over-limit error message: LibreChat's client-side validation (per `client/src/utils/files.ts` in upstream source) shows `File size limit exceeded: 10 MB` before upload. That's a real specific message, not the generic "an error occurred" Penelope saw.

## Cost impact

Per Phase 19-04 research: ~1,500-3,000 vision tokens per 2MB photo scales roughly with dimensions (Claude tiles internally). 10MB phone photos ≈ ~12,000 tokens ≈ $0.003/image at Haiku 4.5 $0.25/MTok input. Kids' 20¢/day budget supports ~66 uploads/day at the cap — more than enough headroom for normal use.

If usage reveals a cost pattern, Phase 21.x candidate: a Sharp-based Railway sidecar that resizes uploads to 1024×1024 max before forwarding, cutting per-image cost to ~$0.00075 flat.

## Commit
Config-only; artifacts live in the two GitHub Gists. No source code changed in this repo.
