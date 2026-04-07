# Phase 15: Safety Alert Extension & Rate Limiting — Research

**Researched:** 2026-04-07
**Domain:** MongoDB query patterns, LibreChat image generation internals, Next.js API routes, safety pattern regex
**Confidence:** MEDIUM (LibreChat image storage schema LOW; rest HIGH from direct codebase inspection)

---

## Summary

This phase has two independent tracks that share no code except the admin dashboard codebase:

**Track A — Safety alert extension for image prompts.** Image prompt safety detection follows the exact same code path as existing text safety detection (`src/lib/safety-patterns.ts`). The key architectural insight is: **image generation in LibreChat flows through the LLM first**. The user's message text asking for an image IS stored as a normal user message (`isCreatedByUser=true`) in the `messages` collection. The existing `detectSafetyEvent()` function already scans these messages. New image-specific regex patterns need to be added to `JAILBREAK_PATTERNS` in `safety-patterns.ts` and the existing `alerts/page.tsx` + `notify-safety-alert.ts` pipeline handles the rest automatically.

**Track B — Per-user daily image rate limit.** LibreChat has **no native image-specific rate limiting** in `librechat.yaml`. The only viable approach is a MongoDB-based counter tracked in the admin dashboard. The challenge is identifying image generation messages in the `messages` collection — LibreChat does not store a discrete `type: "image"` field. Generated images appear as messages with image file attachments stored in a `files` collection. The practical detection approach is querying the `files` collection for generated images per user per day (images stored there with `user` field) rather than trying to parse message content.

**Primary recommendation:** Track A is straightforward — add regex to `safety-patterns.ts`. Track B requires understanding the `files` collection schema via live MongoDB inspection before the rate limit counter can be built, as LibreChat's exact schema for generated images is not publicly documented with sufficient detail.

---

## Standard Stack

### Core (all existing — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongodb (Node driver) | existing | MongoDB queries for rate counting | Already wired in `src/lib/mongodb.ts` |
| Next.js API routes | existing | Rate limit check endpoint | Consistent with project pattern |
| Resend | existing | Email notifications for image alerts | Phase 13 already built this pipeline |
| shadcn/ui | existing | Admin UI image count display | Project component library |

### No new dependencies required for this phase.

**Installation:**
```bash
# No new packages — phase uses existing stack only
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── safety-patterns.ts       # Add IMAGE_PROMPT_PATTERNS array (Track A)
│   └── image-rate-limit.ts      # NEW: image count query + limit check (Track B)
├── app/
│   └── (dashboard)/
│       └── users/
│           └── [userId]/
│               └── page.tsx     # NEW: user detail page with image count
```

### Pattern 1: Extending Safety Patterns (Track A)

**What:** Add a new pattern array `IMAGE_PROMPT_PATTERNS` to `safety-patterns.ts` matched against user messages that request image generation with abusive content.

**When to use:** Same detection flow as existing jailbreak/safety_redirect patterns. These match `isCreatedByUser=true` messages.

**Key insight about LibreChat image flow:** When a child types "draw me a scary zombie", LibreChat stores the message text "draw me a scary zombie" as a normal user message in `messages` collection (`isCreatedByUser=true`, `text="draw me a scary zombie"`). The LLM then generates an optimized DALL-E prompt internally. The user message text is what gets scanned.

