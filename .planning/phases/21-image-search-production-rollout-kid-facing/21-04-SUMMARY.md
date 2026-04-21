---
phase: 21-image-search-production-rollout-kid-facing
plan: 04
subsystem: safety+oversight
tags: [librechat, acl, gist, mongodb, railway, safety-patterns, image-search, oversight]

requires:
  - phase: 20-image-search-research-poc
    provides: Image Search MCP service + dev Gist + agent doc + 4 existing ACL rows
  - phase: 21-01
    provides: MCP blocklist regex list (IMAGE_SEARCH pre-search terms)
  - phase: 21-02
    provides: image-search quota admin backend
provides:
  - D-21-A formally supersedes D-10 — dev Gist anointed as production (rename-only, no CONFIG_PATH swap)
  - SAFETY-02 closed — IMAGE_PROMPT_PATTERNS extended with 4 new categories aligned to MCP blocklist
  - OVERSIGHT-01 closed — grep audit proves 17 image-search conversations + 46 messages persisted by native LibreChat write path (zero new logging code)
  - OVERSIGHT-02 closed — "Image Search" preset badge renders on admin /conversations list + detail views
  - Kids (Penelope + Sebastian) have ACL rows on the Image Search agent (permBits=1); preset visible on next LibreChat page load
affects: [22, 21-05]

tech-stack:
  added: []
  patterns:
    - "Idempotent ACL re-grant via principalId+resourceId upsert (not insert)"
    - "Deviate-branch doc: capture file + dedicated decisions entry + STATE log line for supersession"

key-files:
  created:
    - scripts/regrant-kids-image-search-acl.ts
    - .planning/phases/21-image-search-production-rollout-kid-facing/21-DECISIONS.md
  modified:
    - .planning/phases/21-image-search-production-rollout-kid-facing/21-04-CONFIG-PATH-CHECK.md
    - .planning/STATE.md

key-decisions:
  - "D-21-A: Dev Gist b0c89395 anointed as production; no CONFIG_PATH swap; D-10 superseded"
  - "Preset-distinguishing field for OVERSIGHT-02 badge: conversations.spec === 'image-search' (locked in Task 02)"
  - "OVERSIGHT-01 requires NO new logging — LibreChat's native conversation/message writes already persist everything (17 conversations / 46 messages audited)"
  - "SAFETY-02 needs NO new notification code — /api/alerts already scans ALL messages; extending IMAGE_PROMPT_PATTERNS suffices"

patterns-established:
  - "Pattern: when a Phase N decision turns out to be lower-risk than originally planned, prefer rename-only cleanup + dedicated superseding decision over churn-heavy swap"
  - "Pattern: MCP blocklist and IMAGE_PROMPT_PATTERNS alignment — every blocked MCP term must have a matching parent-alert regex so post-hoc visibility tracks pre-request blocking"

requirements-completed: [SAFETY-02, OVERSIGHT-01, OVERSIGHT-02]

duration: multi-session (Tasks 01+02 2026-04-21 AM; Tasks 00+03 2026-04-21 PM post parent reply)
completed: 2026-04-21
---

# Phase 21 Plan 04: Safety + Oversight Closeout + Kid GO-LIVE Summary

**Dev Gist anointed as production (D-21-A); SAFETY-02/OVERSIGHT-01/OVERSIGHT-02 closed without new logging or notification code; Penelope + Sebastian have ACLs on the Image Search agent.**

## Performance

- **Duration:** Multi-session. Tasks 01 + 02 completed morning 2026-04-21; Tasks 00 + 03 completed afternoon 2026-04-21 after parent `deviate` reply.
- **Completed:** 2026-04-21
- **Tasks:** 4 (00, 01, 02, 03)
- **Files modified:** 9 (see Files Created/Modified below)

## Accomplishments

