# Project Research Summary

**Project:** KidAI v2.2 Admin Intelligence
**Domain:** Admin dashboard intelligence layer — AI chatbot widget, system prompt editor with Gist deploy, Anthropic cost tracking
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

KidAI v2.2 adds an intelligence layer to an existing, deployed Next.js 15 admin dashboard for a children's AI chat application. The three features — a floating AI admin chatbot, a system prompt editor with GitHub Gist deployment, and token-based cost tracking — are all additive to a working codebase that already has the Anthropic SDK, MongoDB, NextAuth, and shadcn/ui in place. No new npm packages are required: streaming uses the existing `@anthropic-ai/sdk`, Gist deployment uses native `fetch`, and cost tracking uses the existing MongoDB connection. The only new environment variable is `GITHUB_TOKEN` for the Gist PATCH API. Two shadcn components need `npx shadcn@latest add` installation (`scroll-area`, `textarea`), and a new `usage_events` MongoDB collection is created.

The recommended build order is Cost Tracking first (zero external dependencies, self-contained), then Admin Chatbot (extends existing SDK patterns with streaming), then Prompt Editor (most complex, builds on patterns from prior phases). This order emerges directly from the dependency graph: cost tracking touches only existing MongoDB data; the chatbot introduces the streaming API route pattern that the prompt editor's AI review step reuses; the prompt editor's Gist deploy is the only truly new external service integration.

The dominant risk in this milestone is security, not technical complexity. Three pitfalls require upfront design decisions — they cannot be retrofitted after the feature ships. First, the admin chatbot is vulnerable to indirect prompt injection if it reads child conversation logs without explicit trust framing in the system prompt. Second, the GitHub Gist token must never reach the client bundle and must use a fine-grained PAT scoped to Gist operations only. Third, the prompt deploy pipeline must include YAML validation client-side and a one-click rollback mechanism — a broken system prompt deployed to the Gist weakens children's safety guardrails until manually reverted. All three of these must be addressed in the initial implementation of their respective phases.

## Key Findings

### Recommended Stack

All three v2.2 features are built on the existing stack with no new npm dependencies. The Anthropic SDK's streaming API (`client.messages.stream()`) returns a `ReadableStream` directly compatible with Next.js 15 route handlers. GitHub's Gist PATCH endpoint is a single native `fetch()` call authenticated with a fine-grained PAT. Cost estimation runs as a MongoDB aggregation on the existing `messages` collection — the same pattern already in use in `/api/analytics`.

**Core technologies:**
- `@anthropic-ai/sdk ^0.82.0` (already installed): streaming chat + token capture — use `stream: true` with async iterable; `response.usage` captures per-call token counts
- Native `fetch` (Node.js 18+, built in): GitHub Gist PATCH — a single call; no Octokit overhead
- `mongodb ^7.1.1` (already installed): cost aggregation on `messages` + new `usage_events` collection for per-call tracking
- `recharts ^3.8.1` (already installed): cost visualization — already in use in analytics, reuse without change
- `shadcn scroll-area` + `shadcn textarea`: two new UI components via `npx shadcn@latest add`, not npm installs

**Models used:**
- `claude-haiku-4-5-20251001` — children's chat (existing, $1/$5 per M tokens)
- `claude-sonnet-4-6-20260217` — admin chatbot + prompt review (new, $3/$15 per M tokens); Sonnet is correct for admin use — higher reasoning quality justifies the cost for a tool used by 2 parents infrequently

**What not to add:**
- Vercel AI SDK (`ai` package): adds ~200KB bundle, multi-provider abstraction that adds zero value for a single-provider app
- Octokit: ~80KB for what is a single PATCH call
- Anthropic Admin API: requires org-level account; individual accounts cannot access it; response-level `usage` field is equivalent

### Expected Features

The three v2.2 features each have a clear MVP definition with deferred enhancements.

