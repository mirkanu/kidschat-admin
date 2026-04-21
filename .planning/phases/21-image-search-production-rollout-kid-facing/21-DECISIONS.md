---
phase: 21
milestone: v2.9
status: EXECUTING
last_updated: 2026-04-21
supersedes:
  - 20-DECISIONS.md § D-10
---

# Phase 21 — Architectural Decisions (authoritative)

Phase-21-specific decisions. Entries here supersede Phase 20 decisions where noted.

## D-21-A · Dev Gist anointed as production Gist; D-10 superseded

**Status:** Parent-confirmed 2026-04-21 via Telegram (`deviate` reply).

**Context:**

Phase 20 D-10 ("No `CONFIG_PATH` revert; dev Gist stays live") carried a Phase 21 follow-through
constraint: "Phase 21 must end with a `CONFIG_PATH` swap to production Gist (or merge the dev-Gist
additions into the production Gist and drop the dev Gist entirely — same outcome)."

Between 2026-04-20 and 2026-04-21 the dev Gist (`b0c89395bbefb4f7ff9124d0d9014999`, pinned at SHA
`603952711b835350e3d086bbee47e2a945b4e18d`) served the parent-live LibreChat production traffic
without incident. Parent UAT ran against it. ACL-gated kids (D-9) do not yet see Image Search, so
no kid-facing churn from the dev-Gist classification. The planned D-10 swap at Phase 21 close
would require:

1. Merging dev→prod Gist content (they are already byte-equivalent for Image Search purposes).
2. A `railway variables --set CONFIG_PATH=<prod-gist-sha-url>` + redeploy cycle.
3. A LibreChat cold-start window during the redeploy.

For zero functional benefit (content is already the content users are served) and one cold-start
window of risk.

**Decision:**

Anoint the dev Gist `b0c89395bbefb4f7ff9124d0d9014999` as the **production** Gist. Execute a
rename-only cleanup on GitHub (description → `kidschat-production-librechat-config`). **Do not**
swap `CONFIG_PATH`. **Do not** merge into the original prod Gist `6bf08d0e…`; leave it archival
as a cold backup.

All future Phase 21.x / Phase 22 LibreChat YAML edits target Gist `b0c89395bbefb4f7ff9124d0d9014999`.

**Consequences:**

- `20-DECISIONS.md § D-10` is **SUPERSEDED** by this entry. The D-10 "final swap" literal is
  marked complete-by-deviation in `21-04-CONFIG-PATH-CHECK.md`.
- The original production Gist `6bf08d0e…` remains in place untouched (cold backup). No traffic
  is ever routed to it; if it drifts, nothing breaks.
- The Gist formerly known as "dev" is now canonically `kidschat-production-librechat-config` in
  the GitHub UI. Future deploy scripts (e.g., `scripts/deploy-librechat-yaml.ts`) already target
  this Gist ID and require no code change.
- Rollback path if ever needed: `railway variables --service "LibreChat 🪶" --set CONFIG_PATH=<any-prior-pinned-SHA-of-same-gist>`
  + redeploy. Prior SHAs remain accessible via the Gist history (see `21-04-CONFIG-PATH-CHECK.md`).

**Parent reply (Telegram, 2026-04-21):** `deviate`