- **CONFIG_PATH reconciliation (D-10 → D-21-A):** parent confirmed `deviate`; dev Gist `b0c89395bbefb4f7ff9124d0d9014999` renamed to `kidschat-production-librechat-config` via GitHub API — zero Railway redeploy, zero cold-start window.
- **SAFETY-02:** `IMAGE_PROMPT_PATTERNS` extended with 4 new label categories (sexual/anatomy, self_harm, drug_use, graphic_birth) that align byte-for-byte with the MCP-level `BLOCKED_QUERY_TERMS` from Plan 21-01. All 6 regression tests pass.
- **OVERSIGHT-01:** Grep audit confirms LibreChat's native write path persists everything — **17** image-search conversations + **46** messages in MongoDB as of audit time. Zero new logging code added.
- **OVERSIGHT-02:** "Image Search" badge renders on `/conversations` list and detail view, using `conversations.spec === "image-search"` as the preset-identifying field. Phase 20 backfill also retro-badged.
- **ACL re-grant (GO-LIVE flip):** `aclentries` rows for Penelope (`69d0315763d6125f1f553e98`) + Sebastian (`69d0315763d6125f1f553e97`) inserted via idempotent script. Both kids will see Image Search on next LibreChat page load. Plan 21-05 verifies in live UAT.

## Task Commits

1. **Task 21-04-01 (TDD): Extend IMAGE_PROMPT_PATTERNS** — `b0937fb` (test, RED), `0bf028f` (feat, GREEN)
2. **Task 21-04-02: Preset badge on /conversations** — `b40954b` (feat)
3. **Task 21-04 partial checkpoint** — `f51445b` (docs — CONFIG_PATH capture at time of Telegram checkpoint)
4. **Task 21-04-00: D-21-A deviate branch** — `92c6606` (docs: D-21-A supersedes D-10)
5. **Task 21-04-03: ACL re-grant script** — `f41a0ea` (feat)
6. **Plan metadata** — pending on this commit (docs: SUMMARY + STATE advance)

## Files Created/Modified

### Created
- `scripts/regrant-kids-image-search-acl.ts` — idempotent ACL re-grant; resolves agent._id by `agent_id` field and kid userIds by name lookup with hardcoded fallbacks. Executed successfully: 4 → 6 aclentries rows.
- `.planning/phases/21-image-search-production-rollout-kid-facing/21-DECISIONS.md` — D-21-A entry.
- `tests/lib/safety-patterns-image-search.test.ts` — 6 regression tests (Task 01 commit `b0937fb`).

### Modified
- `src/lib/safety-patterns.ts` — `IMAGE_PROMPT_PATTERNS` extended by 4 entries (Task 01).
- `src/app/(dashboard)/conversations/page.tsx` — projects `spec` field, derives `preset` string (Task 02).
- `src/components/dashboard/conversations-list.tsx` — renders `Badge` on `preset === "image-search"` (Task 02).
- `src/app/(dashboard)/conversations/[conversationId]/page.tsx` — passes `preset` prop through (Task 02).
- `src/components/dashboard/message-thread.tsx` — renders `Badge` in header when preset present (Task 02).
- `.planning/phases/21-image-search-production-rollout-kid-facing/21-04-CONFIG-PATH-CHECK.md` — finalized with `deviate` decision, reasoning, actions taken.
- `.planning/STATE.md` — decisions log entry for D-21-A.

## Decisions Made

### D-21-A — Dev Gist anointed as production (supersedes D-10)

Parent-confirmed `deviate` via Telegram 2026-04-21. The Phase 20 dev Gist
(`b0c89395bbefb4f7ff9124d0d9014999`, pinned SHA `603952711b…`) has served
production-live LibreChat since 2026-04-20 parent UAT and never flipped back. A
formal swap-and-redeploy as D-10 originally anticipated would introduce a
LibreChat cold-start window for purely cosmetic cleanup. Instead:

- Rename-only on GitHub: `gh api -X PATCH /gists/b0c89395... -f description='kidschat-production-librechat-config'` (HTTP 200, `updated_at: 2026-04-21T12:25:47Z`).
- `CONFIG_PATH` on Railway `LibreChat 🪶` service **unchanged**.
- Original prod Gist `6bf08d0e…` left untouched as archival cold backup.

Full detail in `21-DECISIONS.md § D-21-A` and `21-04-CONFIG-PATH-CHECK.md`.

### Preset-distinguishing field — `conversations.spec === "image-search"`

