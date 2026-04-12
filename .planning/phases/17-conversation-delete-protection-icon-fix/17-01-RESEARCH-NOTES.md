# Phase 17-01 Research Notes — LibreChat Delete Mechanism + Icon Fix

Generated: 2026-04-11T23:00:00Z

---

## 1. LibreChat Delete Endpoint (v0.8.4)

**File:** `api/server/routes/convos.js`
**Method:** `DELETE /api/convos`
**Payload:** `{ arg: { conversationId, source, thread_id, endpoint } }`

The handler calls `deleteConvos(req.user.id, filter)` from `api/models/Conversation.js`.

**Behavior of `deleteConvos`:**
```js
deleteConvos: async (user, filter) => {
  const userFilter = { ...filter, user };
  const conversations = await Conversation.find(userFilter).select('conversationId');
  const conversationIds = conversations.map((c) => c.conversationId);
  const deleteConvoResult = await Conversation.deleteMany(userFilter);
  const deleteMessagesResult = await deleteMessages({
    conversationId: { $in: conversationIds },
    user,
  });
  return { ...deleteConvoResult, messages: deleteMessagesResult };
}
```

**Conclusion:** LibreChat **hard-deletes** both the `conversations` document AND all associated `messages` documents **atomically** in a single call. There is no soft-delete flag, no recycle bin, no archive path. A single sidebar delete action wipes both collections permanently.

There is also a `DELETE /api/convos/all` endpoint that deletes ALL conversations for the user.

---

## 2. Message Deletion Behavior

Messages **are** deleted with conversations — not left as orphans. The `deleteMessages` call uses `{ conversationId: { $in: [...] }, user }` as the filter, removing all messages for the deleted conversation in the same operation. The archive cron must therefore snapshot messages **before** they are deleted, not after.

---

## 3. New Config Toggle in Latest Main Branch

Search of `packages/data-provider/src/config.ts` (main branch, April 2026) found **no** delete-related toggle:
- No `interface.deleteConversations`
- No `permissions.USER.conversations.delete`
- No `features.conversationDelete`

This matches Phase 16-01 audit findings. The limitation remains in the latest codebase.

---

## 4. `customCSS` Availability

Search of `packages/data-provider/src/config.ts` found **no** `customCSS` key in the interface schema. The interface schema has `customWelcome` (string) and `customFooter` (string) but no CSS injection capability.

**Conclusion:** CSS-based delete button hiding is NOT available. Do NOT add `customCSS` to the Gist config — it will cause a ZodError on LibreChat startup (same risk as Phase 2-03 lesson).

---

## 5. Railway MongoDB Change Streams

Per STATE.md decision recorded in Phase 15: Railway MongoDB is standalone (error 40573). Change streams are NOT supported. This finding is trusted from Phase 15 and not retested (testing would require mongodb access from outside Railway, which is not available externally per Phase 15 notes).

---

## 6. Icon Color Fix Strategy

**Problem:** `https://unpkg.com/lucide-static@latest/icons/*.svg` serves raw SVGs with `stroke="currentColor"`. On LibreChat's dark sidebar, `currentColor` inherits from the text color of the container — which appears black or very dark, making icons invisible.

**Iconify API (Option 4):** `https://api.iconify.design/lucide/{name}.svg?color=%23e2e8f0` returns a valid SVG with the exact color baked in as `stroke="#e2e8f0"` (Tailwind slate-200, a light gray that reads clearly on dark backgrounds). Tested all 4 icons — all return HTTP 200 with correct colored SVG content.

**Decision:** Use Iconify API URLs with `color=%23e2e8f0` (slate-200 / #e2e8f0). No Gist uploads needed. Simple URL swap.

---

## 7. Chosen Approach

### Part A — Conversation Delete Protection

**Approach D: Periodic Snapshot Cron** (mandatory, best available)

- Every 5 minutes, a cron endpoint reads ALL documents from `conversations` and `messages` collections.
- Upserts each into `archived_conversations` and `archived_messages` using `_id` as upsert key.
- These archive collections are append-only — nothing is ever deleted from them.
- A conversation deleted by Sebastian will persist in `archived_conversations` + `archived_messages`.
- Data loss window: at most 5 minutes (conversation created AND deleted within one cron interval).
- Acceptable for a family safety app.

**Approach F: CSS hide** — NOT AVAILABLE (no `customCSS` in schema).

**Admin dashboard update (MANDATORY per plan checker):**
- `src/app/(dashboard)/conversations/page.tsx` must be updated to query BOTH `conversations` AND `archived_conversations`, merging results and deduplicating by `conversationId`.
- Deleted conversations show with a "[Deleted by child]" badge.
- `src/app/(dashboard)/conversations/[conversationId]/page.tsx` must fall back to `archived_conversations` if the live `conversations` collection returns null.
- Messages page falls back to `archived_messages`.

### Part B — Icon Fix

**Approach:** Swap `iconURL` in the Gist config from unpkg lucide-static URLs to Iconify API URLs with `?color=%23e2e8f0`.

New URLs:
- graduation-cap: `https://api.iconify.design/lucide/graduation-cap.svg?color=%23e2e8f0`
- smile: `https://api.iconify.design/lucide/smile.svg?color=%23e2e8f0`
- scale-3d: `https://api.iconify.design/lucide/scale-3d.svg?color=%23e2e8f0`
- briefcase: `https://api.iconify.design/lucide/briefcase.svg?color=%23e2e8f0`

---

## 8. Task 2 Implementation Plan

1. Create `src/lib/archive-conversations.ts` — archive function
2. Create `src/app/api/cron/archive-deleted/route.ts` — cron endpoint
3. Update `railway.toml` — add `*/5 * * * *` cron entry
4. Update `src/app/(dashboard)/conversations/page.tsx` — query from both live + archived collections
5. Update `src/app/(dashboard)/conversations/[conversationId]/page.tsx` — fallback to archived collections
6. Snapshot live Gist → `17-01-LIVE-CONFIG-PRE.yaml`
7. Patch Gist — swap icon URLs to Iconify with color param
8. Update `CONFIG_PATH` on Railway LibreChat service
9. Redeploy both Railway services
10. Verify archive endpoint, LibreChat config loads, logs clean