**New patterns to add:**
```typescript
// Source: phase requirements + established DALL-E abuse categories
const IMAGE_PROMPT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Violence / gore
  { pattern: /draw\s+(me\s+)?.*\b(blood|gore|guts|dead body|corpse|decapitat)/i, label: "Image: violent/gore request" },
  { pattern: /generate\s+(an?\s+)?image\s+of\s+.*\b(kill|murder|violence|gore)/i, label: "Image: violent content request" },
  { pattern: /picture\s+of\s+.*\b(blood|gore|violent|killing)/i, label: "Image: violent/gore request" },

  // Nudity / immodest
  { pattern: /draw\s+(me\s+)?(naked|nude|without\s+clothes|undressed|topless)/i, label: "Image: nudity request" },
  { pattern: /(image|picture|photo)\s+of\s+(naked|nude|without\s+clothes|undressed)/i, label: "Image: nudity request" },
  { pattern: /draw\s+(me\s+)?.*\b(sexy|seductive|provocative)/i, label: "Image: immodest content request" },

  // Horror / scary
  { pattern: /draw\s+(me\s+)?(a\s+)?(scary|horror|terrifying|demonic|satanic|evil\s+demon)/i, label: "Image: horror request" },
  { pattern: /(image|picture)\s+of\s+.*(monster|demon|devil)\s+attacking/i, label: "Image: horror request" },

  // Real named people
  { pattern: /draw\s+(me\s+)?(a\s+)?(picture|image|photo)?\s*of\s+(president|trump|biden|obama|putin|celebrity)/i, label: "Image: real person request" },

  // Bypass attempts
  { pattern: /draw\s+but\s+make\s+it\s+look\s+like/i, label: "Image: bypass attempt" },
  { pattern: /image\s+but\s+with\s+rules\s+(off|disabled|removed)/i, label: "Image: bypass attempt" },
  { pattern: /pretend\s+(the\s+image\s+)?you\s+(can|could|are\s+allowed\s+to)\s+(draw|generate|create)/i, label: "Image: bypass attempt" },
  { pattern: /as\s+(a\s+)?cartoon\s+(so|but).*(blood|nude|naked|scary)/i, label: "Image: bypass via cartoon framing" },
  { pattern: /for\s+(a\s+)?(movie|book|story|game)\s+so.*(blood|nude|naked|scary)/i, label: "Image: bypass via fiction framing" },
];
```

**`detectSafetyEvent()` update:**
```typescript
// Extend existing function to also check image patterns for user messages
export function detectSafetyEvent(text: string, isCreatedByUser: boolean) {
  // existing pattern checks...
  
  // NEW: also check image prompt patterns for user messages
  if (isCreatedByUser) {
    for (const { pattern, label } of IMAGE_PROMPT_PATTERNS) {
      if (pattern.test(text)) {
        return { detected: true, type: "jailbreak_attempt" as const, matchedPattern: label };
      }
    }
  }
  
  return { detected: false, type: null, matchedPattern: null };
}
```

**Alert type for image prompts:** Use existing `"jailbreak_attempt"` type — image-specific patterns go into `JAILBREAK_PATTERNS` (or a merged scan) since they represent child bypass attempts. This requires zero changes to `notifySafetyAlert` or email templates.

### Pattern 2: Image Count Tracking via LibreChat's Files Collection (Track B)

**What:** Query LibreChat's `files` collection to count images generated by each user per day.

**Critical discovery — LibreChat image storage:** LibreChat stores generated images as records in a `files` collection in MongoDB (same database "test"). Each generated image has a `user` field (ObjectId string of the user who generated it) and a `createdAt` timestamp. The `source` or `type` field likely distinguishes user-uploaded files from AI-generated images.

**Research gap:** The exact schema of the `files` collection (particularly what field/value identifies AI-generated images vs user uploads) is LOW confidence — official LibreChat docs do not detail this. The planner must include a Wave 0 task to inspect the `files` collection live in Railway MongoDB to confirm the discriminator field before coding the rate limit query.

**Expected query pattern (to be verified):**
```typescript
// Inspect files collection first: db.files.findOne() to see actual schema
// Expected fields based on community discussions:
// { user: ObjectId, source: "dall-e" | "local", type: "image", createdAt: Date, ... }

const startOfDayUTC = new Date();
startOfDayUTC.setUTCHours(0, 0, 0, 0);

const imageCount = await db.collection("files").countDocuments({
  user: userId,          // user field — confirm field name via inspection
  source: "dall-e",      // or whatever discriminates AI-generated — VERIFY
  createdAt: { $gte: startOfDayUTC },
});
```

**Alternative if `files` collection doesn't work:** Count user messages containing image request keywords from the `messages` collection since midnight UTC. Less precise but doesn't require schema discovery.

### Pattern 3: Rate Limit Check (Track B)

**Architecture decision:** Rate limiting is enforced at the **admin dashboard level only** (not inside LibreChat). There is no way to block a LibreChat request mid-flight from outside the LibreChat process. The rate limit is:
1. Displayed as a warning/status in the admin user detail page
2. Optionally surfaced to parents via notification

LibreChat cannot natively enforce a daily image generation cap. The options ranked by effort/impact:
1. **Display-only in admin** (lowest effort): Show count + daily limit on admin user detail page — parents see it and can discuss with kids
2. **System prompt instruction**: Add to system prompt "Do not generate more than 10 images per day" — relies on LLM compliance, not a hard limit
3. **OpenAI API key revocation**: Revoke/regenerate the key after N images — nuclear option, breaks everything
4. **MongoDB-based soft block with admin override**: Check count in an API route that the admin can see — but LibreChat doesn't call this route

