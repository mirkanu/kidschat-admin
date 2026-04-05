# Phase 13: Parent Email Notifications - Research

**Researched:** 2026-04-05
**Domain:** Transactional email (Resend + React Email), Railway cron scheduling, MongoDB aggregation
**Confidence:** HIGH

## Summary

Phase 13 adds two email notification types for parents: real-time safety alert emails triggered when the existing client-side safety pattern detection fires, and weekly activity summary emails per child (message counts, preset usage, active days). The email service is Resend, templates use React Email (`@react-email/components`), and the weekly digest is triggered by a Railway cron service that makes an HTTP POST to the Next.js API.

The primary architectural challenge is that **safety detection is currently client-side and ephemeral** — safety events are detected in the browser from conversation data and are never written to MongoDB. Real-time safety alert emails therefore require lifting detection to the server side, specifically inside the existing `/api/alerts` route (which already does server-side detection). The trigger point for alerts must be the admin dashboard loading conversation data, OR a new lightweight endpoint that the client calls when it detects an event. The simplest production-ready approach is a dedicated `/api/notify/safety-alert` POST endpoint that the client calls when it detects a safety event, which then immediately dispatches a Resend email.

Weekly digests are straightforward: the Railway cron POSTs to `/api/notify/weekly-digest`, which runs the MongoDB aggregation (reusing patterns from the existing analytics route), formats per-child stats, and sends one email per parent address. Since all users in this family system are in the same MongoDB `users` collection, the parent email address is simply the `ADMIN` role user's email address.

**Primary recommendation:** Install `resend` + `@react-email/components`, build two React Email templates (SafetyAlertEmail, WeeklyDigestEmail), create three API routes (safety-alert trigger, weekly-digest trigger, notification-history GET), store a `email_notifications` MongoDB collection for sent history, add a Railway cron service that POSTs weekly, and add email preferences to the user settings page.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTIFY-01 | Real-time safety alert emails when concerning content detected | `/api/notify/safety-alert` POST endpoint + Resend SDK + SafetyAlertEmail template; client calls endpoint when safety event detected client-side |
| NOTIFY-02 | Weekly activity summary emails per child (message counts, topics, usage patterns) | `/api/notify/weekly-digest` POST endpoint + MongoDB aggregation reusing analytics query patterns + WeeklyDigestEmail template |
| NOTIFY-03 | Railway cron service triggers weekly digest | Separate Railway cron service with Node.js script: fetches `/api/notify/weekly-digest` then process.exit(0) |
| NOTIFY-04 | Email preferences/settings for parents (opt-in/out, frequency) | `notification_prefs` field on users collection document; admin UI toggle on settings/users page |
| NOTIFY-05 | Admin UI for viewing sent notification history | `/api/notify/history` GET + new `email_notifications` MongoDB collection; simple table in admin dashboard |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^4.x (latest) | Email delivery API | User's chosen provider; first-class Next.js support |
| @react-email/components | ^0.0.x (latest) | Email template components | Official React Email component library by Resend team |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node (built-in fetch) | N/A | Railway cron script HTTP call | Cron script calls Next.js API; no extra dep needed in Node 18+ |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-email/components | Plain HTML strings | React Email gives maintainable, preview-able templates; plain HTML is brittle |
| Railway cron service | Vercel cron / GitHub Actions | User is on Railway; Railway cron is the natural fit |

**Installation (admin Next.js app):**
```bash
npm install resend @react-email/components
```

**Railway cron service** is a separate minimal Node.js service (no npm deps needed — uses native `fetch` in Node 18+). Add it as a new Railway service in the same project.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/api/notify/
│   ├── safety-alert/route.ts   # POST: send immediate safety alert email
│   ├── weekly-digest/route.ts  # POST: run digest aggregation + send emails
│   └── history/route.ts        # GET: list sent notifications for admin UI
├── components/emails/
│   ├── safety-alert-email.tsx  # React Email template: safety alert
│   └── weekly-digest-email.tsx # React Email template: weekly summary
└── lib/
    └── resend.ts               # Singleton Resend client

railway-cron/                   # Separate Railway service (same repo or separate)
└── index.mjs                   # Node.js script: fetch API then process.exit(0)
```

### Pattern 1: Resend Singleton Client

**What:** Single shared Resend instance, initialized lazily from env
**When to use:** All API routes that send email import from this module

```typescript
// src/lib/resend.ts
// Source: https://resend.com/docs/send-with-nextjs
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error('Missing environment variable: "RESEND_API_KEY"');
}

