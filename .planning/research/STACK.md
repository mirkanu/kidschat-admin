# Stack Research

**Domain:** Admin dashboard intelligence — AI chatbot widget, system prompt editor with GitHub Gist deploy, Anthropic cost tracking
**Milestone:** v2.2 Admin Intelligence (additive to existing Next.js 15 admin dashboard)
**Researched:** 2026-04-04
**Confidence:** HIGH

---

## Context: What Already Exists (Do Not Re-Research)

The admin dashboard already has these packages. They are validated, deployed, and working:

- `@anthropic-ai/sdk ^0.82.0` — Anthropic SDK, used in `/api/test-chat` route
- `next ^15.5.14` + `react ^19.2.4` — Core framework
- `next-auth ^5.0.0-beta.30` — Auth wrapping all admin routes
- `mongodb ^7.1.1` — Database, direct queries via `lib/mongodb.ts`
- `shadcn/ui` components: button, card, dialog, sheet, input, skeleton, sonner, table, badge, avatar, accordion
- `sonner ^2.0.7` — Toast notifications
- `motion ^12.38.0` — Framer Motion animations
- `lucide-react ^1.7.0` — Icons
- `recharts ^3.8.1` — Charts (already used in analytics)
- `tailwindcss ^3.4.19` — Styling

**The existing `/api/test-chat` route already demonstrates the Anthropic SDK pattern.** v2.2 extends this pattern — it does not introduce a new integration approach.

---

## New Capabilities and Stack Decisions

### Feature 1: AI Admin Chatbot Widget (Bottom-Right Float, Streaming)

**Problem:** A non-streaming chatbot creates 2–5 seconds of dead UI while Claude Sonnet generates a response. This feels broken.

**Solution: Stream tokens using `@anthropic-ai/sdk` native streaming — no new package.**

The existing SDK (`^0.82.0`) supports streaming via `client.messages.create({ stream: true })`, which returns an async iterable of server-sent events. Pipe it into a `ReadableStream` returned from the Next.js route handler.

Route handler pattern (verified against official Anthropic streaming docs):

```typescript
// /api/admin-chat/route.ts
const response = await client.messages.create({
  model: "claude-sonnet-4-6-20260217",
  max_tokens: 2048,
  system: ADMIN_SYSTEM_PROMPT,
  messages,
  stream: true,
});

const readable = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    for await (const chunk of response) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        controller.enqueue(encoder.encode(chunk.delta.text));
      }
    }
    controller.close();
  },
});

return new Response(readable, {
  headers: { "Content-Type": "text/plain; charset=utf-8" },
});
```

Client reads with `fetch` + `response.body.getReader()`, appending chunks to React state on each iteration.

**Why NOT Vercel AI SDK (`ai` package)?** The project is Anthropic-only. The Vercel AI SDK adds ~200KB bundle weight, a new mental model (`useChat` hook, `streamText`, provider adapters), and a provider abstraction that provides zero benefit here. The native pattern above is ~20 lines, has no new dependencies, and produces identical UX. MEDIUM confidence in bundle size estimate from comparative articles; HIGH confidence in "unnecessary abstraction" rationale.

**Model for admin chatbot:** `claude-sonnet-4-6-20260217` — Sonnet 4.6 (not Haiku). The admin chatbot needs to reason about logs, explain patterns, and assess prompt quality. Haiku would produce shallower analysis. The admin widget is used by 2 parents infrequently — cost impact is negligible.

### Feature 2: System Prompt Editor with GitHub Gist Deploy

**Problem:** The system prompt lives in `lib/system-prompt.ts` (hardcoded) and separately in the GitHub Gist (`e23b999f1d3cd77726a97c20e26f0abf`) as `librechat.yaml`. Editing requires code changes + redeploy for the dashboard, and manual Gist editing for LibreChat.

**Solution: Dashboard editor that PATCHes the Gist via GitHub REST API — native `fetch`, no new package.**

