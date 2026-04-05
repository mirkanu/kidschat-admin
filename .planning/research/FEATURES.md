# Feature Research

**Domain:** Admin intelligence layer for family AI chat — AI chatbot widget, system prompt editor, cost tracking
**Researched:** 2026-04-04
**Confidence:** HIGH (Anthropic official docs for cost API; MEDIUM for prompt editor workflow patterns)

---

## Scope: v2.2 Admin Intelligence Milestone

This document covers the three NEW features being added to the existing admin dashboard. The existing dashboard (v2.1) already has: conversations viewer, user management, analytics, safety alerts, safety rules page, and test mode chat sandbox.

The v2.2 features are:
1. AI admin chatbot widget (bottom-right floating, Claude Sonnet 4.6)
2. System prompt editor with AI review → sandbox test → Gist deploy workflow
3. Cost tracking with token-based estimates and link to Anthropic billing

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are the baseline behaviors that, if missing, make each feature feel broken or untrustworthy.

#### AI Admin Chatbot Widget

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Floating button, bottom-right placement | Standard pattern for inline assistant widgets; users know how to find it | LOW | shadcn Sheet or Dialog. Position: `fixed bottom-4 right-4`. |
| Open/close toggle | Chat widget must not permanently consume screen space | LOW | Local `useState` for open/closed. |
| Input field + send button | Users cannot send messages without these | LOW | `<textarea>` with enter-to-send (shift+enter for newline). |
| Message history within session | Prior turns visible in current session; otherwise feels stateless | LOW | `useState` array; no persistence needed across page loads. |
| Streaming responses | LLM responses that appear instantly feel responsive; waiting for full response feels broken | MEDIUM | Anthropic SDK `stream: true` via `/api/admin-chat` route. |
| Loading indicator while streaming | Users need to know the model is working | LOW | Animated dots or shimmer on the assistant message bubble while streaming. |
| System context injection | Bot must know what app it is, what rules exist, who the children are | MEDIUM | Server-side: inject current system prompt, user list, recent alert count into the chat system message before each turn. |
| Graceful error handling | API failures must not silently break the widget | LOW | Show inline error message in chat thread, not a toast that disappears. |

#### System Prompt Editor

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Textarea with current prompt pre-loaded | Editor must show what is currently deployed | LOW | Load from `system-prompt.ts` or fetch live Gist content. |
| Save/discard controls | User needs to save a draft without deploying | LOW | Local state diff; "unsaved changes" indicator. |
| AI review of edited prompt | Core value prop — catch gaps before deployment | MEDIUM | Send current + proposed prompt to Claude; return structured feedback. |
| Review result display | Parent must see what the AI found before deciding to proceed | LOW | Expandable panel below editor showing review findings. |
| Test-in-sandbox before deploy | Parent can try the new prompt in the existing test mode before committing | HIGH | Reuse existing `/api/test-chat` endpoint; pass the draft prompt as override. See dependencies. |
| Deploy to Gist | One-click publish to the GitHub Gist that LibreChat reads | MEDIUM | `PATCH /gists/{gist_id}` with GitHub PAT. Requires `GITHUB_TOKEN` env var. |
| Deploy confirmation step | Irreversible action must require explicit confirmation | LOW | Confirmation modal: "This will update the live system prompt. LibreChat picks up changes on next restart." |
| Success/failure feedback | User must know if deploy worked | LOW | Toast on success; inline error with GitHub API message on failure. |

#### Cost Tracking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Estimated cost from message counts | Parent wants to understand spend without needing a separate dashboard | MEDIUM | Use known per-message token estimates × Haiku 4.5 pricing. Pull message counts from existing MongoDB analytics data. |
| Model pricing display | User needs to see what rates are being applied | LOW | Static table: Haiku 4.5 input $1/M tokens, output $5/M tokens. |
| Rolling cost estimate (this month / last 30 days) | Monthly context is the most intuitive framing for a bill | LOW | Group message counts by calendar month from analytics data. |
| Link to Anthropic Console billing | Exact authoritative spend lives there; dashboard should link directly | LOW | `https://console.anthropic.com/settings/billing` as external link. |

---

### Differentiators (Beyond Baseline)

