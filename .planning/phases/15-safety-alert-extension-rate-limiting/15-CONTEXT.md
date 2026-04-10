# Phase 15: Safety Alert Extension & Rate Limiting - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers three tightly-coupled capabilities:

1. **Image-prompt safety detection** — Extend the existing safety-pattern regex system to detect abusive/inappropriate image generation requests from children and notify parents via the existing Resend email pipeline.

2. **Per-child rate limits** — Admin-configurable daily image count, daily message count, and monthly cost cap (in EUR), stored as global defaults with per-child overrides. Enforcement hides the DALL-E tool from agents (and hard-locks agents entirely when the monthly cost cap is reached) until limits reset.

3. **Bonus purchase flow ("Extra Usage" model)** — When a child hits any limit, the agent offers them a chance to buy a bonus credit pack (admin-configurable amount, default €2) that can be freely spent on images or text. Confirmed via typed "YES" in chat. Bonus purchases are capped per week per child and do NOT count against the monthly cost cap (matching Claude's Extra Usage subscription model).

**Supporting requirement:** Phase 10's token-formula cost tracking must be extended to real-time per-child accuracy, because the monthly cost cap depends on it.

**Out of scope:**
- New safety detection beyond image prompts (jailbreak patterns stay as-is)
- Parent pre-approval flows for purchases
- Non-chat alert delivery (Slack, SMS, etc.)
- Refund/reversal of bonus purchases from the admin UI (future phase)

</domain>

<decisions>
## Implementation Decisions

### Safety Alert Extension

- **New alert type:** Add `"image_prompt"` to `SafetyEvent.type` union in `src/lib/safety-patterns.ts` — distinct from `jailbreak_attempt` and `safety_redirect`
- **Pattern location:** New `IMAGE_PROMPT_PATTERNS` array in `safety-patterns.ts`, matched against user messages (`isCreatedByUser=true`)
- **Pattern categories:** Violence/gore, nudity/immodest, horror/scary, real named people, bypass attempts ("draw but make it look like…"). Draft patterns are in `15-RESEARCH.md`
- **Email pipeline:** Use existing `notify-safety-alert.ts` (Phase 13) unchanged, with the new `image_prompt` type producing a clearer subject line (e.g. "Image abuse attempt detected")
- **Dedup:** Reuse existing 1-hour dedup window on `meta.conversationId + meta.matchedPattern`

### Rate Limiting — Limits

- **Three configurable limits per child:**
  1. Daily image count (brief default: 10)
  2. Daily message count (default: Claude's Discretion)
  3. Monthly cost cap in **EUR** (default: Claude's Discretion, but low enough to be safe — e.g. €10/month/child)
- **Reset boundaries:** Daily limits reset at midnight UTC. Monthly cost cap resets on the 1st of each month (UTC).
- **Cost composition:** Monthly cap tracks EVERYTHING — Claude Haiku input tokens + output tokens + agent "thinking" tokens + DALL-E image costs ($0.04 each). All token types roll up into a single monthly spend figure per child.

### Rate Limiting — Config Store

- **Collection:** New MongoDB `settings` collection (or reuse `app_config` if cleaner)
- **Shape:** Global defaults document + per-child override documents keyed by userId
- **Override semantics:** Per-child override wins when present; otherwise fall back to global default
- **Admin UI:** New settings page in the admin dashboard to edit global defaults AND per-child overrides. Live-writes to MongoDB — no redeploy required to change limits.

### Rate Limiting — Enforcement

- **Image limit enforcement:** When a child hits their daily image cap (and has no bonus credit), a cron job hides the DALL-E tool from the agents they can access. Options for the researcher to evaluate: per-user ACL manipulation, per-user agent cloning, or dynamic agent instructions injection. Researcher picks the most reliable approach.
- **Monthly cost cap enforcement:** When a child hits the monthly cap (and has no active bonus credit), agents are hard-locked for that child — no text responses, no images, until the 1st of next month OR a bonus purchase is made.
- **Reset mechanism:** Cron that runs at midnight UTC (for daily limits) and on the 1st (for monthly) to restore access.

### Bonus Purchase Flow ("Extra Usage" model)

- **Trigger:** Child hits ANY limit (daily image, daily message, or monthly cost cap) AND has no active bonus credit
- **UX:** Agent message in the chat ("You've reached your limit. Would you like to unlock €2 of extra usage? [custom admin-editable reason text]. Type YES to confirm.")
- **Confirmation:** Child types "YES" (or equivalent confirmation keyword) in the chat. The admin dashboard detects this via a MongoDB message watcher and credits the bonus immediately.
- **Pack semantics:** €2 of freely-spendable credit (default; admin-configurable). Applied to ALL subsequent usage — images, text tokens — until exhausted. Expires at midnight UTC if not used.
- **Cost accounting (Claude Extra Usage model):** Bonus credit does NOT count against the monthly cost cap. Monthly cap is the "base allowance"; bonus is "Extra Usage" on top.
- **Weekly bonus cap per child:** Admin-configurable weekly maximum (default: Claude's Discretion — suggest €5/week/child). When the weekly bonus cap is reached, the child cannot purchase more bonuses until the following Monday (UTC), regardless of other limits.
- **Hard-lock condition:** When the monthly cost cap AND the weekly bonus cap are both exhausted, the child is truly locked until the next reset boundary.
- **Admin-editable message template:** The custom text shown to the child when offering a bonus purchase is editable in the admin dashboard. Example: "This money will come off your GoHenry." Supports plain text (no template variables required for v1).

### Parent Notification for Bonus Purchases

- **NO immediate email** per purchase — avoids notification spam
- **Weekly digest email (at most once per week):** Summarizes total bonuses purchased per child for that week. Plugs into the existing Phase 13 weekly digest cron infrastructure — add a new section to that email template rather than a new cron job.
- **Admin dashboard visibility:** All purchases logged to a new `bonus_purchases` collection, visible in the admin dashboard per child. No active banner or badge — admin reviews in the weekly digest or on-demand.

### Cost Tracking Enhancement

- **Part of this phase:** Extend Phase 10's cost tracking from formula-based estimates to real-time per-child accurate tracking. Required for the monthly cost cap to work meaningfully.
- **Storage:** Per-message cost records in a new `cost_ledger` collection (or equivalent) so that both daily/monthly aggregates per child and the running monthly total are queryable in <100ms.
- **Integration point:** Every LibreChat message save (detected via MongoDB change stream or polling) triggers a cost calculation and ledger insert. Researcher to recommend the cleanest hook.

### Admin UI Changes

- **New settings page** — editable global defaults + per-child overrides for: daily images, daily messages, monthly cost cap, weekly bonus cap, bonus pack size (EUR), custom bonus message template
- **User detail page (`/users/[userId]`)** — per-child image count (today/week/month), current monthly spend vs cap, active bonus credit remaining, bonus purchases this week
- **Cost analytics page** — add image count as a new line + 30-day trend chart alongside existing text costs
- **Safety alerts page** — `image_prompt` type is visible alongside existing alert types with appropriate filtering

### Claude's Discretion

- Default values for: daily message limit, monthly cost cap (EUR), weekly bonus cap, cron frequency for enforcement checks
- Exact MongoDB schema for `settings`, `bonus_purchases`, `cost_ledger` collections
- Implementation mechanism for DALL-E tool hiding (ACL manipulation vs agent instruction injection vs per-user agent cloning) — researcher to recommend
- MongoDB change stream vs polling for cost ledger ingestion
- Settings page UI layout and form component choices
- Default text for the admin-editable bonus purchase message

</decisions>

<specifics>
## Specific Ideas

- **Claude Extra Usage as the mental model** for bonus purchases — base allowance is the monthly cost cap, bonus is "extra" that stacks on top and doesn't count against the base
- **GoHenry example** — the admin-editable bonus message might say "This money will come off your GoHenry" so kids understand the real-world cost implication
- **Global defaults + per-child overrides** — standard admin pattern, allows different limits for different ages (e.g. the 14-year-old might get more than the 12-year-old)
- **Weekly digest email already exists** (Phase 13) — reuse its infrastructure for the weekly bonus summary rather than building a separate cron

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/safety-patterns.ts` — Has `SAFETY_REDIRECT_PATTERNS` and `JAILBREAK_PATTERNS` arrays; add `IMAGE_PROMPT_PATTERNS` here
- `src/lib/notify-safety-alert.ts` — Central safety notification handler (Phase 13); new `image_prompt` type plugs in cleanly
- `src/lib/mongodb.ts` — Shared Mongo client; use for all new collections
- **Weekly digest cron** (Phase 13) — `src/app/api/notify/weekly-digest/route.ts`; extend to include bonus purchase totals
- **Cost tracking** (Phase 10) — `src/app/api/cost-estimate/` + `CostSummaryCard`; extend for real-time per-child tracking
- `email_notifications` collection — has dedup logic (Phase 13); reuse
- `notification_prefs` — parents can toggle digest on/off; keep that working

### Established Patterns
- Safety patterns are **client-side regex scanning** in the admin dashboard — no changes to LibreChat itself for alert detection
- Cost tracking uses **token-formula estimates**, currently static; Phase 15 converts this to real-time ledger
- **Direct MongoDB queries** from Next.js server components (no self-fetch anti-pattern) — established in Phases 11-13
- **`admin` routes excluded from auth middleware** — all per-child data/settings pages sit behind the admin auth gate
- Test mode (Phase 9) calls Anthropic API directly, bypassing LibreChat — rate limits should NOT apply to test mode (admin debugging tool)

### Integration Points
- LibreChat `messages` collection — read-only source of truth for what was sent/received
- LibreChat `agents` collection — the 4 tone agents from Phase 14 (agent_wxgt6su7d3pcosiil3, etc.); enforcement may need to modify their `tools` array or their per-user ACL entries
- LibreChat `files` collection — source for counting generated images (`context: "image_generation"` in attachments — verified in Phase 14)
- Phase 14 agents use Claude Haiku as provider and `dalle` as the tool — rate limiter must understand both endpoints
- Railway cron schedules (Phase 13) — add new cron entries for: daily limit reset (midnight UTC), monthly reset (1st UTC), enforcement sweep (every ~2-5 min)

</code_context>

<deferred>
## Deferred Ideas

- **Per-session bonus caps** — e.g. "max 3 bonuses per conversation". Out of scope; weekly cap is sufficient for v1.
- **Parent pre-approval flow** — immediate blocking until parent clicks approve. Would add latency and UX friction; weekly digest + admin visibility is the chosen model.
- **Real-time parent notifications per purchase** — spammy; weekly digest chosen instead.
- **Refund/reversal UI** — undoing a bonus purchase from the admin dashboard. Not needed for v1; can be done via direct MongoDB if needed.
- **Slack/SMS alerts** — email only for v1.
- **Child-facing UI for viewing their own remaining allowance** — they learn via the agent's response when they hit a limit. A dedicated "my usage" widget in LibreChat is out of scope.
- **Tiered bonus packs** — e.g. "€2 small" / "€5 medium". Single admin-configured amount is sufficient for v1.
- **Pre-approved monthly spending allowance separate from the cap** — handled via the monthly cost cap itself. No separate "allowance" concept needed.

</deferred>

---

*Phase: 15-safety-alert-extension-rate-limiting*
*Context gathered: 2026-04-10*
