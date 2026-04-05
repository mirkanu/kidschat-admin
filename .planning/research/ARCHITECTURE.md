# Architecture Research

**Domain:** Next.js 15 admin dashboard — AI chatbot widget, prompt editor with Gist deploy, cost tracking (v2.2 integration)
**Researched:** 2026-04-04
**Confidence:** HIGH (based on direct codebase inspection + established Next.js App Router patterns)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Browser (Admin User)                              │
├────────────────────────────┬────────────────────────────────────────┤
│   Dashboard Pages (RSC)    │   Client Components (interactive)      │
│  /prompt-editor            │   AdminChatWidget (floating, global)   │
│  /analytics (cost section) │   PromptEditorClient                   │
│  /safety-rules (updated)   │   CostSummaryCard                      │
├────────────────────────────┴────────────────────────────────────────┤
│                     API Routes (Next.js)                            │
│  POST /api/admin-chat          <- AI chatbot (streaming)            │
│  GET  /api/admin-chat/context  <- assembles context snapshot        │
│  POST /api/prompt-editor/review <- AI reviews draft prompt          │
│  POST /api/prompt-editor/deploy <- pushes updated prompt to Gist    │
│  GET  /api/cost-estimate        <- message counts -> cost estimate  │
├─────────────────────────────────────────────────────────────────────┤
│                     Existing Infrastructure                         │
│  MongoDB (messages, conversations, users)  <- read-only for chatbot │
│  Anthropic SDK (already installed)         <- new models + streaming│
│  SYSTEM_PROMPT in src/lib/system-prompt.ts <- source of truth       │
│  GitHub Gist API                           <- prompt deploy target  │
│  NextAuth v5 session                       <- all routes auth-gated │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Type |
|-----------|----------------|------|
| `AdminChatWidget` | Floating bottom-right chatbot UI, manages conversation state | Client component |
| `GET /api/admin-chat/context` | Assembles read-only snapshot: system prompt, recent alerts, user count, usage summary | API route |
| `POST /api/admin-chat` | Receives messages + context, streams Claude Sonnet response | API route (streaming) |
| `PromptEditorClient` | Textarea editor, AI review trigger, test sandbox link, deploy button | Client component |
| `POST /api/prompt-editor/review` | Sends draft to Claude Sonnet for gap analysis, returns critique | API route |
| `POST /api/prompt-editor/deploy` | Validates session, PATCHes GitHub Gist with new prompt content | API route |
| `CostSummaryCard` | Renders estimated cost from message counts, links to Anthropic billing | Server or client component |
| `GET /api/cost-estimate` | Aggregates message counts by window, applies token pricing estimates | API route |

---

## Recommended Project Structure

New files added to the existing src/ tree:

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── prompt-editor/
│   │   │   ├── page.tsx                   # NEW: server component, loads current prompt
│   │   │   ├── loading.tsx                # NEW: skeleton (required by convention)
│   │   │   └── prompt-editor-client.tsx   # NEW: editor + review + deploy UI
│   │   └── analytics/
│   │       └── page.tsx                   # MODIFIED: add cost section/tab
│   └── api/
│       ├── admin-chat/
│       │   ├── route.ts                   # NEW: streaming chat endpoint
│       │   └── context/
│       │       └── route.ts               # NEW: assembles context snapshot
│       ├── prompt-editor/
│       │   ├── review/
│       │   │   └── route.ts               # NEW: AI prompt review
│       │   └── deploy/
│       │       └── route.ts               # NEW: push to GitHub Gist
│       └── cost-estimate/
│           └── route.ts                   # NEW: message count to cost estimate
├── components/
│   ├── dashboard/
│   │   ├── admin-chat-widget.tsx          # NEW: floating chatbot widget (client)
│   │   ├── cost-summary-card.tsx          # NEW: cost display card
│   │   └── dashboard-shell.tsx            # MODIFIED: add AdminChatWidget here
│   └── ui/
│       └── textarea.tsx                   # NEW if missing: shadcn textarea
└── lib/
    ├── system-prompt.ts                   # EXISTING: source of truth (read by new routes)
    ├── cost-estimates.ts                  # NEW: token pricing constants + calculator
    └── gist-client.ts                     # NEW: GitHub Gist API wrapper
