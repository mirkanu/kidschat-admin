# Phase 15: Safety Alert Extension & Rate Limiting — Research

**Researched:** 2026-04-07 (replaced 2026-04-07 draft — full rewrite post-CONTEXT.md decisions)
**Domain:** LibreChat internals, MongoDB enforcement, Railway constraints, bonus purchase flow
**Confidence:** HIGH overall (key architectural questions resolved with official sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- New alert type `"image_prompt"` added to `SafetyEvent.type` union — distinct from `jailbreak_attempt`
- New `IMAGE_PROMPT_PATTERNS` array in `safety-patterns.ts`, matched against user messages (`isCreatedByUser=true`)
- Email pipeline: existing `notify-safety-alert.ts` unchanged; new type triggers subject "Image abuse attempt detected"
- Dedup: 1-hour window on `meta.conversationId + meta.matchedPattern` (same as existing)
- Three per-child limits: daily image count (default 10), daily message count, monthly cost cap (EUR)
- Daily limits reset midnight UTC; monthly cap resets 1st of month UTC
- Monthly cost cap tracks EVERYTHING: Haiku input + output + agent thinking tokens + DALL-E ($0.04/image)
- New MongoDB collections: `settings`, `bonus_purchases`, `cost_ledger` (and LibreChat's `balance` collection used for enforcement)
- 4 Phase 14 agent IDs: agent_wxgt6su7d3pcosiil3, agent_y4w1cvoyg77p9thed9, agent_64q6z5s57552cpgl0hr, agent_aiv99mzvdzquym6y89k
- Enforcement mechanism: researcher recommends (see prescribed approach below)
- Monthly cost cap enforcement: hard-lock all agent responses for over-limit child
- Daily reset cron at midnight UTC; monthly reset cron on 1st UTC
- Bonus purchase: child types "YES" (or confirmation keyword); admin dashboard detects via MongoDB message watcher; bonus applied immediately
- Bonus pack default €2, freely spendable across images and text, expires midnight UTC if not used
- Bonus does NOT count against monthly cost cap
- Weekly bonus cap (default Claude's Discretion — €5/week/child) resets Monday UTC
- Hard-lock = monthly cost cap AND weekly bonus cap both exhausted
- Admin-editable bonus message template stored in MongoDB `settings` collection
- NO immediate email per purchase; extend Phase 13 weekly digest to include bonus totals
- Extend Phase 10 cost tracking to real-time per-child ledger
- Per-message cost records in `cost_ledger` collection; per-child monthly total queryable in <100ms
- Test mode (Phase 9) bypasses LibreChat — rate limits do NOT apply to test mode

### Claude's Discretion

- Default values: daily message limit, monthly cost cap (EUR), weekly bonus cap, cron frequency
- Exact MongoDB schemas for `settings`, `bonus_purchases`, `cost_ledger`
- Settings page UI layout and form component choices
- Default text for admin-editable bonus purchase message
- Cron enforcement sweep frequency

### Deferred Ideas (OUT OF SCOPE)

- Per-session bonus caps
- Parent pre-approval flow
- Real-time parent notifications per purchase
- Refund/reversal UI
- Slack/SMS alerts
- Child-facing usage widget in LibreChat
- Tiered bonus packs
- Pre-approved monthly spending allowance separate from the cap
</user_constraints>

---

## Summary

Phase 15 has four tightly-coupled tracks that share the same MongoDB database and admin dashboard codebase. All key architectural unknowns from the original research are now resolved.

**Track A — Safety alert extension.** Straightforward extension of `safety-patterns.ts`. Add `IMAGE_PROMPT_PATTERNS` array and add `"image_prompt"` to the `SafetyEvent.type` union. The existing `notifySafetyAlert()` pipeline handles everything else with a conditional subject line for the new type.

**Track B — Cost ledger and rate limit infrastructure.** The monthly cost cap depends on real-time per-child cost data. A polling cron (every 2-5 minutes) reads new messages from LibreChat's `messages` collection, calculates cost per message using token counts, and writes to a new `cost_ledger` collection. Railway's MongoDB is a standalone instance without replica set — MongoDB change streams are NOT available. Polling is the only viable approach.

**Track C — Enforcement.** Two distinct enforcement mechanisms cover image-only lock vs. full lock. Image limit: remove/restore the child's viewer ACL entry from LibreChat's `aclentries` collection (confirmed to block backend API calls and hide the modelSpec preset from the UI). Monthly cap: write `tokenCredits: 0` to LibreChat's `balance` collection (blocks all API requests at the LibreChat layer). Both are reversible via cron.

**Track D — Bonus purchase flow.** When the child hits a limit, the enforcement cron inserts a system message into LibreChat's `messages` collection with the admin-editable bonus offer text. A separate polling cron (every 30 seconds) watches for a "YES" response from the child. On detection, it inserts a `bonus_purchases` record and either restores the ACL entry or adds credits to the `balance` collection.

**Primary recommendation:** Build as one phase split into two plans. P01: safety patterns + cost ledger foundation + settings collection schema + cron infrastructure. P02: enforcement implementation + bonus flow + admin UI pages.

---

## Standard Stack

### Core (all existing — no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongodb (Node driver) | existing | All new collections + LibreChat `balance`/`aclentries` writes | Already wired in `src/lib/mongodb.ts` |
| Next.js API routes | existing | Enforcement cron endpoints, bonus detection endpoint | Consistent with project pattern |
| Resend | existing | Weekly digest extension for bonus totals | Phase 13 pipeline |
| shadcn/ui | existing | Settings page, user detail page enhancements | Project component library |
| Railway cron | existing | Enforcement sweep, daily reset, monthly reset | Phase 13 already uses Railway cron |

### No new npm packages required.

```bash
# No new packages — phase uses existing stack only
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── safety-patterns.ts           # Add IMAGE_PROMPT_PATTERNS + "image_prompt" type
│   ├── notify-safety-alert.ts       # Update subject line for new type; no signature change
│   ├── cost-ledger.ts               # NEW: per-message cost write + monthly total query
│   ├── rate-limits.ts               # NEW: limit check + enforcement actions
│   ├── bonus-purchases.ts           # NEW: bonus detection + credit application
│   └── weekly-digest.ts             # EXTEND: add bonusPurchasesThisWeek to WeeklyChildStats
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   ├── cost-ledger-sweep/route.ts    # NEW: every 2-5 min, costs from messages
│   │   │   ├── limit-enforcement/route.ts    # NEW: every 2-5 min, enforce limits
│   │   │   ├── bonus-detection/route.ts      # NEW: every 30 sec, detect YES responses
│   │   │   ├── daily-reset/route.ts          # NEW: midnight UTC, restore daily limits
│   │   │   └── monthly-reset/route.ts        # NEW: 1st UTC, restore monthly limits
│   │   └── notify/
│   │       └── weekly-digest/route.ts        # EXTEND: add bonus totals to digest
│   └── (dashboard)/
│       ├── settings/page.tsx                 # NEW: global defaults + per-child overrides
│       └── users/[userId]/page.tsx           # EXTEND: daily counts + monthly spend + bonus
```

### Pattern 1: Safety Pattern Extension

**What:** Add `"image_prompt"` to `SafetyEvent.type`, add `IMAGE_PROMPT_PATTERNS` array, update `detectSafetyEvent()` to also check image patterns for user messages.

**IMPORTANT:** The current `detectSafetyEvent()` is boolean-dispatch: user messages → jailbreak patterns, AI messages → redirect patterns. Image prompt patterns only apply to user messages (`isCreatedByUser=true`). The return type must include the new `"image_prompt"` type.

```typescript
// src/lib/safety-patterns.ts — extend existing

export interface SafetyEvent {
  type: "safety_redirect" | "jailbreak_attempt" | "image_prompt";  // ADD "image_prompt"
  // ... rest unchanged
}

const IMAGE_PROMPT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Violence / gore
  { pattern: /\b(draw|generate|create|make)\b.{0,30}\b(blood|gore|guts|decapitat|dead body|corpse)\b/i, label: "Image: violent/gore request" },
  { pattern: /\b(draw|generate|picture|image)\b.{0,20}\b(kill|murder|violence)\b/i, label: "Image: violent content request" },

  // Nudity / immodest
  { pattern: /\b(draw|generate|create|make|show)\b.{0,30}\b(naked|nude|topless|without clothes|undressed)\b/i, label: "Image: nudity request" },
  { pattern: /\b(draw|generate|create)\b.{0,20}\b(sexy|seductive|provocative)\b/i, label: "Image: immodest content request" },

  // Horror / scary / demonic
  { pattern: /\b(draw|generate|create)\b.{0,20}\b(horror|terrifying|demonic|satanic|evil demon)\b/i, label: "Image: horror/demonic request" },
  { pattern: /\b(draw|generate|picture|image)\b.{0,20}\b(monster|demon|devil)\b.{0,20}\battack/i, label: "Image: horror request" },

  // Real named people (requires context — "a picture of" + public figure)
  { pattern: /\b(draw|generate|create|picture|photo)\b.{0,20}\bof\b.{0,30}\b(president|trump|biden|obama|putin|celebrity)\b/i, label: "Image: real person request" },
  { pattern: /realistic\s+(photo|picture|portrait)\s+of\s+\w+/i, label: "Image: realistic person request" },

  // Bypass attempts
  { pattern: /draw.{0,30}but.{0,20}(look like|appears?|seems?).{0,30}(safe|allowed|innocent)/i, label: "Image: bypass attempt via safe framing" },
  { pattern: /pretend.{0,20}(you can|allowed to|no rules).{0,20}(draw|generate|create)/i, label: "Image: bypass attempt via pretend" },
  { pattern: /as\s+(a\s+)?cartoon\s+(so|but).{0,20}\b(blood|nude|naked|scary)\b/i, label: "Image: bypass via cartoon framing" },
  { pattern: /for\s+(a\s+)?(movie|book|story|game)\s+(so|but).{0,20}\b(blood|nude|naked|scary)\b/i, label: "Image: bypass via fiction framing" },
  { pattern: /image\s+(with|but)\s+rules?\s+(off|disabled|removed|turned off)/i, label: "Image: bypass via rules-off framing" },
];

// Update detectSafetyEvent to also check image patterns for user messages
export function detectSafetyEvent(
  text: string,
  isCreatedByUser: boolean
): {
  detected: boolean;
  type: SafetyEvent["type"] | null;
  matchedPattern: string | null;
} {
  // Existing logic unchanged for jailbreak and redirect patterns...
  const patterns = isCreatedByUser ? JAILBREAK_PATTERNS : SAFETY_REDIRECT_PATTERNS;
  const eventType: SafetyEvent["type"] = isCreatedByUser ? "jailbreak_attempt" : "safety_redirect";

  for (const { pattern, label } of patterns) {
    if (pattern.test(text)) {
      return { detected: true, type: eventType, matchedPattern: label };
    }
  }

  // NEW: also scan image patterns for user messages
  if (isCreatedByUser) {
    for (const { pattern, label } of IMAGE_PROMPT_PATTERNS) {
      if (pattern.test(text)) {
        return { detected: true, type: "image_prompt", matchedPattern: label };
      }
    }
  }

  return { detected: false, type: null, matchedPattern: null };
}
```

**Update `notify-safety-alert.ts` subject line:**

```typescript
// Only the subject line changes — function signature and logic unchanged
const subject =
  alertType === "image_prompt"
    ? `Image Alert: Inappropriate image request detected for ${childName}`
    : alertType === "jailbreak_attempt"
    ? `Safety Alert: Jailbreak Attempt detected for ${childName}`
    : `Safety Alert: Safety Redirect detected for ${childName}`;
```

**Update `NotifySafetyAlertInput.alertType`:**

```typescript
export interface NotifySafetyAlertInput {
  alertType: "safety_redirect" | "jailbreak_attempt" | "image_prompt";  // add new type
  // ... rest unchanged
}
```

### Pattern 2: MongoDB Collection Schemas

**`settings` collection — global defaults + per-child overrides:**

```typescript
// Global defaults document (singleton, _id: "global_defaults")
{
  _id: "global_defaults",
  dailyImageLimit: 10,
  dailyMessageLimit: 50,        // Claude's Discretion: 50 messages/day
  monthlyCostCapEUR: 10.00,     // Claude's Discretion: €10/month/child
  weeklyBonusCap: 5.00,         // Claude's Discretion: €5/week/child
  bonusPackSize: 2.00,          // €2 per bonus pack
  bonusMessageTemplate: "You've reached your limit today. Would you like to unlock €2 of extra usage? This will come off your GoHenry. Type YES to confirm.",
  updatedAt: Date
}

// Per-child override document (keyed by LibreChat userId string)
{
  _id: "override_{userId}",
  userId: "string",             // LibreChat user ObjectId as string
  dailyImageLimit?: number,     // null = use global default
  dailyMessageLimit?: number,
  monthlyCostCapEUR?: number,
  weeklyBonusCap?: number,
  bonusPackSize?: number,
  bonusMessageTemplate?: string,
  updatedAt: Date
}
```

**`cost_ledger` collection — per-message cost records:**

```typescript
{
  _id: ObjectId,
  userId: string,               // LibreChat user._id as string
  messageId: string,            // LibreChat message._id as string (unique key for dedup)
  conversationId: string,
  model: string,                // e.g. "claude-haiku-4-5"
  inputTokens: number,          // from message.tokenCount.input (if present) or char-formula estimate
  outputTokens: number,
  imageCount: number,           // 0 or 1 (DALL-E call detected in this message pair)
  costUSD: number,              // calculated: (inputTokens * 0.000001 + outputTokens * 0.000005) + imageCount * 0.04
  costEUR: number,              // costUSD * EUR_RATE (env var, default 0.92)
  recordedAt: Date,
  source: "poll"                // always "poll" (change streams not available)
}

// Index: { userId: 1, recordedAt: 1 } for monthly aggregation
// Index: { messageId: 1 }, unique, for dedup
```

**`bonus_purchases` collection:**

```typescript
{
  _id: ObjectId,
  userId: string,
  childName: string,
  packSizeEUR: number,          // snapshot of pack size at purchase time
  purchasedAt: Date,
  confirmedViaMessageId: string, // the "YES" message _id that triggered the purchase
  expiresAt: Date,              // purchasedAt date at midnight UTC
  creditRemainingEUR: number,   // decremented as usage is tracked (initially = packSizeEUR)
  weekOf: string,               // ISO date of Monday of purchase week, for weekly cap queries
}
```

### Pattern 3: Image Count Source of Truth

**Use the `files` collection with `context: "image_generation"` filter.**

Confirmed from LibreChat's `FileContext` TypeScript enum (packages/data-provider/src/types/files.ts):

```typescript
// FileContext enum values include: "image_generation" for DALL-E generated files
// TFile interface includes: { user: string, context: FileContext, source: FileSources, createdAt: Date }

// Count images generated by a specific child today:
async function getImageCountToday(userId: string, db: Db): Promise<number> {
  const startOfDayUTC = new Date();
  startOfDayUTC.setUTCHours(0, 0, 0, 0);

  return db.collection("files").countDocuments({
    user: userId,                    // confirmed field name from TFile interface
    context: "image_generation",     // confirmed from FileContext enum
    createdAt: { $gte: startOfDayUTC },
  });
}

// Batch query for all children (admin users page):
async function getAllChildImageCounts(db: Db): Promise<Map<string, number>> {
  const startOfDayUTC = new Date();
  startOfDayUTC.setUTCHours(0, 0, 0, 0);

  const rows = await db.collection("files").aggregate([
    { $match: { context: "image_generation", createdAt: { $gte: startOfDayUTC } } },
    { $group: { _id: "$user", count: { $sum: 1 } } }
  ]).toArray();

  return new Map(rows.map(r => [String(r._id), r.count as number]));
}
```

### Pattern 4: Enforcement Mechanism — PRESCRIBED APPROACH

**Two-tier enforcement, both via direct MongoDB write from the admin dashboard cron:**

#### Tier 1: Image-only lock (daily image cap reached, no active bonus)

Remove the child's viewer ACL entry from LibreChat's `aclentries` collection for all 4 drawing agents. This is confirmed to:
1. Block backend API calls (LibreChat enforces `PermissionBits.VIEW` on the agent endpoint before executing)
2. Hide the modelSpec preset from the child's UI (confirmed via PR #9433 which filtered modelSpecs by `agentsMap`)

```typescript
// Lock: remove viewer ACL entries for this child across all 4 agents
const DRAWING_AGENT_IDS = [
  "agent_wxgt6su7d3pcosiil3",
  "agent_y4w1cvoyg77p9thed9",
  "agent_64q6z5s57552cpgl0hr",
  "agent_aiv99mzvdzquym6y89k",
];

async function lockImageAccess(userId: string, db: Db): Promise<void> {
  // Store the removed entries so we can restore them on reset
  const removed = await db.collection("aclentries").find({
    user: userId,
    resource: { $in: DRAWING_AGENT_IDS },
  }).toArray();

  if (removed.length > 0) {
    // Snapshot to locked_acl_entries for restore on reset
    await db.collection("locked_acl_entries").insertMany(
      removed.map(e => ({ ...e, lockedAt: new Date(), lockReason: "daily_image_cap" }))
    );
    await db.collection("aclentries").deleteMany({
      user: userId,
      resource: { $in: DRAWING_AGENT_IDS },
    });
  }
}

async function unlockImageAccess(userId: string, db: Db): Promise<void> {
  const stored = await db.collection("locked_acl_entries").find({
    user: userId,
    lockReason: "daily_image_cap",
  }).toArray();

  if (stored.length > 0) {
    const toRestore = stored.map(({ lockedAt, lockReason, ...entry }) => entry);
    await db.collection("aclentries").insertMany(toRestore, { ordered: false });
    await db.collection("locked_acl_entries").deleteMany({
      user: userId,
      lockReason: "daily_image_cap",
    });
  }
}
```

**Why not the alternatives:**
- Per-child agent clones (4 agents × 2 kids = 8 agents): Manageable but creates maintenance burden — any agent instruction update must be replicated. ACL manipulation is cleaner.
- Dynamic instructions injection (write to `agents.instructions` field): LibreChat does NOT cache agent instructions at startup — it reads from MongoDB per request. Instructions COULD be updated. However, modifying shared agent instructions affects ALL users, not just the locked child. Not viable for per-child control.
- System prompt rate limit instruction: LLM compliance is unreliable; not a hard block.

#### Tier 2: Full lock (monthly cost cap + weekly bonus cap both exhausted)

Write `tokenCredits: 0` to LibreChat's `balance` collection. LibreChat's built-in balance system validates prompt token cost before processing ANY request and blocks with an error when `tokenCredits <= 0`.

```typescript
async function hardLockAllAccess(userId: string, db: Db): Promise<void> {
  // LibreChat balance collection stores tokenCredits per user
  // 1000 tokenCredits = $0.001 USD
  await db.collection("balance").updateOne(
    { user: userId },
    { $set: { tokenCredits: 0 } },
    { upsert: true }
  );
  // Also lock image access (belt-and-suspenders)
  await lockImageAccess(userId, db);
}

async function unlockAllAccess(userId: string, db: Db, credits: number): Promise<void> {
  // Restore a positive balance (e.g. restoring monthly allowance equivalent)
  // tokenCredits = months_remaining_budget_USD * 1_000_000 (1M credits = $1)
  await db.collection("balance").updateOne(
    { user: userId },
    { $set: { tokenCredits: credits } },
    { upsert: true }
  );
  await unlockImageAccess(userId, db);
}
```

**CRITICAL PREREQUISITE:** The balance system must be enabled in LibreChat for token blocking to work. Add to `librechat.yaml`:

```yaml
balance:
  enabled: true
  startBalance: 1000000  # 1M credits = $1 initial balance (will be managed by our cron)
  # No autoRefill — our cron manages refills based on the monthly cap
```

**Disable for test mode:** The test mode uses direct Anthropic API calls, not LibreChat — so balance enforcement never fires on test mode conversations. No special handling needed.

### Pattern 5: Cost Ledger Ingestion (Polling, Not Change Streams)

**Railway MongoDB is standalone — change streams are NOT available.** This is confirmed from the Railway MongoDB start command (`mongod --ipv6 --bind_ip ::,0.0.0.0` — no `--replSet` flag) and from Railway Help Station discussions.

**Prescribed approach: polling cron every 2 minutes.**

The cron reads messages created since the last poll timestamp (stored in a `cron_state` collection), calculates cost, and inserts into `cost_ledger` with dedup on `messageId`.

```typescript
// src/app/api/cron/cost-ledger-sweep/route.ts
// Called every 2 minutes via Railway cron schedule

export async function POST(req: NextRequest) {
  // Auth: cron secret header
  const client = await getMongoClient();
  const db = client.db("test");

  // Read last poll timestamp from cron_state
  const state = await db.collection("cron_state").findOne({ _id: "cost_ledger_sweep" });
  const lastPoll = state?.lastPoll ?? new Date(Date.now() - 5 * 60 * 1000); // default: 5 min ago

  // Fetch new AI response messages (not user messages — these have the actual output tokens)
  // Filter non-ADMIN users via conversation lookup (same as Phase 10)
  const newMessages = await db.collection("messages").aggregate([
    {
      $match: {
        createdAt: { $gt: lastPoll },
        isCreatedByUser: false,  // AI responses only (have output)
      }
    },
    // Lookup conversation to get userId, then user to get role
    { $lookup: { from: "conversations", localField: "conversationId", foreignField: "conversationId", as: "conv" } },
    { $unwind: { path: "$conv", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "users", let: { uid: "$conv.user" }, pipeline: [{ $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$uid"] } } }], as: "userInfo" } },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
    { $match: { "userInfo.role": { $ne: "ADMIN" } } },
  ]).toArray();

  const EUR_RATE = parseFloat(process.env.USD_TO_EUR_RATE ?? "0.92");
  const ledgerInserts = [];

  for (const msg of newMessages) {
    // Dedup check
    const exists = await db.collection("cost_ledger").findOne({ messageId: String(msg._id) });
    if (exists) continue;

    // Token counts: use msg.tokenCount if present, else char-formula estimate
    const inputTokens = msg.tokenCount?.input ?? estimateInputTokens(msg);
    const outputTokens = msg.tokenCount?.output ?? estimateOutputTokens(msg);

    // Check for image in this message (via files collection)
    const imageCount = await db.collection("files").countDocuments({
      conversationId: msg.conversationId,
      context: "image_generation",
      createdAt: { $gte: new Date(msg.createdAt.getTime() - 30_000), $lte: new Date(msg.createdAt.getTime() + 30_000) }
    });

    const costUSD = (inputTokens * 0.000001 + outputTokens * 0.000005) + imageCount * 0.04;

    ledgerInserts.push({
      userId: String(msg.userInfo?._id ?? msg.conv?.user),
      messageId: String(msg._id),
      conversationId: msg.conversationId,
      model: msg.model ?? "claude-haiku-4-5",
      inputTokens,
      outputTokens,
      imageCount,
      costUSD,
      costEUR: costUSD * EUR_RATE,
      recordedAt: new Date(),
      source: "poll",
    });
  }

  if (ledgerInserts.length > 0) {
    await db.collection("cost_ledger").insertMany(ledgerInserts, { ordered: false });
  }

  // Update last poll timestamp
  await db.collection("cron_state").updateOne(
    { _id: "cost_ledger_sweep" },
    { $set: { lastPoll: new Date() } },
    { upsert: true }
  );

  return NextResponse.json({ processed: ledgerInserts.length });
}
```

**Per-child monthly total query (<100ms with index):**

```typescript
async function getMonthlySpendEUR(userId: string, db: Db): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const result = await db.collection("cost_ledger").aggregate([
    { $match: { userId, recordedAt: { $gte: startOfMonth } } },
    { $group: { _id: null, total: { $sum: "$costEUR" } } }
  ]).toArray();

  return result[0]?.total ?? 0;
}
// Required index: { userId: 1, recordedAt: 1 }
```

### Pattern 6: "YES" Detection for Bonus Confirmation

**Prescribed approach: 30-second polling cron.**

Railway MongoDB standalone eliminates change streams. The polling cron reads new user messages since the last poll and checks for a confirmation match.

```typescript
// src/app/api/cron/bonus-detection/route.ts
// Railway cron: every 30 seconds (Railway supports 30-second granularity)
// Alternatively: triggered at end of limit-enforcement cron

export async function POST(req: NextRequest) {
  const db = (await getMongoClient()).db("test");

  // Find children who are currently in "awaiting_bonus_confirmation" state
  const pendingConfirmations = await db.collection("settings").find({
    awaitingBonusConfirmation: true
  }).toArray();

  for (const pending of pendingConfirmations) {
    const { userId, confirmationOfferedAt } = pending;

    // 5-minute window for child to type YES
    const expiresAt = new Date(confirmationOfferedAt.getTime() + 5 * 60 * 1000);
    if (new Date() > expiresAt) {
      // Expired — clear pending state
      await db.collection("settings").updateOne(
        { _id: pending._id },
        { $unset: { awaitingBonusConfirmation: "", confirmationOfferedAt: "" } }
      );
      continue;
    }

    // Look for a "YES" message from this child after the offer was sent
    const confirmationMsg = await db.collection("messages").findOne({
      // User messages from this child since the offer
      isCreatedByUser: true,
      createdAt: { $gt: confirmationOfferedAt },
      // Match their userId via conversation lookup (or store convId in pending state)
      conversationId: pending.activeConversationId,
      $expr: {
        $regexMatch: {
          input: { $toLower: "$text" },
          regex: /^yes$|^yes\.?$/  // exactly "YES" or "yes" or "yes."
        }
      }
    });

    if (confirmationMsg) {
      await applyBonusCredit(userId, pending, db);
    }
  }
}
```

**Simpler alternative for YES detection (no conversation tracking needed):**

Since we know the child's userId, query for any user message from a conversation owned by that user that contains exactly "yes" after the offer time. The 5-minute expiry prevents false positives from old conversations.

### Pattern 7: Bonus Credit Application

When "YES" detected:

```typescript
async function applyBonusCredit(userId: string, pending: PendingState, db: Db): Promise<void> {
  const settings = await getEffectiveLimits(userId, db);
  const packSizeEUR = settings.bonusPackSize;

  // Record the purchase
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(23, 59, 59, 999); // expires end of today UTC

  const monday = getStartOfWeekUTC(now);

  await db.collection("bonus_purchases").insertOne({
    userId,
    childName: pending.childName,
    packSizeEUR,
    purchasedAt: now,
    confirmedViaMessageId: pending.confirmationMsgId ?? "unknown",
    expiresAt: midnight,
    creditRemainingEUR: packSizeEUR,
    weekOf: monday.toISOString().split("T")[0],
  });

  // Restore access: re-insert ACL entries or add balance credits
  if (pending.lockType === "image_cap") {
    await unlockImageAccess(userId, db);
  } else if (pending.lockType === "monthly_cap") {
    // Add EUR-equivalent credits to LibreChat balance
    // 1M tokenCredits = $1.00 ≈ €1.09; packSizeEUR / EUR_RATE * 1_000_000
    const EUR_RATE = parseFloat(process.env.USD_TO_EUR_RATE ?? "0.92");
    const creditsToAdd = Math.floor((packSizeEUR / EUR_RATE) * 1_000_000);
    await db.collection("balance").updateOne(
      { user: userId },
      { $inc: { tokenCredits: creditsToAdd } },
      { upsert: true }
    );
  }

  // Clear pending confirmation state
  await db.collection("settings").updateOne(
    { _id: `override_${userId}` },
    { $unset: { awaitingBonusConfirmation: "", confirmationOfferedAt: "", activeConversationId: "" } }
  );
}
```

### Pattern 8: Admin-Editable Bonus Message Delivery

**Stored in:** MongoDB `settings` collection, `_id: "global_defaults"`, field `bonusMessageTemplate`.

**How the child sees it:** The enforcement cron inserts a message directly into LibreChat's `messages` collection when the child hits a limit. LibreChat renders all messages in its collection, so this creates a seamless in-chat notification without forking LibreChat.

```typescript
// Insert a synthetic AI message from the agent into LibreChat's messages collection
async function sendBonusOfferMessage(
  userId: string,
  conversationId: string,
  agentId: string,
  template: string,
  db: Db
): Promise<string> {
  const msgId = new ObjectId();
  await db.collection("messages").insertOne({
    _id: msgId,
    messageId: msgId.toHexString(),
    conversationId,
    parentMessageId: null,
    isCreatedByUser: false,
    endpoint: "agents",
    agent_id: agentId,
    text: template,
    model: "claude-haiku-4-5",
    sender: "Agent",
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  });

  return msgId.toHexString();
}
```

**Why not env var or agent instructions:** Agent instructions are static per-agent and shared across all users. The template needs to be admin-editable without redeployment, and it needs to be delivered contextually (only when the limit is hit). MongoDB `settings` collection is the right place.

### Pattern 9: Weekly Digest Extension

Extend `WeeklyChildStats` in `src/lib/weekly-digest.ts` to include bonus purchase total:

```typescript
export interface WeeklyChildStats {
  name: string;
  totalMessages: number;
  activeDays: number;
  topPresets: string[];
  bonusPurchasesThisWeek: number;     // NEW: count of bonus purchases this week
  totalBonusSpendEUR: number;         // NEW: total EUR spent on bonuses this week
}
```

Add a `$lookup` from `bonus_purchases` in `getWeeklyChildStats()`, or run a separate aggregation and merge by child name.

### Anti-Patterns to Avoid

- **Don't modify shared agent `tools` array to disable DALL-E per user:** The `tools` array is shared across ALL users of that agent. Removing `"dalle"` from one agent affects all children. Use ACL entries instead.
- **Don't try to enable MongoDB change streams on Railway's default MongoDB:** Standalone instance, no oplog, will throw `$changeStream stage only supported on replica sets`. Use polling.
- **Don't use a Railway cron more frequent than 30 seconds:** Railway's minimum cron interval is 1 minute for Railway cron. For 30-second polling, call two staggered endpoints or accept 1-minute latency for bonus detection.
- **Don't insert bonus offer messages into `messages` without also updating `conversations.updatedAt`:** LibreChat may not display the new message until the conversation is refreshed; insert into `messages` and update the conversation's `updatedAt` to force a re-render.
- **Don't compute monthly cost totals by re-scanning `messages`:** Use the `cost_ledger` collection — that's what it's for. The `messages` scan is slow and imprecise.
- **Don't apply the monthly cap hard-lock without first offering a bonus:** The flow is: hit limit → offer bonus via chat → if no YES within 5 minutes OR weekly bonus cap also exhausted → apply hard-lock.
- **Don't check balance if `balance.enabled` is not set in `librechat.yaml`:** The balance system must be explicitly enabled or the `tokenCredits: 0` write has no effect.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending for image alerts | Custom emailer | Existing `notifySafetyAlert()` in `notify-safety-alert.ts` | Already has Resend + dedup + multi-recipient |
| Pattern matching engine | Custom regex runner | Add to existing `safety-patterns.ts` | `detectSafetyEvent()` already handles batching; alerts page scans automatically |
| Token-level request blocking | Custom LibreChat proxy or middleware | LibreChat `balance` collection write | LibreChat enforces balance natively; direct MongoDB write is sufficient |
| Weekly digest delivery | New cron job | Extend `src/app/api/notify/weekly-digest/route.ts` | Phase 13 infrastructure is ready |
| MongoDB connection | New client | `getMongoClient()` from `src/lib/mongodb.ts` | Connection pooling already managed |
| Date UTC math | Custom timezone handling | `setUTCHours(0,0,0,0)` + `setUTCDate(1)` | Project-established pattern |
| Image count query | Parsing message text for DALL-E markers | `files` collection with `context: "image_generation"` | Reliable schema field, per-user scoped |
| Cron auth | New auth system | `x-cron-secret` header pattern from Phase 13 | Established in project |

---

## Common Pitfalls

### Pitfall 1: Assuming Railway MongoDB Supports Change Streams

**What goes wrong:** Code attempting to open a change stream throws `MongoServerError: The $changeStream stage is only supported on replica sets`.
**Why it happens:** Railway's default MongoDB template deploys `mongod` without `--replSet`, making it a standalone instance.
**How to avoid:** Use polling exclusively. All cron endpoints poll with a `lastPoll` timestamp stored in a `cron_state` collection.
**Warning signs:** Any code with `collection.watch()` or `db.watch()`.

### Pitfall 2: `balance.enabled` Not Set Before Balance Enforcement

**What goes wrong:** Writing `tokenCredits: 0` to the `balance` collection has no effect — LibreChat ignores the balance collection entirely when `balance.enabled` is not `true` in `librechat.yaml`.
**Why it happens:** The balance system is opt-in. By default it's disabled.
**How to avoid:** Update `librechat.yaml` to set `balance: { enabled: true }` before implementing enforcement. Deploy and test that a zero-balance user is actually blocked.
**Warning signs:** Children can still chat after hard-lock is applied.

### Pitfall 3: ACL Removal Breaks Existing Conversations in Progress

**What goes wrong:** A child is mid-conversation when the ACL entry is removed. Their current conversation continues (LibreChat doesn't re-check ACL mid-conversation) but they cannot start a new conversation with the agent.
**Why it happens:** LibreChat checks ACL at conversation start, not on each message within an active conversation.
**How to avoid:** This is acceptable behavior — the limit kicks in on the NEXT conversation attempt. Document this known behavior.
**Warning signs:** Planning to enforce mid-conversation (don't).

### Pitfall 4: aclentries Restore Failing Due to Duplicate Key

**What goes wrong:** `unlockImageAccess` tries to re-insert ACL entries that were already restored by a previous run, throwing duplicate key errors.
**Why it happens:** The enforcement cron may run multiple times before the `locked_acl_entries` cleanup completes.
**How to avoid:** Use `insertMany` with `ordered: false` and ignore duplicate key errors (error code 11000). Also clear `locked_acl_entries` atomically after successful restore.
**Warning signs:** Cron error logs showing `E11000 duplicate key error`.

### Pitfall 5: Cost Ledger Drift Between Message Creation and Cost Sweep

**What goes wrong:** The 2-minute cost poll means monthly spend lags real usage by up to 2 minutes. A child could slightly exceed their cap before the ledger is updated.
**Why it happens:** Polling is not instantaneous.
**How to avoid:** Accept 2-5 minute enforcement lag as a known limitation. Document it. For a family of 2 children with a €10 cap, a 2-minute lag means at most ~€0.03 overage (1-2 messages). This is acceptable.
**Warning signs:** Parents asking why the child sent 3 messages after hitting the cap.

### Pitfall 6: Bonus Offer Message Not Rendering in LibreChat UI

**What goes wrong:** Admin dashboard inserts a message into `messages` collection but the child doesn't see it in LibreChat.
**Why it happens:** LibreChat's frontend polls or subscribes to message updates. A message inserted directly into MongoDB may not trigger the websocket event that refreshes the chat view.
**How to avoid:** When inserting the synthetic message, also update `conversations.updatedAt` for that conversation. If LibreChat uses polling (not websockets) for message refresh, the message will appear within the poll interval. Test this in Wave 0 before building the full bonus flow.
**Warning signs:** Admin can see the bonus offer message in the dashboard conversation view but child doesn't see it in LibreChat.

### Pitfall 7: Regex False Positives on Innocent Child Messages

**What goes wrong:** Pattern `\b(draw|generate)\b.{0,20}\b(monster)\b` matches "draw me a friendly monster from a cartoon" — flagged as horror request.
**Why it happens:** Children naturally use these words in innocent contexts.
**How to avoid:** Test all patterns against a corpus of innocent children's messages before deployment. Use tighter context requirements (e.g., require "attacking" or "scary" adjacent to "monster"). The alert goes to the admin for review, so false positives are annoying but not user-blocking.
**Warning signs:** Alert count spikes on days with innocent drawing activity.

### Pitfall 8: `balance` Collection Conflict with LibreChat's Own Auto-Refill

**What goes wrong:** Our cron sets `tokenCredits: 0` to block a child, but LibreChat's `autoRefill` fires and restores their balance automatically.
**Why it happens:** If `balance.autoRefillEnabled: true` is set in `librechat.yaml`, LibreChat will periodically add credits.
**How to avoid:** Set `autoRefillEnabled: false` in `librechat.yaml`. Our enforcement cron is the sole mechanism for managing balances. The monthly reset cron restores access on the 1st.
**Warning signs:** Hard-locked children regaining access unexpectedly.

---

## Code Examples

### Monthly Spend Aggregation (<100ms with index)

```typescript
// Source: project MongoDB pattern from src/app/api/analytics/route.ts — adapted
// Requires index: { userId: 1, recordedAt: 1 } created in Wave 0

async function getMonthlySpendEUR(userId: string, db: Db): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const result = await db.collection("cost_ledger").aggregate([
    { $match: { userId, recordedAt: { $gte: startOfMonth } } },
    { $group: { _id: null, total: { $sum: "$costEUR" } } }
  ]).toArray();

  return result[0]?.total ?? 0;
}
```

### Weekly Bonus Cap Check

```typescript
function getStartOfWeekUTC(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function getWeeklyBonusSpend(userId: string, db: Db): Promise<number> {
  const weekStart = getStartOfWeekUTC(new Date());

  const result = await db.collection("bonus_purchases").aggregate([
    { $match: { userId, purchasedAt: { $gte: weekStart } } },
    { $group: { _id: null, total: { $sum: "$packSizeEUR" } } }
  ]).toArray();

  return result[0]?.total ?? 0;
}
```

### Effective Limits Resolver (global defaults + per-child overrides)

```typescript
interface EffectiveLimits {
  dailyImageLimit: number;
  dailyMessageLimit: number;
  monthlyCostCapEUR: number;
  weeklyBonusCap: number;
  bonusPackSize: number;
  bonusMessageTemplate: string;
}

async function getEffectiveLimits(userId: string, db: Db): Promise<EffectiveLimits> {
  const [defaults, override] = await Promise.all([
    db.collection("settings").findOne({ _id: "global_defaults" }),
    db.collection("settings").findOne({ _id: `override_${userId}` }),
  ]);

  const d = defaults ?? {};
  const o = override ?? {};

  return {
    dailyImageLimit: o.dailyImageLimit ?? d.dailyImageLimit ?? 10,
    dailyMessageLimit: o.dailyMessageLimit ?? d.dailyMessageLimit ?? 50,
    monthlyCostCapEUR: o.monthlyCostCapEUR ?? d.monthlyCostCapEUR ?? 10.00,
    weeklyBonusCap: o.weeklyBonusCap ?? d.weeklyBonusCap ?? 5.00,
    bonusPackSize: o.bonusPackSize ?? d.bonusPackSize ?? 2.00,
    bonusMessageTemplate: o.bonusMessageTemplate ?? d.bonusMessageTemplate
      ?? "You've reached your limit. Would you like to unlock €2 of extra usage? Type YES to confirm.",
  };
}
```

### Enforcement Cron Logic (high-level flow)

```typescript
// src/app/api/cron/limit-enforcement/route.ts — runs every 2 minutes
// For each child:
// 1. Get current daily image count from files collection
// 2. Get current daily message count from cost_ledger or messages collection
// 3. Get current monthly spend from cost_ledger
// 4. Get effective limits
// 5. Check bonus credit remaining
// 6. Apply or lift enforcement as needed

async function enforceChildLimits(userId: string, childName: string, db: Db): Promise<void> {
  const limits = await getEffectiveLimits(userId, db);
  const [imageCount, messageCount, monthlySpend, weeklyBonusSpend, activeBonusCredit] =
    await Promise.all([
      getImageCountToday(userId, db),
      getMessageCountToday(userId, db),
      getMonthlySpendEUR(userId, db),
      getWeeklyBonusSpend(userId, db),
      getActiveBonusCredit(userId, db),
    ]);

  const imageLimitHit = imageCount >= limits.dailyImageLimit;
  const messageLimitHit = messageCount >= limits.dailyMessageLimit;
  const monthlyCostHit = monthlySpend >= limits.monthlyCostCapEUR;
  const weeklyBonusHit = weeklyBonusSpend >= limits.weeklyBonusCap;
  const hasBonus = activeBonusCredit > 0;

  const shouldHardLock = (monthlyCostHit || messageLimitHit) && !hasBonus && weeklyBonusHit;
  const shouldImageLock = imageLimitHit && !hasBonus;
  const awaitingConfirmation = await isAwaitingBonusConfirmation(userId, db);

  if (shouldHardLock) {
    await hardLockAllAccess(userId, db);
  } else if (shouldImageLock && !awaitingConfirmation) {
    await lockImageAccess(userId, db);
    await offerBonusPurchase(userId, "image_cap", limits, db);
  } else if ((monthlyCostHit || messageLimitHit) && !hasBonus && !weeklyBonusHit && !awaitingConfirmation) {
    await offerBonusPurchase(userId, "monthly_cap", limits, db);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Safety detection only for text/jailbreaks | Extends to `"image_prompt"` type with dedicated patterns | Phase 15 | Parent email subject clearly identifies image abuse |
| Rate limit described as "impossible without forking" (old research) | Achievable via ACL manipulation (image lock) + balance write (full lock) | Phase 15 | Hard enforcement without LibreChat fork |
| Cost tracking: formula estimate on message counts | Real-time per-message `cost_ledger` with token counts | Phase 15 | Monthly cap enforcement is now meaningful |
| No bonus/extra usage model | Claude's Extra Usage pattern: bonus on top of monthly cap | Phase 15 | Children learn real-world cost implications |
| LibreChat agents shared across all users | ACL entries are per-user; removing them is per-user | v0.8.0+ | Enables per-child enforcement without agent clones |

**Deprecated/outdated from old research:**
- Old research recommendation "Implement option 2 + 1 combined: system prompt instruction + admin visibility": Replaced with hard enforcement via ACL + balance.
- Old research "Hard blocking requires forking LibreChat": Incorrect. Balance system + ACL manipulation achieves hard blocking.
- Old research claim image patterns should use existing `"jailbreak_attempt"` type: Overridden by CONTEXT.md decision to add `"image_prompt"` type.

---

## Scope Recommendation

**Do NOT split into a separate phase. Split into two plans within Phase 15.**

Phase 15 is large (4 tracks, ~6 admin UI pages, ~5 cron endpoints) but all tracks share the same MongoDB database, the same cost ledger, and the same enforcement infrastructure. Splitting into Phase 15/16 would require duplicating the settings collection and limit-checking logic across both phases.

**Recommended split into two plans:**

**Plan 01 — Foundation (no user-facing changes):**
- Safety patterns extension (Track A)
- `cost_ledger` collection + polling cron infrastructure (Track B)
- `settings` collection schema + seed document
- `balance.enabled` in `librechat.yaml` + deploy
- Wave 0: confirm `files` collection `context` field value via live MongoDB inspection

**Plan 02 — Enforcement + Bonus Flow + Admin UI (user-facing):**
- ACL manipulation enforcement for image lock (Track C)
- Balance write enforcement for full lock (Track C)
- Bonus purchase detection and application (Track D)
- Cron schedule updates in Railway
- Admin UI: settings page, user detail page enhancements, analytics additions
- Weekly digest extension

---

## Open Questions

1. **LibreChat `messages` collection token count fields**
   - What we know: LibreChat stores messages in MongoDB; the `cost_ledger` sweep needs input/output token counts
   - What's unclear: Whether LibreChat stores actual token counts in messages (e.g., `msg.tokenCount.input`) or only raw text. If absent, we fall back to the char-formula from Phase 10.
   - Recommendation: Wave 0 task — run `db.messages.findOne({isCreatedByUser: false})` in Railway MongoDB to inspect actual message document fields. If `tokenCount` or similar exists, use it; otherwise char-formula.

2. **LibreChat synthetic message rendering**
   - What we know: LibreChat renders all documents in the `messages` collection for a given `conversationId`
   - What's unclear: Whether inserting a document directly into MongoDB triggers the child's LibreChat UI to refresh (websocket event? SSE? polling?)
   - Recommendation: Wave 0 task — test by inserting a message directly into MongoDB for an active conversation and observing LibreChat's behavior. If it doesn't auto-refresh, update `conversations.updatedAt` as a trigger.

3. **`aclentries` exact schema**
   - What we know: Phase 14 confirmed these entries exist (5 entries per agent: owner + remoteAgent + 3 user viewers). The enforcement approach deletes viewer entries per-user.
   - What's unclear: Exact field names in the aclentries document (is it `user` or `userId`? Is it `resource` or `resourceId`?)
   - Recommendation: Wave 0 task — run `db.aclentries.findOne()` in Railway MongoDB to inspect exact schema before writing any manipulation code.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via Next.js built-in test runner) |
| Config file | `package.json` `"test"` script |
| Quick run command | `npm test -- --testPathPattern=safety-patterns` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-SAFETY-01 | `"image_prompt"` events detected for violent/gore image requests | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-SAFETY-02 | `"image_prompt"` events detected for nudity image requests | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-SAFETY-03 | `"image_prompt"` events detected for bypass attempts | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-SAFETY-04 | Existing jailbreak and redirect detection not broken by image patterns | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-LIMITS-01 | `getEffectiveLimits()` returns global defaults when no override exists | unit | `npm test -- --testPathPattern=rate-limits` | ❌ Wave 0 |
| IMG-LIMITS-02 | `getEffectiveLimits()` returns per-child override when present | unit | `npm test -- --testPathPattern=rate-limits` | ❌ Wave 0 |
| IMG-LIMITS-03 | `getMonthlySpendEUR()` aggregates `cost_ledger` correctly | unit | `npm test -- --testPathPattern=cost-ledger` | ❌ Wave 0 |
| IMG-LIMITS-04 | `getWeeklyBonusSpend()` returns correct weekly total | unit | `npm test -- --testPathPattern=bonus-purchases` | ❌ Wave 0 |
| IMG-BONUS-01 | Weekly digest includes bonus purchase totals | unit | `npm test -- --testPathPattern=weekly-digest` | ❌ Wave 0 |
| IMG-ENFORCE-01 | Balance write enforcement (manual Railway MongoDB verify) | manual smoke | n/a — test via librechat.railway.internal | n/a |
| IMG-ENFORCE-02 | ACL removal hides modelSpec preset (manual UI verify) | manual smoke | n/a — test via LibreChat UI | n/a |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=safety-patterns`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/safety-patterns.test.ts` — Add `"image_prompt"` type test cases + regression for existing types
- [ ] `src/lib/__tests__/rate-limits.test.ts` — Test `getEffectiveLimits()` with mocked MongoDB
- [ ] `src/lib/__tests__/cost-ledger.test.ts` — Test monthly aggregation with mocked data
- [ ] `src/lib/__tests__/bonus-purchases.test.ts` — Test weekly spend + `getStartOfWeekUTC()`
- [ ] MongoDB schema inspection — `db.files.findOne({context: "image_generation"})` to confirm `context` field value
- [ ] MongoDB aclentries inspection — `db.aclentries.findOne()` to confirm field names (`user`, `resource`, permission fields)
- [ ] MongoDB messages inspection — `db.messages.findOne({isCreatedByUser: false})` to confirm whether `tokenCount` fields exist
- [ ] Synthetic message rendering test — insert test message directly into MongoDB for active conversation, verify LibreChat renders it

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/data/home/KidAI/src/lib/safety-patterns.ts` — Existing pattern structure, `detectSafetyEvent()` function signature
- `/data/home/KidAI/src/lib/notify-safety-alert.ts` — Email pipeline, dedup logic, `alertType` union
- `/data/home/KidAI/src/lib/cost-estimates.ts` — Token pricing constants (HAIKU_INPUT_PER_MTOK, etc.)
- `/data/home/KidAI/src/lib/weekly-digest.ts` — `WeeklyChildStats` interface, aggregation pattern to extend
- `/data/home/KidAI/.planning/phases/14-enable-safeguard-image-generation/14-01-SUMMARY.md` — 4 agent IDs, ACL architecture, `aclentries` collection confirmed
- LibreChat `packages/data-provider/src/types/files.ts` — `FileContext` enum confirms `"image_generation"` value; `TFile` interface confirms `user`, `context`, `source`, `createdAt` fields

### Secondary (MEDIUM confidence — official sources + Railway Help Station)
- [Railway MongoDB start command](https://docs.railway.com/guides/mongodb) — `mongod --ipv6 --bind_ip ::,0.0.0.0` (no `--replSet`) confirms standalone
- [Railway Help Station — replica sets](https://station.railway.com/questions/enable-replica-sets-for-a-single-mongo-db-c7ab4b69) — Confirms standalone cannot use change streams; fix is replica set template
- [LibreChat Token Usage](https://www.librechat.ai/docs/configuration/token_usage) — CLI `set-balance`/`add-balance` commands; balance collection exists; blocks at zero
- [LibreChat Balance Docs](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/balance) — `enabled`, `startBalance`, `autoRefillEnabled` fields
- [LibreChat PR #9433](https://github.com/danny-avila/LibreChat/pull/9396) — Backend enforces ACL before executing agent; frontend now hides modelSpecs for inaccessible agents
- [LibreChat Discussion #9401](https://github.com/danny-avila/LibreChat/discussions/9401) — VIEWER role agents delegated to marketplace; removing ACL entry entirely blocks access

### Tertiary (LOW confidence — needs live verification)
- LibreChat `messages` collection `tokenCount` field existence — inferred from architecture; must verify via `db.messages.findOne()`
- Synthetic message rendering in LibreChat UI — insertion approach inferred; must test in Wave 0
- `aclentries` exact field names (`user` vs `userId`, `resource` vs `resourceId`) — inferred from Phase 14 context; must verify via `db.aclentries.findOne()`

---

## Metadata

**Confidence breakdown:**
- Safety pattern extension: HIGH — identical pattern to existing code; no unknowns
- Image count source of truth: HIGH — `FileContext.image_generation` confirmed from TypeScript source
- Railway MongoDB standalone: HIGH — confirmed via start command + Railway Help Station
- Polling approach (no change streams): HIGH — follows directly from standalone confirmation
- ACL manipulation enforcement: HIGH — LibreChat PR #9433 confirms backend enforcement + UI filtering
- Balance write enforcement: MEDIUM — LibreChat balance system documented; `tokenCredits` field confirmed; exact MongoDB document shape needs Wave 0 verification (`db.balance.findOne()`)
- Bonus message insertion into `messages`: LOW — approach is sound architecturally but rendering behavior in LibreChat UI unverified
- Cost ledger token counts: LOW — `tokenCount` field in messages may not exist; char-formula fallback ready

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (LibreChat's balance and ACL systems are stable; `files` collection schema unlikely to change)