**Recommended approach:** Implement option 2 + 1 combined:
- Add daily image count instruction to system prompt (soft limit, LLM-enforced)
- Track actual count in admin via `files` collection query
- Show count on admin user detail page with limit indicator

**Shared config constant:**
```typescript
// src/lib/image-config.ts (new file)
export const IMAGE_GENERATION_CONFIG = {
  DAILY_LIMIT: 10,
  RESET_HOUR_UTC: 0, // midnight UTC
} as const;
```

### Pattern 4: Admin User Detail Page (Track B)

**What:** A new route `/users/[userId]/page.tsx` that shows per-child stats including image count today.

**Architecture:** Server component (consistent with project pattern) querying MongoDB directly.

```typescript
// /src/app/(dashboard)/users/[userId]/page.tsx
// Server component — direct MongoDB query (consistent with project pattern)
async function getChildImageCount(userId: string): Promise<number> {
  const client = await getMongoClient();
  const db = client.db("test");
  
  const startOfDayUTC = new Date();
  startOfDayUTC.setUTCHours(0, 0, 0, 0);
  
  // VERIFY: confirm field names via MongoDB inspection in Wave 0
  return db.collection("files").countDocuments({
    user: userId,
    createdAt: { $gte: startOfDayUTC },
    // add discriminator field once confirmed
  });
}
```

**Where to show it:** Add an "Image Count Today" column to the existing `UsersTable` for USER role rows, or create a user detail page. The users table approach is simpler — no new route needed. Show as `{count} / {DAILY_LIMIT} images today`.

### Anti-Patterns to Avoid

- **Don't try to intercept LibreChat at the proxy level**: LibreChat runs as its own Railway service; there's no HTTP middleware insertion point from the admin dashboard.
- **Don't build a hard block via MongoDB triggers**: MongoDB Atlas triggers could theoretically decrement a counter, but we're on Railway MongoDB, not Atlas.
- **Don't create a new SafetyEvent type for images**: Use existing `"jailbreak_attempt"` type — the email template already handles this and no changes to email infrastructure needed.
- **Don't try to parse image file paths from message text**: LibreChat stores image paths in messages as markdown `![...](...)` links, but parsing these is fragile. Use `files` collection instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending for image alerts | Custom emailer | Existing `notifySafetyAlert()` in `notify-safety-alert.ts` | Already has Resend + dedup + multi-recipient logic |
| Pattern matching engine | Custom regex runner | Add to existing `safety-patterns.ts` arrays | `detectSafetyEvent()` already handles batching; alerts page scans automatically |
| Database connection | New MongoDB client | `getMongoClient()` from `src/lib/mongodb.ts` | Connection pooling already managed |
| Date-range queries | Custom time math | Standard MongoDB `$gte` with `Date` | Well-established pattern in project (see `analytics/route.ts`) |
| UI skeleton/loading | Custom spinner | `loading.tsx` + shadcn `<Skeleton>` | Project convention from CLAUDE.md |

---

## Common Pitfalls

### Pitfall 1: Assuming LibreChat Stores Image Type in Messages

**What goes wrong:** Querying `messages` collection for `type: "image"` or `mediaType: "image"` yields nothing.
**Why it happens:** LibreChat messages are polymorphic. A user asking for an image sends a text message (`isCreatedByUser=true`, `text="draw me a cat"`). The generated image is stored in the `files` collection, not as a message type.
**How to avoid:** Wave 0 task: `db.files.findOne()` in Railway MongoDB to inspect actual schema. Count from `files` collection, not `messages`.
**Warning signs:** Query returning zero counts when images have definitely been generated.

### Pitfall 2: Image Alert Patterns Triggering on Innocent Requests

**What goes wrong:** Pattern `/draw.*(scary)/i` matches "draw me a picture of a butterfly that isn't too scary" — creates false alert.
**Why it happens:** Overly broad regex on short words.
**How to avoid:** Use word boundaries, require context words adjacent to the concerning word. Test against sample children's natural language requests before deploying.
**Warning signs:** Alert count spikes with obviously innocent conversations.

### Pitfall 3: Rate Limit Reset at Wrong Time

**What goes wrong:** Using `new Date().setHours(0, 0, 0, 0)` resets at local server time, not UTC midnight. Railway containers run in UTC but local time math in tests may behave differently.
**Why it happens:** JavaScript Date midnight is timezone-sensitive.
**How to avoid:** Always use `setUTCHours(0, 0, 0, 0)` for UTC midnight. MongoDB stores dates in UTC.
**Warning signs:** Image count resets at unexpected times in production.