```

### Structure Rationale

- **`prompt-editor/` route:** Follows existing dashboard pattern (page.tsx + loading.tsx + -client.tsx). The server component imports `SYSTEM_PROMPT` directly — no async fetch needed for the initial value.
- **`api/admin-chat/context/` as separate route:** Context assembly involves MongoDB reads. Decoupled from the streaming chat route so the widget can fetch it once on open, then reuse the snapshot across the conversation without re-querying on every message.
- **`lib/gist-client.ts`:** Isolates GitHub API calls. Accepts `GIST_ID` and `GITHUB_PAT` from env. Keeps the deploy route thin and testable.
- **`lib/cost-estimates.ts`:** Centralizes pricing constants. Easy to update when Anthropic changes rates. Pure calculation on message counts — no external API calls.
- **`dashboard-shell.tsx` (modified):** Widget added here so it appears on all dashboard pages without each page knowing about it. `DashboardShell` is already a client component (`"use client"` for sidebar state), so no new client boundary is created.

---

## Architectural Patterns

### Pattern 1: Floating Widget Mounted in Shell

**What:** `AdminChatWidget` renders as a fixed-position element inside `DashboardShell`, alongside `<Toaster />`. It never participates in the page layout flow.

**When to use:** Any persistent UI that must appear on all authenticated pages without each individual page including it.

**Trade-offs:** Shell is already a client component, so the widget adds no new bundle boundary. Widget manages its own open/collapsed state with local `useState`. No global state needed.

```typescript
// dashboard-shell.tsx (modified section only)
export function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen bg-background">
      <NavSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Toaster />
      <AdminChatWidget />  {/* Added: fixed-position, no layout impact */}
    </div>
  );
}
```

### Pattern 2: Context-Prefetch Then Stream

**What:** When the widget opens, fetch `/api/admin-chat/context` once to receive a JSON snapshot (system prompt text, recent alert summary, user list, 24h usage). Pass this snapshot as part of the system message for every subsequent chat turn to `/api/admin-chat`.

**When to use:** When the AI needs live data but repeatedly querying MongoDB per message turn would add unnecessary latency and load.

**Trade-offs:** Context is a point-in-time snapshot (taken at widget open). This is acceptable — the admin is viewing live dashboard data alongside the chatbot. Refreshes on each widget open.

```typescript
// api/admin-chat/route.ts
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, context } = await request.json();
  const systemMessage = buildAdminSystemPrompt(context); // pure function, uses snapshot

  const client = new Anthropic();
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6-20251001",
    max_tokens: 2048,
    system: systemMessage,
    messages,
  });

  return new Response(stream.toReadableStream()); // Server-Sent Events
}
```

### Pattern 3: Server Component Passes Prompt to Client Editor

**What:** The `/prompt-editor` page is a server component that imports `SYSTEM_PROMPT` from `system-prompt.ts` and passes it as a prop to `PromptEditorClient`. No async fetch needed.

**When to use:** Any editor page where the initial data is available at server render time as an imported constant.

**Trade-offs:** The "current" prompt displayed in the editor is the TypeScript constant, not the Gist content. This is consistent with the established architecture decision ("Hardcoded system prompt in dashboard — Rarely changes"). After a deploy to Gist, the admin should also update `system-prompt.ts` manually (or the deploy route can handle this as a code change).

```typescript
// app/(dashboard)/prompt-editor/page.tsx
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import PromptEditorClient from "./prompt-editor-client";

export default function PromptEditorPage() {
  return <PromptEditorClient initialPrompt={SYSTEM_PROMPT} />;
}
```

### Pattern 4: Cost Estimation Without External API Calls

**What:** `GET /api/cost-estimate` queries MongoDB for message counts (same aggregate pattern already used in `/api/analytics`), applies Claude Haiku pricing constants from `lib/cost-estimates.ts`, and returns dollar estimates. No Anthropic billing API call.

**When to use:** Cost visibility for oversight purposes where approximate figures are sufficient and availability must be guaranteed.

**Trade-offs:** Estimates only — actual costs depend on per-message token lengths which are not stored. Display clearly as "estimated" in the UI with a direct link to the Anthropic console for exact numbers. Pricing constants need manual update when Anthropic changes rates.

---

## Data Flow

### Admin Chatbot Flow

```
Admin clicks floating widget button
    |
AdminChatWidget opens
    | GET /api/admin-chat/context
    | (returns JSON: systemPrompt, recentAlerts, userCount, usageSummary)
    |
Admin types question
    | POST /api/admin-chat { messages: [...], context: {...} }
    |
API route: auth check
    | build system prompt from context snapshot
    | Anthropic.messages.stream({ model: "claude-sonnet-4-6-...", ... })
    |
Server-Sent Events stream back to browser
    |
AdminChatWidget: reads chunks -> appends tokens -> renders incrementally
```

### Prompt Editor Flow

```
Admin navigates to /prompt-editor
    |
Server component renders with SYSTEM_PROMPT as initialPrompt prop
    |
PromptEditorClient mounts with current prompt in textarea
    |
Admin edits draft text
    |
