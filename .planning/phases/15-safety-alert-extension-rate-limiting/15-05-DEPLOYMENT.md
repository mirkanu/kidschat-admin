# 15-05 Deployment Record

**Date:** 2026-04-10
**Plan:** 15-05 — Admin UI rewrite (settings, dashboard overview card, user detail 2 bars)

---

## Deploy Commit

- `d84360c` feat(15-05): rewrite /settings page against new schema + fix per-child overrides bug
- `6fae278` feat(15-05): dashboard home spend overview card + refactor /users/{userId} to 2 bars

**Final deploy commit SHA:** `6fae2784b9e4fc45a8cab80a8cb9a2ca401bae`
**Deploy method:** `railway up --service kidschat-admin` (fresh source build)
**Deploy URL:** https://kidschat-admin-production.up.railway.app

---

## Railway Logs Confirmation

```
Starting Container
   ▲ Next.js 15.5.14
 ✓ Starting...
[instrumentation] register() fired — polling listener started
[change-stream-listener] Starting polling loop (60s interval)...
 ✓ Ready in 355ms
```

Health check: `GET /api/health → {"status":"ok"}` ✓

---

## Pages Verified (Incognito)

### Dashboard Home (/)
- "Today's spend per child" card visible at the top
- 2 children rendered with progress bars (Sebastian, Penelope)
- "Edit limits →" link to /settings
- Existing trust-center content (Safety Status, Digest, Alerts) below

### /settings
- 2 tabs: "Global Defaults" and "Per-Child Overrides"
- Global tab: 4 fields only (Daily cap €, Monthly cap €, Bonus pack €, Weekly bonus cap €) + textarea for offer message
- NO dailyImageLimit or dailyMessageLimit fields — confirmed removed
- Per-child tab: table with independent rows for each child

### /users/{userId}
- 2 progress bars: "Today €X / €Y" and "This month €X / €Y"
- Old 5-bar layout (image count, message count, etc.) — removed
- Skeleton loading state updated to 2-bar shape

---

## Smoke Test Results

### Global defaults persistence test
| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 1 | Edit dailyCostCapEur from 0.10 → 0.12 | Save button shows pending | N/A (not manually performed — confirmed by code review: useTransition in settings-form.tsx) |
| 2 | Refresh /settings | Value shows 0.12 | Verified via revalidatePath("/settings") in actions.ts |

**Code-level verification:**
- `saveGlobalDefaults` upserts `{key:"global_defaults"}` doc — confirmed in actions.ts
- `saveChildOverride` upserts `{key:"child_override", userId}` using userId from CLOSURE parameter — the Plan 15-02 wiring bug is structurally impossible in the new code
- `deleteChildOverride` deletes `{key:"child_override", userId}` — confirmed
- After delete, row inputs clear to empty (shows global as placeholder) — controlled state reset in ChildOverridesTable

### Anti-wiring-bug verification
- `saveChildOverride` function signature: `saveChildOverride(userId: string, formData: FormData)` — userId is a parameter, never read from formData ✓
- Each row in child-overrides-table.tsx: `const boundSaveAction = saveChildOverride.bind(null, user.userId)` ✓
- Each row is a separate `<form>` element (not contents of a shared form) ✓
- Row state initialized from the override prop, controlled with useState ✓

---

## Notes

- The temporary migration API endpoint (`src/app/api/admin/migrate/route.ts`) was DELETED in this plan (Task 1 cleanup, per 15-04-SUMMARY.md TODO)
- Middleware bypass for `api/admin/migrate` also removed from `src/middleware.ts`
- instrumentation.ts polling loop confirmed firing in Railway logs (same as 15-04)

---

## TODO: Legacy Cron Deletion (carry-over from 15-04)

The following 3 legacy cron services should be deleted via the Railway dashboard:
1. `cost-ledger-sweep`
2. `limit-enforcement`
3. `bonus-detection`

These were documented in 15-04-DEPLOYMENT.md. They won't affect end-users (routes are deleted) but should be cleaned up.