### Pitfall 4: Trying to Hard-Block Image Generation in LibreChat

**What goes wrong:** Attempting to revoke the OpenAI API key after N images breaks all AI functionality (text chat too), not just image generation.
**Why it happens:** OpenAI API key is shared across all LibreChat features.
**How to avoid:** Accept that this phase delivers a soft limit (system prompt instruction + admin visibility). Hard blocking requires forking LibreChat or using DALL-E API key separate from the main key.
**Warning signs:** Planning tasks that involve "disable the API key when limit reached."

### Pitfall 5: Alert Dedup Blocking Image-Specific Alerts

**What goes wrong:** The 1-hour dedup window in `notifySafetyAlert()` uses `conversationId + matchedPattern`. If a child sends the same type of image request twice in an hour, the second alert is suppressed.
**Why it happens:** Dedup is intentional for text patterns but may be too aggressive for image patterns.
**How to avoid:** This is acceptable behavior — dedup prevents email floods. Document it. The admin can always view the alerts page for full history.
**Warning signs:** Parents complaining they didn't get an alert for a second image request.

---

## Code Examples

### Adding Image Pattern Detection to Existing System

```typescript
// Source: project codebase (src/lib/safety-patterns.ts) — extend existing pattern

// NEW array — add before detectSafetyEvent()
const IMAGE_PROMPT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(draw|generate|create|make|show)\b.{0,30}\b(naked|nude|topless|without clothes)\b/i, label: "Image: nudity request" },
  { pattern: /\b(draw|generate|create)\b.{0,20}\b(blood|gore|guts|decapitat)\b/i, label: "Image: violent content" },
  { pattern: /\b(draw|generate|picture)\b.{0,20}\b(scary|horror|demonic|satanic)\b/i, label: "Image: horror content" },
  { pattern: /draw.{0,30}but.{0,20}(look like|appears?|seems?).{0,30}(safe|allowed|innocent)/i, label: "Image: bypass attempt" },
  { pattern: /\b(draw|generate|create)\b.{0,20}\b(real person|actual photo|realistic photo|look like a photo)\b/i, label: "Image: realistic person request" },
];
```

### MongoDB Image Count Query (verify schema first)

```typescript
// Source: project pattern from src/lib/mongodb.ts + src/app/api/analytics/route.ts

async function getImageCountToday(userId: string): Promise<number> {
  const client = await getMongoClient();
  const db = client.db("test");

  const startOfDayUTC = new Date();
  startOfDayUTC.setUTCHours(0, 0, 0, 0);

  // WAVE 0: Confirm actual field names by running db.files.findOne() in Railway MongoDB
  // Expected: { user: "userId_string", source: "dall-e", createdAt: Date, type: "image/png" }
  return db.collection("files").countDocuments({
    user: userId,
    createdAt: { $gte: startOfDayUTC },
    // source: "dall-e",  // uncomment after schema verification
  });
}
```

### Users Page Image Count Column