Admin clicks "AI Review"
    | POST /api/prompt-editor/review { draft }
    | API: auth check -> Claude Sonnet analyzes draft -> returns critique
    |
PromptEditorClient shows critique panel beside editor
    |
Admin satisfied -> clicks "Test in Sandbox"
    | opens /test-mode with draft injected via URL param or sessionStorage
    OR
Admin satisfied -> clicks "Deploy to Gist"
    | POST /api/prompt-editor/deploy { draft }
    | API: auth check -> gistClient.patch(GIST_ID, draft) -> return success
    |
PromptEditorClient: success toast + reminder to update system-prompt.ts
```

### Cost Tracking Flow

```
Admin navigates to /analytics (cost section visible)
    |
CostSummaryCard client component mounts
    | GET /api/cost-estimate?window=30d
    |
API: auth check
    | MongoDB aggregate: count messages by day (same pattern as analytics route)
    | costEstimates.calculate(messageCount) -> estimatedUSD
    | return { estimatedCostUSD, messageCount, window, pricingAsOf }
    |
CostSummaryCard renders:
    - Estimated total in USD
    - Message count breakdown
    - "View exact billing" link to console.anthropic.com/usage
```

---

## Integration Points

### New vs Existing — Explicit Breakdown

| Item | Status | Integration Method |
|------|--------|--------------------|
| `DashboardShell` | MODIFIED | Add `<AdminChatWidget />` as fixed-position sibling of `<Toaster />` |
| `NavSidebar` nav items | MODIFIED | Add "Prompt Editor" link with suitable icon (e.g. `PenLine`) |
| `SYSTEM_PROMPT` in `system-prompt.ts` | EXISTING — read by new code | Imported in `/prompt-editor` page (server) and `/api/admin-chat/context` |
| Anthropic SDK | EXISTING — extend usage | Add `claude-sonnet-4-6-20251001` model; add streaming via `messages.stream()` |
| `/api/test-chat` pattern | REFERENCE — not modified | New chat routes follow the same auth + SDK structure |
| MongoDB `messages` collection | EXISTING — read-only new access | Cost estimate route uses same aggregate pattern as `/api/analytics` |
| `test-mode-client.tsx` UI pattern | REFERENCE — not modified | Admin chat widget reuses message bubble + loading dots UI approach |
| `/analytics` page | MODIFIED | Add `CostSummaryCard` as a new section below existing analytics |
| `/safety-rules` page | OPTIONALLY MODIFIED | Add link to `/prompt-editor` for admins who want to update the displayed rules |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Gist API | `PATCH https://api.github.com/gists/{id}` with `Authorization: token {PAT}` | Needs `GIST_ID` and `GITHUB_PAT` env vars; PAT requires `gist` scope only |
| Anthropic API (chat) | Existing SDK, add streaming + sonnet model | `ANTHROPIC_API_KEY` already in environment |
| Anthropic Console (billing) | Link only (`console.anthropic.com/usage`) | No API integration — link out only |

### Environment Variables (new additions)

| Variable | Purpose | Required For |
|----------|---------|-------------|
| `GITHUB_PAT` | GitHub Personal Access Token with `gist` scope | Prompt deploy |
| `GIST_ID` | The Gist ID hosting `librechat.yaml` (already exists as documented URL) | Prompt deploy |

---

## Build Order

Build in this sequence. Each step produces shippable, testable functionality and later steps depend on patterns established earlier.

### Step 1: Cost Tracking

Entirely self-contained. New API route + new card component. Uses the existing MongoDB aggregate pattern from `/api/analytics`. No new external services. Ship and verify independently before building anything else.

Deliverables:
- `lib/cost-estimates.ts` — pricing constants and calculation function
- `GET /api/cost-estimate` — aggregate query returning estimate
- `CostSummaryCard` component — renders estimate + billing link
- Wire into `/analytics` page as a new section

### Step 2: Admin Chat Widget

Anthropic SDK is already installed. New API routes (context fetch + streaming chat) follow patterns from `/api/test-chat`. New client component follows patterns from `test-mode-client.tsx`.

Deliverables:
- `GET /api/admin-chat/context` — builds system context snapshot
- `POST /api/admin-chat` — streaming chat route (sonnet model)
- `AdminChatWidget` client component — floating button + expandable panel
- Modify `DashboardShell` to mount the widget
- Verify widget appears on all dashboard pages

### Step 3: Prompt Editor

Most complex piece: editor UI, AI review (same streaming patterns from Step 2), Gist deploy (new external service call via `gist-client.ts`). Build last when patterns are established and Gist credentials can be tested.