Locked during Task 02 after probing live `conversations` docs with
`mongo-inspect.ts`. `spec` is populated by LibreChat when a modelSpec preset is
selected (value = the modelSpec's `name`), which makes it the cleanest
preset-identity signal available. `agent_id` also works but is less portable
(would break if the agent is reseeded). Badge logic keys on `spec` first, falls
back to `agent_id === 'agent_kidschat_imagesearch_1776667852767'`.

### OVERSIGHT-01 = audit, not code

LibreChat v0.8.x's native conversation and message write path persists user
queries and AI responses (including the thumbnail-grid markdown) into the `test`
database's `conversations` and `messages` collections. No instrumentation code
path needs to be added; oversight is already on. The grep audit proves the
invariant holds:

```
conversations.count(agent_id="agent_kidschat_imagesearch_1776667852767"): 17
messages.count(in those conversations):                                  46
```

Both counts are > 0 across the Phase 20 POC + Phase 21 hardening window, which
is the SUMMARY-level proof OVERSIGHT-01 requires. No new logging code was added.

## OVERSIGHT-01 Grep Audit Dump

```
$ MONGODB_URI=<switchyard> npx tsx -e "<inline count query>"
conversations.count(agent_id=image-search):  17
messages.count(in those conversations):      46
```

Query details:
- `db.conversations.countDocuments({ agent_id: 'agent_kidschat_imagesearch_1776667852767' })` → 17
- `db.messages.countDocuments({ conversationId: { $in: [conversationIds from above] } })` → 46
- Captured 2026-04-21 via `switchyard.proxy.rlwy.net:57501`.

Confirmation: LibreChat's native write path is the single source of truth for
every image-search query + every returned thumbnail grid. Post-hoc safety
alerting (SAFETY-02) scans these same `messages` rows via `/api/alerts` — zero
new data path required.

## ACL Re-grant Before/After

Executed `npx tsx scripts/regrant-kids-image-search-acl.ts` via switchyard proxy.

### Before (4 rows on resourceId=69e5cd12f538d268466e71fd)

| principalId | permBits | Who |
|---|---|---|
| 69cfd4edf4044c9e5e4c039a | 15 | Manuel (agent) |
| 69cfd4edf4044c9e5e4c039a | 15 | Manuel (remoteAgent) |
| 69cfd67ff4044c9e5e4c03a7 | 1 | Emily-Kate |
| 69e6066634d4682d3439156b | 1 | claude-test@ |

### After (6 rows)

| principalId | permBits | Who | New? |
|---|---|---|---|
| 69cfd4edf4044c9e5e4c039a | 15 | Manuel (agent) | |
| 69cfd4edf4044c9e5e4c039a | 15 | Manuel (remoteAgent) | |
| 69cfd67ff4044c9e5e4c03a7 | 1 | Emily-Kate | |
| 69e6066634d4682d3439156b | 1 | claude-test@ | |
| 69d0315763d6125f1f553e97 | 1 | **Sebastian** (new) | ✅ `_id=69e76daf77432074761e59cd` |
| 69d0315763d6125f1f553e98 | 1 | **Penelope**  (new) | ✅ `_id=69e76daf77432074761e59ce` |

Idempotency verified: second invocation emitted `[skip] Sebastian already has
ACL row…` and `[skip] Penelope already has ACL row…` with no duplicate inserts.

## SAFETY-02: Parent-Email Pipeline Confirmation (zero new code)

`/api/alerts/route.ts` scans the `messages` collection for the last 90 days and
invokes `detectSafetyEvent` on every message; it does **not** filter by
conversation preset. Image-search preset messages are ordinary LibreChat
messages (`isCreatedByUser=true`, `role=user`), so the moment `IMAGE_PROMPT_PATTERNS`
covers a given blocked term, that term is caught by `/api/alerts` and fanned out
via the existing `src/lib/notify-safety-alert.ts` → `notification_recipients`
pipeline that has been delivering daily-summary + account-activity emails since
Phase 18.

Concretely:
- A kid sends "naked person photo" inside the Image Search preset.
- The message is persisted by LibreChat's native write path (OVERSIGHT-01 data flow).
- `/api/alerts` cron tick picks it up; `detectSafetyEvent` matches `IMAGE_PROMPT_PATTERNS`
  entry `label: "nudity"` (pre-existing) — alert row created.
- `notify-safety-alert.ts` looks up `notification_recipients` (Phase 18) and
  fans out the email to Manuel + Emily-Kate at the next cron cycle.
- **Zero new notification code** added in this plan. Zero config change. The
  pattern-list extension in Task 01 was the whole of the SAFETY-02 work.

## Deviations from Plan

### Auto-fixed / parent-approved

**1. [Rule 4 — parent decision] Task 00 B2 branch taken instead of B1**
- **Found during:** Task 00 (CONFIG_PATH reconciliation)
- **Issue:** Plan allowed either B1 (literal swap) or B2 (deviate); required parent decision via Telegram.
- **Resolution:** Parent replied `deviate` 2026-04-21. D-21-A created superseding D-10. No churn to Railway or LibreChat.
- **Committed in:** `92c6606` (docs: D-21-A supersedes D-10)

**2. [Rule 3 — blocking] Plan used `/api/config` endpoint that is not public on LibreChat v0.8.x**
- **Found during:** Task 00 pre-swap grep
- **Issue:** `curl https://<librechat>/api/config` returns 758 bytes of login-page config, no `modelSpecs`. Plan's grep test was non-executable.
- **Fix:** Re-grepped the raw Gist content at the exact pinned SHA the service is serving instead. Found the `"Image Search"` modelSpec entry at line 94 and `mcpServers.image-search` at line 159 — invariant holds.
- **Committed in:** `4c60aed` (docs: CONFIG_PATH capture).

**3. [Rule 3 — blocking] Local `MONGODB_URI` not resolvable via `railway run`**
- **Found during:** Task 03 ACL script execution.
- **Issue:** `railway run --service kidschat-admin` injects `mongodb.railway.internal` which is unresolvable from the local workstation (same as Phase 17 discovery).
- **Fix:** Executed with the switchyard proxy URL directly: `MONGODB_URI='mongodb://mongo:...@switchyard.proxy.rlwy.net:57501' npx tsx scripts/regrant-kids-image-search-acl.ts`.
- **Files modified:** None (runtime env only).

---

**Total deviations:** 3 (1 parent-approved decision, 2 plan-assumption fixes)
**Impact:** None on scope. All three are plan-assumption corrections, not scope creep.

## Issues Encountered

- One unexpected observation: sample AI message in the OVERSIGHT-01 audit had
  an empty `text` field. LibreChat v0.8.x writes the thumbnail-grid response
  into `messages.content[].text` (array form) rather than the top-level `text`
  field for tool-call responses. This does NOT invalidate OVERSIGHT-01 — the
  content is still persisted — and was already known from Phase quick-task
  `3-fix-blank-ai-response-bubbles` (STATE.md Quick Tasks table). Flagged here
  for Phase 21-05 UAT so the verifier knows not to expect `text` on image-search
  AI responses.

## User Setup Required

None. All actions were automated (GitHub Gist rename via API, MongoDB insert
via script).

## Threat Flags

None — no new security surface introduced. ACL grants are additive (permBits=1,
read/use) and match existing row shape. Gist rename is cosmetic metadata.

## Next Phase Readiness

**Phase 21-05 (UAT) is unblocked:**
- Both kids have ACL rows → will see 6th preset on next page load.
- SAFETY-02 pattern set covers MCP blocklist terms → adversarial queries trigger alerts.
- OVERSIGHT-02 badge makes it trivial to spot an Image Search conversation on the admin /conversations view.
- D-21-A frees future Phase 21.x / 22 work from the D-10 "swap before we can iterate" constraint.

**Out of scope (Plan 21-05 handles):** actually having the kids sign in and
run real queries against the live system with parent-UAT eyeballs.

## Self-Check: PASSED

**Files verified present:**
- FOUND: `.planning/phases/21-image-search-production-rollout-kid-facing/21-04-SUMMARY.md`
- FOUND: `.planning/phases/21-image-search-production-rollout-kid-facing/21-DECISIONS.md`
- FOUND: `.planning/phases/21-image-search-production-rollout-kid-facing/21-04-CONFIG-PATH-CHECK.md`
- FOUND: `scripts/regrant-kids-image-search-acl.ts`

**Commits verified in `git log`:**
- FOUND: `b0937fb` — test(21-04): add failing tests for image-search blocklist alignment
- FOUND: `0bf028f` — feat(21-04): extend IMAGE_PROMPT_PATTERNS with blocklist-aligned categories
- FOUND: `b40954b` — feat(21-04): preset badge on /conversations list + detail (OVERSIGHT-02)
- FOUND: `92c6606` — docs(21-04): D-21-A supersedes D-10 — dev Gist anointed as production
- FOUND: `f41a0ea` — feat(21-04): ACL re-grant script for Penelope + Sebastian — GO-LIVE flip

---
*Phase: 21-image-search-production-rollout-kid-facing*
*Plan: 04*
*Completed: 2026-04-21*