Features that would make v2.2 notably better than the minimum viable implementation.

#### AI Admin Chatbot Widget

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Page-aware context | Bot knows which page the admin is on and surfaces relevant info | MEDIUM | Read `usePathname()` client-side; pass current route in system message. |
| Suggested prompts on open | Reduces cold-start paralysis; shows what the bot can help with | LOW | Render 3-4 chip buttons: "What safety alerts this week?", "Summarize recent conversations", "Explain current safety rules". |
| Read access to live data | Bot can answer "how many messages today?" by querying MongoDB | HIGH | Server action or dedicated `/api/admin-chat` that runs read-only queries before each response. Significant scope — see pitfalls. |
| Conversation reset | Start fresh without refreshing the page | LOW | "New conversation" button clears `messages` state. |

#### System Prompt Editor

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Diff view (current vs proposed) | Parent can see exactly what changed before deploying | MEDIUM | Use a simple line-diff library (`diff` npm package). Side-by-side or inline diff. |
| AI review structured categories | Rather than free text, review reports: Jailbreak Resistance, Age Appropriateness, Christian Values Coverage, Anti-Cheating | MEDIUM | Structured prompt to Claude asking it to evaluate named dimensions and rate each. |
| Version history (last N deploys) | Allows rollback if new prompt causes problems | HIGH | Store deploy history in MongoDB collection with timestamp + prompt text. Adds a rollback button. Significant scope for v2.2 — defer. |
| Auto-update Safety Rules page summary | After deploy, regenerate the parent-friendly summary shown on the Safety Rules page | MEDIUM | Rerun the summarization prompt against the new prompt text and store result. |

#### Cost Tracking

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-child cost breakdown | Parent can see if one child is using much more than the other | LOW | Group message counts by `userId` (already tracked) × token estimate. |
| Daily cost chart | Visualize spend over time, not just totals | MEDIUM | Reuse existing Recharts infrastructure; add cost line to the analytics chart. |
| Cost-per-conversation estimate | Makes cost feel concrete and relatable | LOW | Total estimated cost ÷ conversation count. |
| Anthropic Usage API integration | Pull actual token counts instead of estimating | HIGH | Requires Admin API key (`sk-ant-admin...`), which is distinct from the standard API key. Organization-level only. Significant setup — see pitfalls. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Chatbot with write access (config changes, user creation) | "Make the bot actually do things" | Write access via a chat interface is a high-risk blast radius. One misunderstood command could delete users or corrupt config. | Read-only bot. All writes go through explicit UI flows with confirmation steps. |
| Chatbot conversation persistence across sessions | "Remember what I asked last week" | Adds MongoDB collection, auth scoping, privacy surface for admin data. The value is low for a single-admin tool used occasionally. | Session-only history. Admin can copy/paste important answers. |
| Real-time Anthropic Usage API for cost display | "Show exact token counts" | Admin API key is org-level only. This family deployment likely uses a personal account, not an organization. The API is unavailable for individual accounts. | Calculate estimates from message counts using known token averages. Accurate enough, zero complexity. |
| System prompt version control with full rollback UI | "Git history for prompts" | Adds a new MongoDB collection, UI for listing versions, rollback confirmation flow. Doubles the scope of the editor feature. | Deploy history log (last 3 entries, read-only). Full rollback is a manual Gist edit. |
| AI review blocking deploy | "Force the parent to address all issues before deploying" | Parent is the authority. A blocking gate creates adversarial UX — parent knows their family values better than the AI reviewer. | Non-blocking review: show findings, allow override, require explicit "Deploy anyway" if issues found. |
| Multi-model chatbot (switch between Haiku/Sonnet) | "Use cheaper model for simple questions" | Adds model picker UI complexity to a tool used by one parent. Haiku 4.5 is already cheap enough for admin use. | Fixed: Claude Sonnet 4.6 for the admin bot (quality over cost for the admin context). |

---

## Feature Dependencies

