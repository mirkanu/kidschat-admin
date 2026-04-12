---
status: resolved
trigger: "DALL-E 3 generated images no longer render in conversation history — only an empty 'generated image' placeholder appears. Affects both the admin dashboard conversation viewer and LibreChat's native chat view."
created: 2026-04-11T00:00:00Z
updated: 2026-04-11T23:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — LibreChat stores images in container-local /app/client/public/images (ephemeral). Phase 15.1 LibreChat redeploy at 10:52 UTC wiped all 4 images generated at 08:12-09:01 UTC. MongoDB files records remain but files are gone from disk.
test: COMPLETE — SPA fallback pattern confirmed (any missing file returns 200 + HTML), image path confirmed via LibreChat source (imageOutput = /app/client/public/images)
expecting: Fix = add Railway Volume to LibreChat service mounted at /app/client/public/images
next_action: Add Railway Volume to LibreChat service via CLI

## Symptoms

expected: Past conversations with image-generation turns should display the generated image inline in both LibreChat chat view and admin dashboard conversation viewer
actual: Both views show an empty "generated image" holder — placeholder frame present but no image loads
errors: No console errors confirmed yet; need to inspect MongoDB message document attachments field
reproduction: Admin dashboard -> Conversations -> pick conversation where child asked to draw something -> image turn shows empty holder instead of image
started: Noticed 2026-04-11, regression within 24-48 hours OR age-related DALL-E URL TTL expiry (URLs expire ~2 hours)

## Eliminated

- hypothesis: H1 — DALL-E URL expiration (raw Azure Blob URLs with 2hr TTL)
  evidence: MongoDB files collection shows source="local", filepath="/images/..." — LibreChat downloaded and stored images locally. Not raw DALL-E URLs.
  timestamp: 2026-04-11T00:01:00Z

- hypothesis: H2 — Phase 15.3 code change broke admin image rendering path
  evidence: Admin conversation page.tsx correctly extracts att.type="image/png" + att.filepath, builds URL, simulated extraction produces correct URL. Code is not the bug.
  timestamp: 2026-04-11T00:01:00Z

- hypothesis: H3 — LibreChat schema change
  evidence: MongoDB message.attachments structure matches what page.tsx expects. No schema mismatch.
  timestamp: 2026-04-11T00:01:00Z

- hypothesis: Admin cross-domain auth — /images/ route requires LibreChat session cookie
  evidence: LibreChat source: createValidateImageRequest is a no-op when secureImageLinks is unset (default). /images/ IS publicly accessible. Root cause is missing files, not auth.
  timestamp: 2026-04-11T00:01:30Z

## Evidence

- timestamp: 2026-04-11T00:00:00Z
  checked: git log for conversation/dashboard files since 2026-04-08
  found: commit 9cf9bdf "feat(14-01): render generated images in admin conversation view" — feature was added. No subsequent changes to conversation viewer files.
  implication: Admin code hasn't changed since image rendering was added.

- timestamp: 2026-04-11T00:00:30Z
  checked: MongoDB files collection — 4 image_generation records
  found: source="local", filepath="/images/69cfd4edf4044c9e5e4c039a/...", created 2026-04-10 08:12–09:01 UTC. All 4 images generated before Phase 15.1 LibreChat redeploy.
  implication: H1 eliminated. Images were stored locally. MongoDB records exist but files may be gone.

- timestamp: 2026-04-11T00:00:40Z
  checked: curl https://librechat.../images/...dc700dfb...png
  found: HTTP 200, content-type: text/html — returns SPA index.html, not a PNG
  implication: File does not exist on LibreChat container disk. SPA serves index.html as 404 fallback.

- timestamp: 2026-04-11T00:00:50Z
  checked: curl any nonexistent path on LibreChat
  found: 200 text/html — confirmed SPA fallback pattern for ALL missing files
  implication: The "200 but HTML" is the indicator that files are missing from disk.

- timestamp: 2026-04-11T00:01:00Z
  checked: Phase 15.1 git commit timestamp vs image generation timestamps
  found: Images generated 08:12–09:01 UTC. Phase 15.1 LibreChat redeploy at 10:52 UTC (commit 975bbde).
  implication: Railway container ephemeral filesystem reset on redeploy. All 4 images were generated before the redeploy → wiped.

- timestamp: 2026-04-11T00:01:20Z
  checked: LibreChat source — api/config/paths.js
  found: imageOutput = path.resolve(__dirname, '..', '..', 'client', 'public', 'images') → /app/client/public/images inside container
  implication: This is the directory that must be backed by a Railway Volume to survive redeploys.

- timestamp: 2026-04-11T00:01:30Z
  checked: LibreChat source — validateImageRequest middleware
  found: When secureImageLinks is not set (our config), middleware is a no-op → images are publicly accessible
  implication: Admin dashboard cross-domain auth is NOT the bug. Images just need to exist on disk.

## Resolution

root_cause: LibreChat stores DALL-E generated images in the container-local filesystem at /app/client/public/images. Railway containers have ephemeral filesystems — no Railway Volume was attached to the LibreChat service. When LibreChat was redeployed for Phase 15.1 (2026-04-10 10:52 UTC), the container filesystem reset and all 4 images generated earlier that day (08:12–09:01 UTC) were permanently deleted. MongoDB files records still reference the filepath but the actual files no longer exist on disk. Both LibreChat native view and admin dashboard show empty holders because the image request returns the SPA index.html (LibreChat's 200 + HTML fallback for missing files).
fix: Created Railway Volume "librechat-🪶-volume" attached to LibreChat service at mount path /app/client/public/images (50 GB). Triggered LibreChat redeploy to activate the volume mount. LibreChat came back online at 2026-04-11 22:07:16 UTC with the volume mounted. Future DALL-E generated images will now persist across all future LibreChat redeploys.
verification: CONFIRMED by user 2026-04-11. Images now load correctly in both LibreChat frontend chat view and admin dashboard conversation viewer after the Railway Volume fix. Required RAILWAY_RUN_AS_ROOT=true environment variable to grant LibreChat write permissions to the mounted volume. Volume is persistent and images will survive all future redeploys.
files_changed: []
human_verified: true
human_verified_at: 2026-04-11T23:00:00Z