**Must have (table stakes for v2.2 launch):**
- AI chatbot widget — floating button (fixed bottom-right), streaming responses, session message history, system prompt + user list injected as context snapshot at widget open
- Admin-only role check on all new API routes — `requireAdminSession()` utility checking both session existence and `role === 'ADMIN'`
- Indirect prompt injection hardening — all retrieved conversation log data framed as "UNTRUSTED USER-GENERATED CONTENT" in the chatbot system prompt
- System prompt editor — loads current prompt, AI review (non-blocking, advisory), deploy to Gist with confirmation modal
- YAML validation before any Gist push — syntax errors block deploy with a specific error message
- One-click rollback — current Gist content saved to MongoDB before every deploy; "Revert to Previous" button present at launch
- Required-section checklist in AI reviewer — AI review must check for presence of specific required sections (jailbreak resistance, content rules, tone), not just holistic evaluation
- Cost tracking — estimated cost this month from message counts, per-model breakdown (Haiku vs Sonnet tracked separately), direct link to Anthropic billing console
- Cost estimate uses token-estimate formula (not flat per-message rate): `(system_prompt_tokens + input_chars/4) * $0.000001 + (output_chars/4) * $0.000005`

**Should have (add after initial validation):**
- Suggested prompt chips in chatbot widget (3-4 example questions shown on open)
- Diff view in prompt editor (current vs. proposed before deploy) — recommended to include given the safety sensitivity of the deploy action
- Per-child cost breakdown (group message counts by userId)

**Defer to v2.3+:**
- Admin chatbot live MongoDB queries on demand — static context snapshot is sufficient; live queries add significant complexity
- Deploy history with full rollback UI — manual Gist revert works for now
- Anthropic Usage API integration — requires org-level Admin API key, unavailable for individual accounts
- Chatbot conversation persistence across sessions — session-only history is sufficient for one admin

**Anti-features (explicitly excluded):**
- Admin chatbot with write capabilities — read-only only; this bounds the blast radius of any indirect prompt injection
- AI reviewer as a blocking gate on deploy — parent is the authority; review is advisory; parent must be able to deploy with explicit "Deploy Anyway" override if issues found

### Architecture Approach

The architecture is purely additive to the existing codebase. Two existing components are modified (`DashboardShell` to mount the global chatbot widget, `NavSidebar` to add Prompt Editor link), one existing page is extended (`/analytics` gets a cost section), and all new API routes follow the pattern established by the existing `/api/test-chat` route. The admin chatbot widget is mounted once in `DashboardShell` (already a client component) so it appears on all authenticated dashboard pages automatically — no per-page import needed. Context for the chatbot is fetched once on widget open via a dedicated `/api/admin-chat/context` route, then reused across the conversation — avoiding MongoDB queries on every message turn.

**Major components:**
1. `AdminChatWidget` (client component, mounted in DashboardShell) — fixed-position floating button, open/close, message history, streaming reader
2. `GET /api/admin-chat/context` — assembles read-only context snapshot (system prompt text, user list, 7-day alert count, 24h message count); fetched once on widget open
3. `POST /api/admin-chat` — auth-guarded streaming route; builds system prompt from context snapshot, streams Claude Sonnet response
4. `PromptEditorClient` + `/prompt-editor` page — server component passes current `SYSTEM_PROMPT` constant as prop to client editor; client handles edit, review, and deploy
5. `POST /api/prompt-editor/review` + `POST /api/prompt-editor/deploy` — AI critique with required-section checklist; Gist PATCH via `lib/gist-client.ts`
6. `lib/gist-client.ts` — isolated GitHub API wrapper; reads `GITHUB_GIST_TOKEN` from env server-side only
7. `CostSummaryCard` + `GET /api/cost-estimate` — MongoDB aggregation → token estimate → cost display in `/analytics`
8. `lib/cost-estimates.ts` — pricing constants and calculator; easy to update when Anthropic changes rates

### Critical Pitfalls

1. **Indirect prompt injection via conversation logs** (OWASP LLM01:2025) — Children can embed hidden instructions in LibreChat messages that manipulate the admin chatbot when it reads those logs. Prevention: frame all retrieved log data as "UNTRUSTED USER-GENERATED CONTENT" in the system prompt; keep the chatbot read-only with no write API access; never quote raw message content verbatim in responses. Must be in the initial Phase 2 implementation — cannot be retrofitted.

2. **Broken prompt deployed with no rollback** — A subtly wrong system prompt (bad YAML, missing required section, AI reviewer false-positive approval) weakens children's safety guardrails until manually reverted via GitHub UI + Railway redeploy. Prevention: save current Gist content to MongoDB before every deploy (enabling one-click revert); require YAML validation client-side before any Gist push; AI reviewer must check a required-section checklist (not just holistic review — LLMs show >95% acceptance rates in review tasks). Both the rollback mechanism and the required-section checklist must be present at Phase 3 launch.