The GitHub REST API PATCH endpoint for updating a Gist:
- URL: `PATCH https://api.github.com/gists/{gist_id}`
- Headers: `Authorization: Bearer {GITHUB_TOKEN}`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`
- Body: `{ "files": { "librechat.yaml": { "content": "..." } } }`
- Returns 200 with updated Gist object on success

This is a single `fetch()` call from a Next.js server action or route handler. Verified against official GitHub REST API docs (HIGH confidence).

**New secret required:** `GITHUB_TOKEN` — a GitHub Personal Access Token (classic) with `gist` scope. This is the only new environment variable for v2.2.

**Important known constraint (from PROJECT.md):** LibreChat requires a redeploy after the Gist is updated to pick up `CONFIG_PATH` changes. The editor UI must communicate this clearly — show a "Redeploy Required" notice after a successful Gist push. The Railway CLI redeploy command is available for automating this step.

**Why NOT Octokit (`@octokit/rest`)?** A single PATCH call does not justify ~80KB of Octokit. Native `fetch` is available in Node.js 18+ (which Next.js 15 requires) and is straightforward to read and maintain.

### Feature 3: Anthropic Token and Cost Tracking

**Problem:** Parents want to see estimated API costs in the dashboard without leaving to the Anthropic Console.

**Two-tier approach — Approach A is sufficient for v2.2:**

#### Approach A: Response-Level Token Counting (PRIMARY — implement in v2.2)

Every `client.messages.create()` response already includes `response.usage.input_tokens` and `response.usage.output_tokens`. The current `/api/test-chat` discards these. v2.2 captures and stores them.

Store per-call usage in a new MongoDB collection `usage_events`:
```typescript
// After each Anthropic API call
await db.collection("usage_events").insertOne({
  model: "claude-haiku-4-5-20251001" | "claude-sonnet-4-6-20260217",
  input_tokens: response.usage.input_tokens,
  output_tokens: response.usage.output_tokens,
  source: "children_chat" | "admin_test" | "admin_chatbot" | "prompt_review",
  userId: session.user.id,   // for children's chat; null for admin
  timestamp: new Date(),
});
```

Aggregate daily/weekly for the dashboard using MongoDB `$group` + `$sum`. Multiply by token rates to estimate USD cost.

**No new package.** `response.usage` is already in every Anthropic SDK response object. The only work is storing it and querying it.

#### Approach B: Anthropic Usage & Cost Admin API (DEFER — not v2.2)

Anthropic provides `/v1/organizations/usage_report/messages` and `/v1/organizations/cost_report` REST endpoints for organization-level usage aggregation. However, these require:
- An **Admin API key** starting with `sk-ant-admin...` (different from `ANTHROPIC_API_KEY`)
- The Anthropic account must be an **organization** (not individual)
- Only organization admins can provision Admin API keys via Anthropic Console

For a family app billed as an individual account, the Admin API may not be available. Approach A (response-level counting) provides equivalent data for this use case. Anthropic Console billing at `https://console.anthropic.com/usage` remains the authoritative source; add a direct link to it in the dashboard.

---

## New shadcn Components Needed

Two shadcn components are not yet installed but are needed for v2.2:

| Component | Purpose | Install Command |
|-----------|---------|----------------|
| `scroll-area` | Scrollable message history in the chatbot widget | `npx shadcn@latest add scroll-area` |
| `textarea` | Multi-line input for the system prompt editor | `npx shadcn@latest add textarea` |

Existing `input.tsx` is single-line only. `textarea` is a separate shadcn component.

`scroll-area` uses `@radix-ui/react-scroll-area` under the hood. Check `package.json` before installing — if the Radix package is already present it will not be duplicated.

---

## Complete Stack Summary for v2.2

### New npm packages: NONE

All three v2.2 features are implemented with:
- Existing `@anthropic-ai/sdk ^0.82.0` (streaming + token capture)
- Native `fetch` built into Node.js 18+ (GitHub Gist PATCH)
- Existing `mongodb ^7.1.1` (usage_events collection)
- Two new shadcn components added via `npx shadcn@latest add` (not npm installs)

### New environment variables: 1

| Variable | Purpose | How to Get |
|----------|---------|------------|
| `GITHUB_TOKEN` | Authenticate GitHub Gist PATCH requests | GitHub Settings → Developer Settings → Personal Access Tokens → Classic → check `gist` scope |

All other required secrets (`ANTHROPIC_API_KEY`, `MONGODB_URI`, `NEXTAUTH_SECRET`) already exist in Railway.

### New MongoDB collection: 1

| Collection | Schema | Purpose |
|-----------|--------|---------|
| `usage_events` | `{ model, input_tokens, output_tokens, source, userId, timestamp }` | Per-call token tracking for cost estimation |