export const resend = new Resend(process.env.RESEND_API_KEY);
```

### Pattern 2: React Email Template

**What:** TSX component using @react-email/components primitives; exported as named function
**When to use:** Both email types (safety alert + weekly digest)

```typescript
// src/components/emails/safety-alert-email.tsx
// Source: https://react.email/docs/introduction
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Text, Link
} from "@react-email/components";
import * as React from "react";

interface SafetyAlertEmailProps {
  childName: string;
  alertType: "safety_redirect" | "jailbreak_attempt";
  matchedPattern: string;
  messageExcerpt: string;
  detectedAt: string;
  conversationUrl: string;
}

export function SafetyAlertEmail({
  childName,
  alertType,
  matchedPattern,
  messageExcerpt,
  detectedAt,
  conversationUrl,
}: SafetyAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Safety alert: {childName} - {matchedPattern}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "480px", margin: "40px auto", padding: "20px", backgroundColor: "#fff", borderRadius: "8px" }}>
          <Heading style={{ color: "#dc2626" }}>Safety Alert</Heading>
          <Text><strong>Child:</strong> {childName}</Text>
          <Text><strong>Type:</strong> {alertType === "jailbreak_attempt" ? "Jailbreak Attempt" : "Safety Redirect"}</Text>
          <Text><strong>Pattern:</strong> {matchedPattern}</Text>
          <Text><strong>Message excerpt:</strong> "{messageExcerpt}"</Text>
          <Text><strong>Detected at:</strong> {detectedAt}</Text>
          <Hr />
          <Link href={conversationUrl}>View conversation in dashboard</Link>
        </Container>
      </Body>
    </Html>
  );
}
```

### Pattern 3: API Route — Safety Alert Trigger

**What:** POST endpoint called by the client-side safety detection component
**When to use:** When `detectSafetyEvent()` returns `detected: true` in the admin dashboard or parent-facing views

```typescript
// src/app/api/notify/safety-alert/route.ts
// Source: https://resend.com/docs/send-with-nextjs
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resend } from "@/lib/resend";
import { SafetyAlertEmail } from "@/components/emails/safety-alert-email";
import getMongoClient from "@/lib/mongodb";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  // body: { childName, alertType, matchedPattern, messageExcerpt, detectedAt, conversationId }

  const client = await getMongoClient();
  const db = client.db("test");

  // Get admin emails (notification recipients)
  const admins = await db.collection("users")
    .find({ role: "ADMIN" })
    .project({ email: 1, name: 1 })
    .toArray();

  const toEmails = admins.map((a) => a.email as string).filter(Boolean);
  if (toEmails.length === 0) return NextResponse.json({ sent: 0 });

  const conversationUrl = `${process.env.NEXT_PUBLIC_ADMIN_URL}/conversations/${body.conversationId}`;

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_ADDRESS ?? "KidsChat Alerts <alerts@yourdomain.com>",
    to: toEmails,
    subject: `Safety Alert: ${body.childName} - ${body.matchedPattern}`,
    react: SafetyAlertEmail({ ...body, conversationUrl }),
  });

  if (error) return NextResponse.json({ error }, { status: 500 });

  // Store in notification history
  await db.collection("email_notifications").insertOne({
    type: "safety_alert",
    sentAt: new Date(),
    to: toEmails,
    childName: body.childName,
    resendId: data?.id,
    meta: body,
  });

  return NextResponse.json({ sent: toEmails.length, id: data?.id });
}
```

### Pattern 4: Railway Cron Script

**What:** Minimal Node.js script in a separate Railway service; POSTs to the admin app then exits
**When to use:** Deployed as the weekly digest trigger service

```javascript
// railway-cron/index.mjs
// Source: Railway cron docs + Node 18+ built-in fetch
const ADMIN_URL = process.env.ADMIN_URL; // e.g. https://kidschat-admin-production.up.railway.app
const CRON_SECRET = process.env.CRON_SECRET; // shared secret for auth