```
AI Admin Chatbot Widget
    └──requires──> /api/admin-chat server route (new)
                       └──requires──> Anthropic SDK (already installed)
                       └──requires──> Context injection (system prompt text, user list)
                                          └──depends on──> lib/system-prompt.ts (already exists)
                                          └──depends on──> MongoDB users query (already exists)

System Prompt Editor
    └──requires──> Editor UI with current prompt pre-loaded
                       └──depends on──> lib/system-prompt.ts (already exists, hardcoded)
    └──requires──> AI Review step
                       └──requires──> /api/prompt-review server route (new)
                       └──requires──> Anthropic SDK (already installed)
    └──requires──> Test-in-sandbox
                       └──depends on──> /api/test-chat (already exists — reuse with draft prompt override)
    └──requires──> Deploy to Gist
                       └──requires──> /api/prompt-deploy server route (new)
                       └──requires──> GITHUB_TOKEN env var (new — GitHub PAT with gist scope)
                       └──requires──> GIST_ID env var (new — or hardcode from PROJECT.md)

Cost Tracking
    └──requires──> Message count data
                       └──depends on──> MongoDB analytics queries (already exists in /api/analytics)
    └──requires──> Token estimate formula
                       └──depends on──> Known Haiku 4.5 pricing (static, no external call)
    └──no new API routes required if embedded in existing analytics page
```

### Dependency Notes

- **System prompt editor has the most complex dependency chain** — 4 distinct sub-steps, each needing its own server route. Build and test each step independently before wiring them into a single multi-step UI.
- **Test-in-sandbox can reuse existing infrastructure** — `/api/test-chat` already accepts a system prompt. The editor just needs to pass the draft text instead of the hardcoded one. This is the lowest-cost integration point.
- **Cost tracking has zero new dependencies** — message counts are already stored and queried. Only new work is the estimate formula and display component.
- **AI chatbot context injection is read-only** — only reads from sources that already exist. No new data collection needed.

---

## MVP Definition

### Launch With (v2.2)

Minimum for each feature to be useful without breaking trust.

- [ ] AI chatbot widget — floating button, open/close, streaming, session history, system prompt + user list context injected
- [ ] System prompt editor — load current prompt, textarea edit, AI review (non-blocking), deploy to Gist with confirmation
- [ ] Cost tracking — estimated cost this month from message counts, model pricing shown, link to Anthropic Console

### Add After Validation (v2.2.x)

Features to add once core is working and parent has used each feature once.

- [ ] Suggested prompt chips in chatbot widget — add once it's clear what parents actually ask
- [ ] Diff view in prompt editor — add if parent feedback indicates deploying changes felt risky
- [ ] Per-child cost breakdown — add if total cost number prompts questions about who is using more

### Future Consideration (v2.3+)

- [ ] Chatbot live data queries (reading MongoDB on demand) — significant complexity; defer until the simpler static-context bot proves insufficient
- [ ] Deploy history / rollback — defer until parent has made enough prompt changes to need it
- [ ] Anthropic Usage API integration — requires org account setup; defer unless estimates prove inaccurate

---

## Feature Prioritization Matrix

| Feature | Parent Value | Implementation Cost | Priority |
|---------|-------------|---------------------|----------|
| AI chatbot widget (streaming, context-aware) | HIGH — replaces hunting through docs | MEDIUM | P1 |
| System prompt editor + Gist deploy | HIGH — removes manual Gist editing | MEDIUM | P1 |
| AI review of prompt before deploy | HIGH — safety net for the safety net | MEDIUM | P1 |
| Test draft prompt in sandbox | HIGH — validate before going live | LOW (reuse existing) | P1 |
| Cost tracking (estimate from message counts) | MEDIUM — good-to-know visibility | LOW | P1 |
| Link to Anthropic billing | MEDIUM — exact numbers live there | LOW | P1 |
| Deploy confirmation modal | HIGH — irreversible action protection | LOW | P1 |
| Suggested chatbot prompts (chips) | LOW — nice UX but not blocking | LOW | P2 |
| Per-child cost breakdown | LOW — one family, small delta | LOW | P2 |
| Diff view in editor | MEDIUM — helps confirm intent | MEDIUM | P2 |
| Daily cost chart | LOW — totals are sufficient | MEDIUM | P3 |
| Deploy history / rollback | LOW — manual Gist rollback works | HIGH | P3 |
| Chatbot live MongoDB queries | MEDIUM — more powerful bot | HIGH | P3 |
| Anthropic Usage API (actual tokens) | LOW — estimates sufficient | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.2 launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor / Reference Feature Analysis