Deliverables:
- `lib/gist-client.ts` — GitHub Gist PATCH wrapper
- `POST /api/prompt-editor/review` — AI review call
- `POST /api/prompt-editor/deploy` — Gist push
- `PromptEditorClient` — editor + critique panel + deploy button
- `/prompt-editor` page route (server component wrapper + loading.tsx)
- Add nav link in `NavSidebar`
- Optionally add "Edit Safety Rules" link on `/safety-rules` page

---

## Anti-Patterns

### Anti-Pattern 1: Widget as Page-Level Component

**What people do:** Import and render `AdminChatWidget` in each individual page file.

**Why it's wrong:** Must appear on all 7+ existing pages. Each new page added in the future also needs it. Forgetting one page creates an inconsistent experience.

**Do this instead:** Mount once in `DashboardShell`. It renders on every authenticated dashboard page automatically.

### Anti-Pattern 2: Fetching System Prompt from Gist on Each Chat Turn

**What people do:** Have the admin chat route call the GitHub Gist API on each request to get the "live" prompt.

**Why it's wrong:** Adds 100-300ms per chat message, creates a Gist API dependency in the hot path, and the prompt changes rarely. Rate limits on GitHub API become a concern.

**Do this instead:** Import `SYSTEM_PROMPT` from `system-prompt.ts` in the context route. TypeScript module caching makes this effectively free. Prompt changes require a code deploy — consistent with how this project already works.

### Anti-Pattern 3: Storing Prompt Drafts in MongoDB

**What people do:** Create a `prompt_drafts` collection to persist in-progress edits between browser sessions.

**Why it's wrong:** Overkill for a two-admin app. Introduces schema migration risk. Drafts are invalidated by any code deploy anyway.

**Do this instead:** Draft lives in React state in `PromptEditorClient`. If the admin refreshes, they start from the current deployed prompt as the baseline. This is how the test mode sandbox already works.

### Anti-Pattern 4: Blocking Cost Display Behind Anthropic's Billing API

**What people do:** Attempt to call `api.anthropic.com/v1/usage` or similar for real cost data.

**Why it's wrong:** Anthropic does not expose a programmatic billing API for account usage. The console link is the intended path.

**Do this instead:** Calculate estimates from message counts in MongoDB using known per-token pricing from `lib/cost-estimates.ts`. Label clearly as "estimated" in the UI, link out to the console for exact figures.

### Anti-Pattern 5: Non-Streaming Admin Chat

**What people do:** Use the same blocking request/response pattern from `/api/test-chat` (collects full response, then returns it).

**Why it's wrong:** Admin questions like "summarize this week's conversation trends" trigger long Claude Sonnet responses. Waiting 3-5 seconds for the first token is poor UX and violates the perceived performance conventions in CLAUDE.md.

**Do this instead:** Use `client.messages.stream()` and return a `ReadableStream`. The widget reads chunks with a `ReadableStreamDefaultReader` and appends tokens as they arrive.

### Anti-Pattern 6: Deploying to Gist Without Validating the Draft

**What people do:** Allow the deploy button to be active and actionable even when the draft has not been reviewed.

**Why it's wrong:** A malformed or incomplete system prompt deployed to the Gist could weaken children's safety guardrails until the next fix. Deployment should require intentional acknowledgment.

**Do this instead:** Require the AI review to complete before the deploy button becomes active. Show a diff between the current prompt and the draft before the final confirmation.

---

## Scaling Considerations

This app serves 2 parents as admins. Scaling is not a concern for v2.2. The patterns chosen are appropriate for this scale indefinitely.

| Scale | Consideration |
|-------|---------------|
| Current (2 admins) | All patterns above are correct — no optimization needed |
| If prompt editing becomes frequent | Consider persisting the deployed prompt text in MongoDB so `system-prompt.ts` is not the only source of truth and the editor always reflects the Gist content |
| If cost tracking needs precision | Anthropic may expose a programmatic usage API in the future — `gist-client.ts` pattern can be replicated for an `anthropic-usage-client.ts` |

---

## Sources

- Direct codebase inspection: `/data/home/KidAI/src/` — HIGH confidence
- Existing `/api/test-chat/route.ts` — reference for new streaming chat routes
- Existing `DashboardShell` component — confirms widget placement approach
- Existing `/api/analytics/route.ts` — confirms MongoDB aggregate pattern for cost route
- GitHub Gist REST API `PATCH /gists/{gist_id}` — standard, stable endpoint; MEDIUM confidence (pattern unchanged for years, verified against GitHub docs conventions)
- Anthropic SDK `messages.stream()` — available in `@anthropic-ai/sdk` as installed; HIGH confidence

---
*Architecture research for: KidAI admin dashboard v2.2 — AI chatbot, prompt editor, cost tracking*
*Researched: 2026-04-04*