async function main() {
  const res = await fetch(`${ADMIN_URL}/api/notify/weekly-digest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": CRON_SECRET,
    },
    body: JSON.stringify({ trigger: "cron" }),
  });

  const body = await res.json();
  console.log("Weekly digest result:", JSON.stringify(body));

  if (!res.ok) {
    console.error("Digest failed with status", res.status);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
```

**Railway cron schedule for weekly Monday 8am UTC:** `0 8 * * 1`

### Pattern 5: Weekly Digest MongoDB Aggregation

**What:** Per-child stats for the past 7 days — total messages, conversations, active days, top presets
**When to use:** Inside `/api/notify/weekly-digest` before email send

```typescript
// Reuses the aggregation pattern from src/app/api/analytics/route.ts
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const perChildStats = await db.collection("messages").aggregate([
  { $match: { createdAt: { $gte: sevenDaysAgo }, isCreatedByUser: true } },
  {
    $lookup: {
      from: "conversations",
      localField: "conversationId",
      foreignField: "conversationId",
      as: "conv",
    },
  },
  { $unwind: { path: "$conv", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: "users",
      let: { userId: "$conv.user" },
      pipeline: [{ $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] } } }],
      as: "userInfo",
    },
  },
  { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
  { $match: { "userInfo.role": { $ne: "ADMIN" } } },
  {
    $group: {
      _id: "$userInfo.name",
      totalMessages: { $sum: 1 },
      activeDays: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } },
    },
  },
]).toArray();
// activeDays.length gives number of distinct days active this week
```

### Anti-Patterns to Avoid

- **Storing Resend API key client-side:** Always use server-side API routes; never `NEXT_PUBLIC_RESEND_API_KEY`
- **Calling resend.emails.send() from a React component directly:** React components render on both client and server — email sends must happen in API routes only
- **Long-running Railway cron:** The script MUST call `process.exit(0)` after completing or Railway will skip subsequent runs
- **Using JSX syntax for react parameter:** Pass as function call `SafetyAlertEmail({ ...props })` not `<SafetyAlertEmail />` in the `react:` field
- **Not deduplicating safety alerts:** Without dedup logic, a single conversation could generate many emails. Implement a cooldown (e.g., store last-alerted conversationId + timestamp in MongoDB, skip if alerted within 1 hour for the same conversation)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML rendering | Custom HTML string builder | @react-email/components | Email client quirks (Outlook, Gmail) handled by the library |
| Email delivery + retries | Custom SMTP client | Resend SDK | SPF/DKIM, deliverability, bounce tracking built in |
| Email template preview | Browser devtools | `npx react-email dev` | Live preview server for all email templates |
| Cron scheduling | node-cron inside Next.js | Railway cron service | Railway serverless model — Next.js app is stateless, no persistent scheduler |

**Key insight:** Email HTML is not regular HTML. Outlook renders table-based layouts, inline styles only, no CSS variables. `@react-email/components` handles all this automatically — any custom HTML email risks being broken in Outlook.

---

## Common Pitfalls

### Pitfall 1: Safety Alerts Are Client-Side Only

**What goes wrong:** The existing safety detection (`detectSafetyEvent`) runs in the browser reading conversation data. There is no server-side record of safety events. If you try to trigger an email "when a safety event is stored in MongoDB", it will never fire because nothing is stored.

**Why it happens:** Phase 6 and Phase 11 explicitly noted: "recentAlertCount is 0 — safety alerts are client-side pattern-matches, not stored in MongoDB"

**How to avoid:** The client-side safety detection component must POST to `/api/notify/safety-alert` when it detects an event. Alternatively, lift detection into the alerts API route and trigger emails there. The client-call approach is simpler and keeps detection co-located with the UI.

**Warning signs:** If you find yourself querying a `safety_events` MongoDB collection, it doesn't exist yet.

### Pitfall 2: Railway Cron — Process Must Exit

**What goes wrong:** If `process.exit(0)` is not called, the cron service stays "Active" and the next weekly run is silently skipped.

**Why it happens:** Railway does not forcefully terminate cron processes — it relies on the process to self-terminate.

**How to avoid:** Always end the cron script with `.then(() => process.exit(0)).catch(() => process.exit(1))`. Close any open handles (MongoDB connections, fetch agents).

**Warning signs:** Railway dashboard shows cron service status as "Active" 24+ hours after the scheduled time.

### Pitfall 3: Resend `from` Address Requires Verified Domain

**What goes wrong:** Using an arbitrary `from` address like `alerts@kidschat.app` will fail with Resend unless the domain `kidschat.app` has been verified (SPF + DKIM DNS records added).

**Why it happens:** Resend requires domain ownership verification before sending. The test address `onboarding@resend.dev` only works for test sends.

**How to avoid:** Verify the sending domain in the Resend dashboard before deploying. DNS propagation can take up to 48 hours. Document `RESEND_FROM_ADDRESS` as a required Railway env var. Use a subdomain like `notifications.yourdomain.com` to isolate sending reputation.

**Warning signs:** Resend API returns a 422 or domain-not-verified error on first deploy.

### Pitfall 4: Weekly Digest Emails to Wrong Recipients

**What goes wrong:** In this family system, ADMIN users are the parents/admins and USER role users are the children. Sending the digest to all `users` would email children their own stats.

**Why it happens:** The users collection has both roles; the code must filter by `role: "ADMIN"`.

**How to avoid:** Always query `{ role: "ADMIN" }` for notification recipients. Children never receive emails.

**Warning signs:** Child accounts have email addresses in the users collection — they will receive emails if the filter is wrong.

### Pitfall 5: Duplicate Safety Alert Emails

**What goes wrong:** Admin reviews alerts page, which scans 5000 messages and renders detected events. Each page load could trigger N alert emails for old events.

**Why it happens:** If the trigger is fired on every render of the alerts component rather than on first detection of a new event.

**How to avoid:** Store sent alert fingerprints in the `email_notifications` collection (`conversationId` + `matchedPattern` + date). Before sending, check if an alert for this exact conversation+pattern was already sent today. Skip if duplicate.

---

## Code Examples

Verified patterns from official sources:

### Resend SDK — Basic Send Pattern
```typescript
// Source: https://resend.com/docs/send-with-nextjs
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "KidsChat <alerts@yourdomain.com>",
  to: ["parent@example.com"],
  subject: "Safety Alert",
  react: MyEmailTemplate({ propA: "value" }), // function call, not JSX
});

if (error) {
  // error has { name, message, statusCode } shape
  console.error(error);
}
// data has { id: string } — the Resend message ID
```

### React Email — Full Template Structure
```typescript
// Source: https://react.email/docs/introduction
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Text
} from "@react-email/components";
import * as React from "react";

export function MyEmail({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Preview>Preview text shown in inbox</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "480px", margin: "40px auto" }}>
          <Heading>{name}</Heading>
          <Hr />
          <Text>Body text here</Text>
        </Container>
      </Body>
    </Html>
  );
}

// Development preview props (shown in react-email dev server)
MyEmail.PreviewProps = { name: "Test User" };
export default MyEmail;
```

### email_notifications Collection Schema
```typescript
// Stored in MongoDB for dedup + history UI
interface EmailNotificationRecord {
  _id: ObjectId;
  type: "safety_alert" | "weekly_digest";
  sentAt: Date;
  to: string[];               // recipient email addresses
  childName?: string;          // for safety alerts
  weekOf?: string;             // ISO date string for digest week
  resendId?: string;           // Resend message ID for tracking
  meta: Record<string, unknown>; // full payload for debugging
}
```

### notification_prefs on Users Collection
```typescript
// Field added to existing users documents
interface NotificationPrefs {
  safetyAlerts: boolean;     // default: true
  weeklyDigest: boolean;     // default: true
}
// Stored as: users.notification_prefs = { safetyAlerts: true, weeklyDigest: true }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nodemailer + SMTP | Resend SDK (API-based) | 2022-2023 | No SMTP config, better deliverability, built-in analytics |
| Hand-coded HTML emails | @react-email/components | 2022 | Maintainable TSX templates, cross-client compatibility |
| Vercel cron (vercel.json) | Railway cron service | N/A for this project | Project is on Railway, not Vercel |

**Deprecated/outdated:**
- `nodemailer`: Still works but requires SMTP credentials, no analytics, harder to configure deliverability
- Raw HTML email strings: Email client quirks require table-based layouts + inline styles — `@react-email/components` handles all of this

---

## Open Questions

1. **Parent email address source**
   - What we know: Admins have `role: "ADMIN"` in users collection; the parent IS the admin user who created the account
   - What's unclear: Whether a separate "parent email" field is needed or the admin user's own `email` field is the notification target
   - Recommendation: Use `role: "ADMIN"` users' email addresses. The family has one admin account, so this maps cleanly.

2. **Safety alert trigger point**
   - What we know: Detection is currently client-side in the admin dashboard's alerts panel
   - What's unclear: Whether to trigger from the browser (client calls API on detection) or lift detection to server
   - Recommendation: Client-side trigger is simpler — the alerts component already runs detection; add a `useEffect` that calls `/api/notify/safety-alert` for newly detected events not in the sent-history list.

3. **Sending domain**
   - What we know: Resend requires verified domain; the user has used Resend before
   - What's unclear: Which domain the user wants to send from
   - Recommendation: Add `RESEND_FROM_ADDRESS` as a required env var, documented with placeholder `alerts@yourdomain.com`. Domain must be verified in Resend dashboard before first deploy.

4. **Weekly digest — "topics"**
   - What we know: The analytics route already pulls preset usage (chatGptLabel on conversations) per child
   - What's unclear: Whether "topics" means conversation titles, presets, or something else
   - Recommendation: Use preset labels from `conversations.chatGptLabel` as "topics". This matches the existing analytics data model.

5. **Email preferences UI location**
   - What we know: There is an admin settings/users management page
   - What's unclear: Whether to add prefs on the Users page or a separate Settings page
   - Recommendation: Add a simple toggle on the Users edit dialog, stored as `notification_prefs` on the user document.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) + `tsx` |
| Config file | None — invoked directly via CLI |
| Quick run command | `npx tsx --test src/lib/__tests__/*.test.ts` |
| Full suite command | `npx tsx --test src/lib/__tests__/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIFY-01 | SafetyAlertEmail renders without throwing | unit | `npx tsx --test src/lib/__tests__/email-templates.test.ts` | Wave 0 |
| NOTIFY-02 | WeeklyDigestEmail renders without throwing | unit | `npx tsx --test src/lib/__tests__/email-templates.test.ts` | Wave 0 |
| NOTIFY-02 | Weekly digest aggregation returns per-child stats shape | unit | `npx tsx --test src/lib/__tests__/weekly-digest.test.ts` | Wave 0 |
| NOTIFY-03 | Railway cron script exits 0 on success, 1 on failure | manual | Manual Railway deploy + check exit code | manual-only |
| NOTIFY-04 | notification_prefs defaults present on new users | unit | `npx tsx --test src/lib/__tests__/weekly-digest.test.ts` | Wave 0 |
| NOTIFY-05 | email_notifications collection insert + query shape | unit | `npx tsx --test src/lib/__tests__/weekly-digest.test.ts` | Wave 0 |

Note: NOTIFY-03 (Railway cron) is manual-only — no automated test can exercise an actual Railway cron schedule. Test the cron script locally by running `node railway-cron/index.mjs` against a dev server.

### Sampling Rate

- **Per task commit:** `npx tsx --test src/lib/__tests__/email-templates.test.ts`
- **Per wave merge:** `npx tsx --test src/lib/__tests__/*.test.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/__tests__/email-templates.test.ts` — covers NOTIFY-01 and NOTIFY-02 (template rendering smoke tests using `@react-email/components` render utility)
- [ ] `src/lib/__tests__/weekly-digest.test.ts` — covers NOTIFY-02, NOTIFY-04, NOTIFY-05 (aggregation shape + notification record schema)

---

## Sources

### Primary (HIGH confidence)

- Resend official docs: https://resend.com/docs/send-with-nextjs — API route pattern, env vars, rate limits
- React Email official docs: https://react.email/docs/introduction — component API, template structure
- Railway cron docs: https://docs.railway.com/cron-jobs — scheduling, minimum frequency, process exit requirement
- Railway cron vs workers guide: https://docs.railway.com/guides/cron-workers-queues — confirmed cron is right choice for weekly digest

### Secondary (MEDIUM confidence)

- FreeCodeCamp tutorial (React Email + Resend in Next.js): https://www.freecodecamp.org/news/create-and-send-email-templates-using-react-email-and-resend-in-nextjs/ — cross-verified component usage with official docs
- Resend free tier limits article: https://resend.com/blog/new-free-tier — 3,000 emails/month, 100/day on free tier

### Tertiary (LOW confidence)

- Medium articles on Resend + Next.js integration (multiple authors) — consistent with official docs, not independently authoritative

---

## Metadata

**Confidence breakdown:**
- Standard stack (Resend + React Email): HIGH — verified via official docs and resend.com/docs
- Architecture (API routes, cron script): HIGH — verified via Railway docs and Resend docs
- Safety alert trigger point: MEDIUM — recommendation based on code analysis; no official pattern for "client-triggered transactional email" found, but the approach is sound
- Weekly digest aggregation: HIGH — reuses proven patterns from existing analytics route in this codebase
- Pitfalls: HIGH — pitfall 1 (client-side safety events) verified from STATE.md Phase 11 note; pitfall 2 (process.exit) verified from Railway docs; pitfalls 3-5 verified from Resend docs + code analysis

**Research date:** 2026-04-05
**Valid until:** 2026-07-05 (stable libraries — Resend and React Email APIs change infrequently)