```typescript
// Pattern: extend existing users table (src/app/(dashboard)/users/page.tsx)
// Server component adds image counts to UserSummary before render

interface UserSummaryWithImages extends UserSummary {
  imagesToday?: number;
}

// In page.tsx getUsers():
const startOfDayUTC = new Date();
startOfDayUTC.setUTCHours(0, 0, 0, 0);

const imageCounts = await db.collection("files").aggregate([
  { $match: { createdAt: { $gte: startOfDayUTC } } },
  { $group: { _id: "$user", count: { $sum: 1 } } }
]).toArray();

const imageCountMap = new Map(imageCounts.map(r => [String(r._id), r.count as number]));
// Then add imagesToday: imageCountMap.get(user.id) ?? 0 to each user
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Client-side only safety detection | All safety patterns in shared `safety-patterns.ts` lib | Detection reused in alerts page, test mode, admin chatbot |
| Hard-coded safety patterns only | Patterns in dedicated file, easily extended | Add array entries = full detection + email pipeline activated |
| LibreChat config for rate limits | MongoDB-side counting (no LibreChat native support) | Rate limit is soft/advisory only via system prompt |

---

## Open Questions

1. **LibreChat `files` collection schema**
   - What we know: LibreChat stores generated images in a `files` collection with `user` and `createdAt` fields (HIGH confidence from architecture docs)
   - What's unclear: The exact discriminator field that separates AI-generated images from user-uploaded images (e.g., `source: "dall-e"` vs `embedded: false` vs something else)
   - Recommendation: Wave 0 task — SSH into Railway or use MongoDB Compass to run `db.files.findOne()` and inspect a real generated image document. This unblocks the rate limiting query.

2. **Whether safety alert email should use a new type for image alerts**
   - What we know: `notifySafetyAlert()` accepts `"safety_redirect" | "jailbreak_attempt"` as `alertType`
   - What's unclear: Whether parents benefit from seeing "Image Prompt Alert" vs "Jailbreak Attempt" in email subject
   - Recommendation: Add `"image_prompt"` to the `alertType` union and update the email template's subject line conditionally. Small change, meaningful clarity for parents.

3. **System prompt enforcement reliability for rate limits**
   - What we know: Claude Haiku is instructed via the system prompt; it follows instructions well for content restrictions
   - What's unclear: How reliably Haiku refuses image generation after 10 images if the system prompt says to. LLMs can miss counting instructions.
   - Recommendation: Accept LLM enforcement as best-effort soft limit. Admin visibility is the real value. Document this limitation explicitly.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via Next.js) |
| Config file | `package.json` `"test"` script |
| Quick run command | `npm test -- --testPathPattern=safety-patterns` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-SAFETY-01 | Image prompt patterns detect violent/gore requests | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-SAFETY-02 | Image prompt patterns detect nudity requests | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-SAFETY-03 | Image prompt patterns detect bypass attempts | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-SAFETY-04 | Existing jailbreak detection not broken by image patterns | unit | `npm test -- --testPathPattern=safety-patterns` | ❌ Wave 0 |
| IMG-RATE-01 | Image count query returns correct count for today | unit | `npm test -- --testPathPattern=image-rate-limit` | ❌ Wave 0 |
| IMG-ADMIN-01 | User detail page renders image count column | manual smoke | n/a (Railway deploy) | n/a |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=safety-patterns`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/safety-patterns.test.ts` — Add test cases for new IMAGE_PROMPT_PATTERNS (can add to existing file if it exists, else create)
- [ ] `src/lib/__tests__/image-rate-limit.test.ts` — Test the image count query logic with mocked MongoDB
- [ ] MongoDB schema inspection — Run `db.files.findOne()` on Railway MongoDB to confirm `files` collection discriminator field before any rate limit code is written

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/data/home/KidAI/src/lib/safety-patterns.ts` — Existing pattern structure, `detectSafetyEvent()` function signature
- `/data/home/KidAI/src/lib/notify-safety-alert.ts` — Email pipeline, dedup logic, `alertType` union
- `/data/home/KidAI/src/app/(dashboard)/alerts/page.tsx` — How safety scanning flows through admin dashboard
- `/data/home/KidAI/src/app/api/analytics/route.ts` — MongoDB aggregation patterns used in project
- `/data/home/KidAI/.planning/phases/02-safety-configuration/librechat.yaml` — Current LibreChat config

### Secondary (MEDIUM confidence — official LibreChat docs)
- [LibreChat Moderation System](https://www.librechat.ai/docs/features/mod_system) — No image rate limiting exists natively
- [LibreChat Config Structure](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/config) — `rateLimits` covers fileUploads, STT, TTS — NOT image generation
- [LibreChat Image Generation](https://www.librechat.ai/docs/features/image_gen) — LLM processes prompt before DALL-E; images stored per configured fileStrategy
- [LibreChat Balance/Token](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/balance) — Token credits possible but not image-generation-specific

### Tertiary (LOW confidence — schema details not officially documented)
- [LibreChat Database Models DeepWiki](https://deepwiki.com/danny-avila/LibreChat/7.1-database-models) — Message schema uses content array; generated images stored as attachments
- [LibreChat GitHub discussion #3320](https://github.com/danny-avila/LibreChat/discussions/3320) — Images stored at `/images/{userId}/img-{id}.png` path; implies `files` collection with user scoping

---

## Metadata

**Confidence breakdown:**
- Safety pattern extension (Track A): HIGH — follows identical pattern to existing code; no unknowns
- Image prompt flow understanding: HIGH — LibreChat docs confirm LLM processes text first; user message is standard text message
- `files` collection schema: LOW — not officially documented; must be verified via live MongoDB inspection
- Rate limit architecture: HIGH — verified no native LibreChat support exists; MongoDB-based counting is the right approach
- Admin UI pattern: HIGH — consistent with existing server component + MongoDB direct query pattern

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (LibreChat releases monthly; `files` schema unlikely to change but verify)