3. **GitHub Gist token exposed in client bundle** — Using a `NEXT_PUBLIC_GITHUB_TOKEN` env var prefix or placing Gist update logic in a client component exposes the PAT in the browser bundle. Prevention: use a fine-grained PAT with Gist-only scope (not classic PAT with repo scope), store as `GITHUB_GIST_TOKEN` (no `NEXT_PUBLIC_` prefix), execute all Gist operations in a Next.js API route only. Also: do NOT use `gh gist edit` CLI — fine-grained PATs have a documented incompatibility with the GitHub CLI (Issue #7803); use the REST API directly.

4. **Admin chatbot missing role check** — An auth check that only validates session existence (not `role === 'ADMIN'`) allows any authenticated session to query the chatbot with full access to conversation logs and config. Prevention: create a shared `requireAdminSession()` utility that checks both session and role; use it in every new API route from the start.

5. **Cost estimate using flat per-message rate** — Message count x average cost diverges significantly from actual billing because: system prompt tokens (~400) are charged as input on every message; output tokens cost 5x input; admin chatbot (Sonnet) is 3-15x more expensive than children's chat (Haiku). Prevention: use the token-estimate formula from STACK.md; track Sonnet and Haiku usage in separate cost buckets; always label estimates clearly with a link to Anthropic billing for exact figures.

## Implications for Roadmap

Based on the dependency graph and pitfall-to-phase mapping from research, the natural build order is three sequential phases matching the three v2.2 features, from lowest to highest complexity.

### Phase 1: Cost Tracking

**Rationale:** Entirely self-contained. Uses only existing infrastructure — MongoDB aggregation pattern from `/api/analytics` and Recharts already in use on the analytics page. No new external services, no new secrets, no new API patterns. Ships quickly and proves out the MongoDB + display pattern before adding complexity.

**Delivers:** Estimated monthly cost card in `/analytics`, separate line items for Haiku (children's chat) and Sonnet (admin tools), direct link to Anthropic billing console, prominent "estimated" disclaimer.

**Addresses:** All P1 cost tracking features from FEATURES.md — estimated cost from message counts, model pricing display, rolling 30-day window, Anthropic billing link, per-model cost breakdown.

**Avoids:** Cost estimate pitfall — build the token-estimate formula correctly from the start (`system_prompt_tokens + chars/4`), not a flat per-message rate. Separate Haiku and Sonnet cost buckets from day one so Phase 2's admin chatbot usage is tracked correctly from the moment it ships.

**New files:** `lib/cost-estimates.ts`, `GET /api/cost-estimate`, `CostSummaryCard` component, modify `/analytics` page.

**Research flag:** Standard patterns — skip `/gsd:research-phase`. All patterns are MongoDB aggregation + Recharts, both already active in the codebase.

### Phase 2: Admin Chatbot Widget

**Rationale:** Introduces the streaming API route pattern that Phase 3 (prompt editor AI review) will reuse. The existing `/api/test-chat` route is non-streaming; this phase establishes the streaming pattern once so Phase 3 extends it rather than introducing it again. The chatbot is also the feature parents will use most frequently, delivering immediate ongoing value.

**Delivers:** Floating chatbot widget visible on all dashboard pages (mounted in DashboardShell), streaming Claude Sonnet responses, context-aware system prompt injecting a read-only app-state snapshot (current safety prompt text, user list, recent alert count, 7-day message count), session message history.

**Addresses:** All P1 chatbot features — floating button placement, open/close toggle, streaming, session history, context injection, loading indicator, inline error handling. Also introduces `requireAdminSession()` utility used by all Phase 2 and Phase 3 routes.

**Avoids:** Two critical pitfalls: (a) indirect prompt injection — system prompt must include explicit "UNTRUSTED USER-GENERATED CONTENT" framing before any conversation log data; chatbot must remain read-only; (b) missing role check — `requireAdminSession()` utility is created here and used in all new API routes.

**New files:** `AdminChatWidget` component, `GET /api/admin-chat/context`, `POST /api/admin-chat`, `lib/admin-system-prompt.ts`, `lib/auth-utils.ts` (for `requireAdminSession()`), modify `DashboardShell`.

**shadcn installs:** `npx shadcn@latest add scroll-area`.

**Research flag:** Standard patterns — skip `/gsd:research-phase`. Streaming pattern fully documented in STACK.md with verified TypeScript code. Widget placement follows established DashboardShell pattern directly.

### Phase 3: Prompt Editor with Gist Deploy

**Rationale:** Most complex phase — four distinct sub-steps (load, edit, AI review, deploy), one new external service (GitHub Gist API), one new secret, and the most critical safety requirement of the milestone (rollback before every deploy). Building last means the streaming pattern from Phase 2 is established (AI review reuses it) and the MongoDB patterns from Phase 1 are available for saving pre-deploy backups.

**Delivers:** System prompt editor page at `/prompt-editor` (NavSidebar link added), AI review with structured required-section checklist, client-side YAML validation before any deploy attempt, pre-deploy Gist content backup enabling one-click revert, Gist push with confirmation modal, "Redeploy LibreChat Required" notice after successful deploy. Diff view (current vs. proposed) included given the safety sensitivity of the action.

**Addresses:** All P1 prompt editor features — current prompt pre-loaded, save/discard controls, AI review (non-blocking), test-in-sandbox (reuses existing `/api/test-chat` with draft prompt override), deploy to Gist, confirmation modal, success/failure feedback.

**Avoids:** Three critical pitfalls: (a) broken prompt with no rollback — save current Gist content to MongoDB before every deploy; (b) Gist token insecure storage — fine-grained PAT, server-side only via `lib/gist-client.ts`, `GITHUB_GIST_TOKEN` env var; (c) YAML validation bypassed — parse client-side before any deploy attempt blocks the push.

**New files:** `/prompt-editor/page.tsx`, `/prompt-editor/loading.tsx`, `PromptEditorClient`, `POST /api/prompt-editor/review`, `POST /api/prompt-editor/deploy`, `lib/gist-client.ts`, NavSidebar modification.

**New secret:** `GITHUB_GIST_TOKEN` in Railway environment variables (fine-grained PAT, Gist scope only). Must be provisioned before Phase 3 testing.

**shadcn installs:** `npx shadcn@latest add textarea`.

**Research flag:** Needs attention during planning — the rollback mechanism (where pre-deploy backup is stored: new `prompt_history` collection vs. a field on an existing document) and the required-section checklist (which exact sections must be present for AI review to pass — jailbreak resistance, content rules, tone, redirect language) should be explicitly designed before implementation begins. The Railway redeploy trigger strategy also needs a decision: automate via Railway CLI after Gist push, or show a manual instruction to the parent.

### Phase Ordering Rationale

- **Dependency order:** Cost tracking has no external dependencies and no new API patterns; chatbot introduces streaming and the `requireAdminSession()` utility; prompt editor reuses streaming, uses the auth utility, and needs the MongoDB backup pattern established earlier.
- **Risk sequencing:** The two highest-risk security items (indirect injection hardening in Phase 2, Gist token security in Phase 3) are tackled after codebase patterns are established but before any children's safety infrastructure is touched by the new UI.
- **Independent testability:** Each phase produces independently shippable functionality. A parent can use cost tracking before the chatbot exists; the chatbot is fully usable before the prompt editor is built.
- **Railway secret prerequisite:** `GITHUB_GIST_TOKEN` must be added to Railway before Phase 3 testing can begin. This is a hard prerequisite that should be listed as the first task in Phase 3 planning.

### Research Flags

**Needs attention during planning:**
- **Phase 3 (Prompt Editor):** Three design decisions must be made before implementation: (1) rollback storage — new `prompt_history` MongoDB collection vs. appending to existing collection; (2) required-section checklist content — which exact named sections must be present for AI review to pass; (3) Railway redeploy trigger — automated via Railway CLI after Gist push, or manual instruction displayed to the parent.

**Standard patterns (skip `/gsd:research-phase`):**
- **Phase 1 (Cost Tracking):** MongoDB aggregation + Recharts — both already active in the codebase; no new patterns.
- **Phase 2 (Admin Chatbot):** Streaming pattern fully documented in STACK.md with verified TypeScript code; widget placement in DashboardShell is a one-line addition with no new architectural decisions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already installed and deployed. Streaming pattern verified against official Anthropic docs. GitHub Gist PATCH endpoint is stable and versioned (2022-11-28). Node.js 18+ native fetch confirmed available. |
| Features | HIGH | Feature set is narrow and well-defined for a two-parent deployment. Anthropic Admin API blocker confirmed from official docs. Anti-features list is well-reasoned with documented alternatives. |
| Architecture | HIGH | Based on direct codebase inspection of `/data/home/KidAI/src/`. Integration points (DashboardShell structure, analytics route aggregate pattern, test-chat route pattern, system-prompt.ts import) all verified against actual source files. |
| Pitfalls | HIGH | Indirect injection sourced from OWASP LLM Top 10 2025 (LLM01). Token security sourced from GitHub Docs and fine-grained PAT GA announcement. LLM review bias sourced from peer-reviewed research (Nov 2025). YAML deploy risk is operational, not speculative. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact Sonnet 4.6 model string:** STACK.md uses `claude-sonnet-4-6-20260217`. This should be verified against the Anthropic models API before Phase 2 implementation. The SDK returns a clear 400 error on wrong model strings — trivial to detect and fix in development.

- **Individual vs. organization Anthropic account:** The Anthropic Admin API (for exact token counts) requires an org-level account. The current deployment is assumed to use an individual account based on context, but this has not been verified. If it turns out to be an org account, the Approach B Admin API integration from STACK.md becomes viable for v2.3+.

- **Fine-grained PAT and Gist scope:** Fine-grained PATs are GA (March 2025) and Gist scoping is documented. The `gh` CLI incompatibility with fine-grained PATs is documented in GitHub Issue #7803 — use REST API directly, not `gh gist edit`. Verify the fine-grained PAT works with the Gist PATCH endpoint before beginning Phase 3 implementation.

- **Rollback storage design:** Where to store the pre-deploy Gist content backup needs a decision during Phase 3 planning. Options: new `prompt_history` collection (clean separation, trivial rollback query) vs. a single `config_backups` document in an existing collection (simpler schema). Either works — the decision should be made before writing the deploy route.

- **Per-message token estimate calibration:** The token estimates used in Phase 1 (average input ~400 tokens, output ~150 tokens per children's message) are derived from typical conversational message lengths, not measured from actual KidAI traffic. After Phase 1 ships, compare the estimated cost against one week of actual Anthropic billing to calibrate the constants in `lib/cost-estimates.ts`.

## Sources

### Primary (HIGH confidence)
- Anthropic Streaming Messages Docs — `create({ stream: true })` async iterable pattern, `content_block_delta` event type verified
- Anthropic Usage & Cost API Docs — Admin API key requirement confirmed; `response.usage` field available on all non-streaming responses
- GitHub REST API Docs, PATCH /gists/{gist_id} — stable versioned endpoint, auth headers, request/response schema
- GitHub Fine-grained PATs GA announcement (March 2025) — scope to Gist operations only confirmed
- Anthropic Pricing 2026 — Sonnet 4.6: $3/$15 per M tokens; Haiku 4.5: $1/$5 per M tokens
- OWASP LLM Top 10 2025, LLM01 — Indirect prompt injection attack pattern and prevention cheat sheet
- Next.js Docs — Server-only environment variables, ReadableStream route handler support
- Direct codebase inspection: `/data/home/KidAI/src/` — DashboardShell, analytics route aggregate pattern, test-chat streaming capability, system-prompt.ts import pattern

### Secondary (MEDIUM confidence)
- Vercel AI SDK vs. Anthropic SDK comparison (Strapi blog) — confirms AI SDK multi-provider abstraction adds no value for single-provider apps; bundle size estimate ~200KB
- GitHub CLI Issue #7803 — `gh gist` commands incompatible with fine-grained PATs (workaround: use REST API directly)
- "Potential Legal Challenges to AI Rubber-Stamping" research (Nov 2025) — LLM review tasks show >95% acceptance rates; structured checklist required

### Tertiary (LOW confidence)
- Per-message token estimates (~400 input, ~150 output for children's chat) — derived from typical conversational message lengths, not measured from actual KidAI traffic. Calibrate against real billing after Phase 1 ships.

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