---

## Model IDs for v2.2

| Use Case | Model ID | Pricing (2026) |
|----------|----------|----------------|
| Admin chatbot widget | `claude-sonnet-4-6-20260217` | $3.00/M input, $15.00/M output |
| System prompt AI review | `claude-sonnet-4-6-20260217` | Same |
| Children's chat (existing) | `claude-haiku-4-5-20251001` | $1.00/M input, $5.00/M output |

Note: The exact API model string for Sonnet 4.6 should be verified against the Anthropic models list before implementation. The SDK returns a clear 400 error if the model string is wrong — easy to detect in dev.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ai` (Vercel AI SDK) | 200KB bundle, new abstraction layer, zero benefit for single-provider app | `@anthropic-ai/sdk` native streaming |
| `@octokit/rest` or `@octokit/core` | ~80KB for a single API call | Native `fetch` |
| `langchain` | Massive dependency tree, no RAG/agent workflows needed | Direct Anthropic SDK |
| Third-party cost tracking (Datadog, CloudZero) | Overkill for 4-user family app | MongoDB aggregation on `usage_events` |
| Separate Anthropic Admin API key | Requires org setup in Anthropic Console, separate key rotation, may not be available for individual accounts | Response-level `response.usage` counting |
| `react-markdown` | Not needed unless chatbot responses contain Markdown to render | Plain text with `whitespace-pre-wrap` CSS is sufficient for admin chat |

---

## Integration Checklist for Implementation

- [ ] `GITHUB_TOKEN` env var added to Railway (kidschat-admin service)
- [ ] `/api/admin-chat/route.ts` created with streaming + auth guard
- [ ] `lib/admin-system-prompt.ts` created with context-aware system prompt for admin chatbot
- [ ] `/api/gist-deploy/route.ts` (or server action) created for PATCH to Gist
- [ ] `usage_events` MongoDB collection written to after each API call
- [ ] `npx shadcn@latest add scroll-area textarea` run in project root
- [ ] Cost estimate formula hardcoded: Haiku = $1/$5 per M tokens, Sonnet = $3/$15 per M tokens

---

## Version Compatibility

| Package | Current Version | Notes |
|---------|----------------|-------|
| `@anthropic-ai/sdk` | `^0.82.0` | `create({ stream: true })` returns async iterable in this version. `response.usage` present in all non-streaming responses. HIGH confidence. |
| GitHub REST API | `2022-11-28` | PATCH /gists/{id} is a stable, versioned endpoint. No compatibility concerns. HIGH confidence. |
| `shadcn scroll-area` | latest | Wraps `@radix-ui/react-scroll-area`. Check if Radix package already installed before running `npx shadcn@latest add`. |
| Next.js | `^15.5.14` | Route handlers support `new Response(ReadableStream)` natively. Node.js 18+ fetch is available. HIGH confidence. |

---

## Sources

- [Anthropic Streaming Messages Docs](https://platform.claude.com/docs/en/api/messages-streaming) — Verified TypeScript streaming API pattern: `create({ stream: true })` async iterable, `content_block_delta` event type (HIGH confidence)
- [Anthropic Usage & Cost API](https://platform.claude.com/docs/en/build-with-claude/usage-cost-api) — Confirmed Admin API requires org + admin key; response-level `usage` field is the simpler per-call approach (HIGH confidence)
- [GitHub REST API — Gists PATCH](https://docs.github.com/en/rest/gists/gists) — Verified PATCH endpoint, auth headers, request/response schema (HIGH confidence)
- [Anthropic Pricing 2026](https://platform.claude.com/docs/en/about-claude/pricing) — Sonnet 4.6: $3/$15 per M tokens; Haiku 4.5: $1/$5 per M tokens (HIGH confidence)
- [Claude Sonnet 4.6 release](https://www.anthropic.com/news/claude-sonnet-4-6) — Released February 17, 2026; model available via API (HIGH confidence)
- [Vercel AI SDK vs direct Anthropic SDK comparison](https://strapi.io/blog/openai-sdk-vs-vercel-ai-sdk-comparison) — Confirms AI SDK provides multi-provider abstraction unnecessary for single-provider apps (MEDIUM confidence)

---

*Stack research for: KidAI v2.2 Admin Intelligence — chatbot widget, Gist deploy, cost tracking*
*Researched: 2026-04-04*