This is a private internal tool, not a product competing in a market. The "competitors" are the workflows this replaces.

| Feature | Current Workflow (No v2.2) | v2.2 Replaces With |
|---------|---------------------------|---------------------|
| Ask "what does the safety prompt cover?" | Read raw system-prompt.ts in codebase | Ask admin chatbot |
| Edit safety prompt | Edit Gist manually in browser | Prompt editor with AI review |
| Verify prompt change is safe | Manually re-read the diff | AI review + sandbox test |
| Push prompt to production | Manually edit Gist, redeploy LibreChat | One-click deploy button |
| Check API cost | Log in to Anthropic Console separately | Estimated cost in dashboard |

---

## Technical Implementation Notes

### AI Admin Chatbot

The chatbot context injection pattern (injecting app state into the system message server-side) is the correct approach over "tool use" for this scope. Tool use would require the bot to make MongoDB queries on demand, which is significantly more complex. Instead, pre-fetch a context snapshot on each `/api/admin-chat` call: current system prompt text, user list (names + roles), last 7 days alert count, message count. Inject as a structured block in the system message. This gives the bot meaningful context without real-time query capability.

Claude Sonnet 4.6 is the correct model choice for the admin bot — higher reasoning quality is worth the extra cost for a tool used by one admin, not children.

### System Prompt Deploy via GitHub Gist

GitHub's Gist update API (`PATCH https://api.github.com/gists/{gist_id}`) requires a Personal Access Token with `gist` scope. Classic tokens are deprecated; use a fine-grained PAT scoped to gist read/write. Store as `GITHUB_TOKEN` Railway environment variable. The Gist ID is already known: `e23b999f1d3cd77726a97c20e26f0abf` (from PROJECT.md).

After a successful Gist update, LibreChat does NOT auto-reload the config — it reads `CONFIG_PATH` only at startup. The deploy success message should note: "Changes deployed. LibreChat will use the new prompt after the next redeploy."

### Cost Estimation Formula

Haiku 4.5 pricing (HIGH confidence from official Anthropic pricing): $1.00/M input tokens, $5.00/M output tokens.

Reasonable per-message estimates for children's chat (MEDIUM confidence — based on typical conversational message lengths):
- Average input tokens per message: ~400 (system prompt ~280 tokens + user message ~120 tokens)
- Average output tokens per message: ~150

Estimated cost per message: `(400/1M × $1.00) + (150/1M × $5.00) = $0.0004 + $0.00075 = ~$0.00115`

For a family with ~100 messages/month: ~$0.12/month. Display as "estimated" with a note that actual billing is in Anthropic Console.

### Anthropic Usage API Blocker

The Anthropic Usage & Cost Admin API requires an Admin API key (`sk-ant-admin...`) available only to organization accounts. Individual/personal Anthropic accounts do not have access to this API. Since this is a personal family deployment, assume the standard API key is used and the Admin API is NOT available. Do not build a feature that depends on it. (MEDIUM confidence — confirmed from official docs, but individual account status unverified.)

---

## Sources

- [Anthropic Usage & Cost API](https://platform.claude.com/docs/en/api/usage-cost-api) — Official docs confirming Admin API key requirement, endpoint structure, and that individual accounts cannot access it
- [Claude API Pricing 2026](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration) — Haiku 4.5 pricing rates
- [GitHub REST API — Gists](https://docs.github.com/en/rest/gists/gists) — PATCH endpoint for updating Gist content
- [Prompt Versioning Best Practices](https://www.promptot.com/blog/prompt-versioning-development-vs-production-best-practices) — Edit/review/test/deploy workflow pattern
- [AI chatbot widget placement patterns](https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e) — Floating bottom-right is standard
- [Chatbot UI Design Patterns 2026](https://widget-chat.com/blog/chatbot-ui-design-best-practices/) — Context-aware triggering, placement standards

---

*Feature research for: KidAI v2.2 Admin Intelligence (AI chatbot widget, prompt editor, cost tracking)*
*Researched: 2026-04-04*
