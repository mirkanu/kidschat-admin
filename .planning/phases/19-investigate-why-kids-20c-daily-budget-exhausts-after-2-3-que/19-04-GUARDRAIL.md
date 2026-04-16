# 19-04 Guardrail Implementation

**Date:** 2026-04-16  
**Classification from forensics:** D — Unknown (with large-photo-upload correlation)

---

## Classification

D — Unknown / insufficient evidence

The mystery drain of 194,116 credits happened in a 58-second window between the last confirmed
transaction (18:35:20) and the first balance=0 check (18:38:45). The only MongoDB event in that
window was the file upload of IMG_2210.jpeg (844KB) and IMG_2211.jpeg (1.9MB) at 18:37:46.
None of the three incident conversations (4594a8db, 61046315, 665d16e9) reached the Anthropic API
— all were blocked by LibreChat's pre-flight balance gate. The root cause is a LibreChat v0.8.5-rc1
internal behavior that cannot be confirmed without source code access or debug logging.

Per the plan: Classification D mandates the image size limit guardrail (same as A).

---

## Guardrail Chosen

**Image file size limit via librechat.yaml fileConfig**

- `fileConfig.serverFileSizeLimit: 2` (MB) — hard server-side rejection for all files over 2MB
- `fileConfig.avatarSizeLimit: 2` (MB) — same limit for avatar uploads
- `fileConfig.endpoints.default.fileSizeLimit: 2` (MB) — per-endpoint limit

---

## Rationale

1. **Big images correlate with the drain.** The two photos uploaded immediately before the drain were IMG_2211.jpeg (1.9MB) and IMG_2210.jpeg (844KB). Even if the root cause is unknown, the blast radius is bounded by file size: smaller images mean fewer vision tokens, lower estimated costs, and reduced exposure to any pre-deduction bug.

2. **Vision tokens scale with image dimensions.** A 1.9MB 642x1999 image generates ~3,000 vision tokens (4 tiles at 750 tokens each). With two large photos and the agent overhead, each blocked request had tokenCost=3,195–3,197 even without a response. Capping files at 2MB limits the per-message vision token cost.

3. **User experience impact is minimal.** Phone photos from modern phones are typically 3–10MB (HEIC/JPEG original) but LibreChat converts them to PNG and resizes. The 1.9MB file after conversion was already smaller than a typical phone original. A 2MB limit will still allow smaller phone photos and screenshots.

4. **Server-side enforcement is non-bypassable.** `serverFileSizeLimit` is enforced at the LibreChat API upload endpoint before any token estimation or balance deduction occurs. This is stronger than client-side validation.

5. **Defense in depth.** Even if the root cause turns out NOT to be the file upload, this guardrail reduces the max vision token budget per message, limiting the worst-case cost of any single request.

---

## Implementation

### Gist Changes

Old `fileConfig` section (Gist revision 3295aeb):
```yaml
fileConfig:
  endpoints:
    default:
      disabled: true
```

New `fileConfig` section (Gist revision 7049fc8):
```yaml
fileConfig:
  serverFileSizeLimit: 2
  avatarSizeLimit: 2
  endpoints:
    default:
      disabled: true
      fileSizeLimit: 2
```

### Deployment Record

| Item | Value |
|------|-------|
| Previous Gist hash | 3295aeb17d6ab47c867fc69dfedd2a632508f471 |
| New Gist hash | 7049fc833aee558c95665443ce6ca8ed8eb8ad20 |
| Gist ID | e23b999f1d3cd77726a97c20e26f0abf |
| Gist URL | https://gist.github.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf |
| CONFIG_PATH (LibreChat service) | https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/7049fc833aee558c95665443ce6ca8ed8eb8ad20/librechat.yaml |
| LibreChat redeploy triggered | 2026-04-16 ~22:50 UTC |
| LibreChat redeploy status | SUCCESS |

### Steps Performed

1. Fetched current yaml from Gist via GitHub REST API
2. Added `serverFileSizeLimit: 2`, `avatarSizeLimit: 2` to top-level fileConfig
3. Added `fileSizeLimit: 2` under `fileConfig.endpoints.default`
4. PATCH'd Gist via `PATCH /gists/{id}` — new revision 7049fc8 created
5. Updated `CONFIG_PATH` on both LibreChat and admin Railway services to new hash
6. Triggered `serviceInstanceRedeploy` for LibreChat service
7. Polled deployment status until `SUCCESS`
8. Verified via Railway logs

---

## Verification

### Railway startup log confirms config loaded:

```
2026-04-16T22:53:19  "fileConfig": {
2026-04-16T22:53:19    "serverFileSizeLimit": 2,
2026-04-16T22:53:19    "avatarSizeLimit": 2,
2026-04-16T22:53:19        "fileSizeLimit": 2
```

The LibreChat startup log prints the parsed config at info level. The three size limit fields
appear exactly as configured, confirming the new Gist revision was loaded at startup.

### CONFIG_PATH verification:

```
railway variables --service 1b298e47 | grep CONFIG_PATH
=> .../raw/7049fc833aee558c95665443ce6ca8ed8eb8ad20/librechat.yaml
```

The CONFIG_PATH on the LibreChat Railway service references hash `7049fc8`, matching the new Gist revision.

### Expected behavior post-deploy:

A file larger than 2MB uploaded to LibreChat will be rejected at the server with an HTTP 413 or
LibreChat's file-size-exceeded error BEFORE any token estimation or balance deduction occurs.
The IMG_2211.jpeg (1.9MB = 1,924,728 bytes) that was uploaded in the incident would be accepted
(it is under 2MB). The 2MB limit caps the worst case rather than preventing the exact incident image.

**Note for parent UAT (Task 4):** To verify the guardrail actively rejects, upload an image larger
than 2MB (e.g., a 5MB camera JPEG). LibreChat should respond with a file-too-large error and NOT
proceed to send the message. If the upload is accepted, the fileConfig did not take effect.
