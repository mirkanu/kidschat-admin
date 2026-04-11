# Roadmap: KidsChat

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-04-04)
- ✅ **v2.0 Admin Dashboard** — Phases 4-6 (shipped 2026-04-04)
- ✅ **v2.1 Parent Trust** — Phases 7-9 (shipped 2026-04-05)
- ✅ **v2.2 Admin Intelligence** — Phases 10-12 (shipped 2026-04-05)
- ✅ **v2.3 Parent Notifications** — Phase 13 (shipped 2026-04-05)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-04-04</summary>

LibreChat deployed on Railway with MongoDB + Meilisearch, two admin and two child accounts, safety system prompt with Reformed Christian values and four tone presets, jailbreak resistance validated.

- [x] **Phase 1** — Railway infrastructure, LibreChat deployed, MongoDB connected
- [x] **Phase 2** — LibreChat configured: registration closed, social login off, Claude Haiku 4.5 only
- [x] **Phase 3** — Safety system prompt, tone presets, family accounts, admin oversight verified

</details>

<details>
<summary>✅ v2.0 Admin Dashboard (Phases 4-6) — SHIPPED 2026-04-04</summary>

Standalone Next.js admin dashboard on Railway with auth gate, conversation monitoring, user management, usage analytics, and safety alert detection.

- [x] **Phase 4: Foundation** — Next.js app deployed on Railway, MongoDB connected, admin-only auth gate (completed 2026-04-04)
- [x] **Phase 5: Conversations & User Management** — Conversation logs with search/filter, full CRUD user management (completed 2026-04-04)
- [x] **Phase 6: Analytics & Safety Alerts** — Recharts usage charts with per-child toggle, safety pattern detection with event log (completed 2026-04-04)

</details>

<details>
<summary>✅ v2.1 Parent Trust (Phases 7-9) — SHIPPED 2026-04-05</summary>

Trust center for parents: dashboard home with safety status and activity digest, Safety Rules transparency page, embedded chat sandbox for testing safety boundaries.

- [x] **Phase 7: Trust Home** — Users page fix, dashboard home redesigned as trust center with safety status, digest, alerts, quick links (completed 2026-04-04)
- [x] **Phase 8: Safety Transparency** — Safety Rules page with content boundaries, expandable system prompt, tone presets (completed 2026-04-04)
- [x] **Phase 9: Parent Test Mode** — Embedded chat sandbox with scenario buttons and safety detection badges (completed 2026-04-05)

</details>

<details>
<summary>✅ v2.2 Admin Intelligence (Phases 10-12) — SHIPPED 2026-04-05</summary>

AI-powered admin tools: cost tracking, floating chatbot assistant, and rules editor with review-test-deploy workflow.

- [x] **Phase 10: Cost Tracking** — Token-formula cost estimates with per-model breakdown, 30-day trend, Anthropic billing link (completed 2026-04-05)
- [x] **Phase 11: Admin Chatbot** — Floating Claude Sonnet widget with streaming, context-aware, UNTRUSTED child content framing (completed 2026-04-05)
- [x] **Phase 12: Prompt Editor** — Rules editor with AI review, inline test sandbox, Gist deploy, rollback, Safety Rules auto-sync (completed 2026-04-05)

</details>

<details>
<summary>✅ v2.3 Parent Notifications (Phase 13) — SHIPPED 2026-04-05</summary>

Real-time safety alert emails and weekly activity summary emails to parents, powered by Resend with Railway cron scheduling.

- [x] **Phase 13: Parent Email Notifications** — Resend integration, safety alert emails with dedup, weekly digest with Railway cron, notification history page, preference toggles (completed 2026-04-05)

</details>

<details open>
<summary>◆ v2.4 Image Generation (Phases 14-15) — IN PROGRESS</summary>

DALL-E 3 image generation for child users with safety guardrails, abuse detection, and rate limiting.

### Phase 14: Enable & Safeguard Image Generation
DALL-E 3 via LibreChat Agents endpoint, child-appropriate system prompt, safety filters verified

**Goal:** DALL-E 3 working in LibreChat with child-appropriate guardrails
**Plans:** 1/1 plans complete
**Requirements:** [IMG-01, IMG-02, IMG-03, IMG-04]

Plans:
- [ ] 14-01-PLAN.md — Set env vars, create Drawing agent, update librechat.yaml, deploy and verify

### Phase 15: Safety Alert Extension & Rate Limiting
Image-prompt safety patterns, parent email alerts, per-child daily image + message + monthly cost limits, bonus "Extra Usage" purchase flow via in-chat YES confirmation, admin settings page

**Goal:** Image prompt abuse detected + parents notified; runaway costs prevented via configurable per-child daily/monthly limits with admin UI; children can buy bonus "Extra Usage" packs.
**Plans:** 5/6 plans executed
**Requirements:** [IMG-SAFETY-01, IMG-SAFETY-02, IMG-SAFETY-03, IMG-SAFETY-04, IMG-LIMITS-01, IMG-LIMITS-02, IMG-LIMITS-03, IMG-LIMITS-04, IMG-ENFORCE-01, IMG-ENFORCE-02, IMG-ENFORCE-03, IMG-BONUS-01, IMG-BONUS-02, IMG-ADMIN-01]

Plans:
- [x] 15-00-PLAN.md — Wave 0: Jest harness + live MongoDB field inspection + synthetic message probe
- [x] 15-01-PLAN.md — Wave 1: Safety patterns + settings/cost-ledger/bonus-purchases libs + librechat.yaml balance.enabled deploy
- [x] 15-02-PLAN.md — Wave 2: Enforcement + bonus flow + 5 Railway crons + admin settings UI + weekly digest extension
- [ ] 15-03-PLAN.md — Gap closure: Risk-kill change stream + instrumentation.ts + native balance UI assumptions before 15-04
- [ ] 15-04-PLAN.md — Gap closure: budget.ts rewrite, delete legacy cost_ledger/enforcement, railway.toml crons, migration
- [ ] 15-05-PLAN.md — Gap closure: admin UI rewrite (new schema), dashboard spend overview, per-child override fix, human verify

</details>

### Phase 15.2: Synthetic Message Rendering in LibreChat
Research-backed fix for the "invisible synthetic messages" bug — our direct-insert pattern into the messages collection writes docs that LibreChat's agent endpoint does not render in the UI. Root cause identified (React Query cache never refetches), Option 7 (agent system prompt injection) implemented and deployed, but end-to-end UAT failed to render visibly in Manuel's session. Superseded by 15.3 — custom warnings/bonus flow deleted entirely in favor of LibreChat's native hard block + parent-managed top-up button.

**Goal:** Synthetic messages inserted by our backend (70% warning, bonus offer, bonus confirmation) actually appear in the kid's LibreChat conversation view, chained into the main thread, without branches.
**Plans:** 0/1 plans executed
**Requirements:** [SYNTH-RENDER-01]
**Status:** Superseded by 15.3 (simplification teardown)

Plans:
- [~] 15.2-01-PLAN.md — Research LibreChat message rendering + fix + test in live UI (implementation shipped but UAT inconclusive; superseded)

</details>

### Phase 15.3: Simplification — Remove Bonus Flow & Custom Warnings
Tear down the custom bonus purchase flow, 70% warnings, YES detection, agent system prompt injection, and the polling change-stream listener that supported them. Research confirmed LibreChat has no native low-balance warnings, no per-user auto-refill, and no admin balance UI — so we keep the per-child daily/monthly cap enforcement (via our daily-reset/monthly-reset crons) but drop every self-service top-up mechanism. Kids hit LibreChat's native "Insufficient Funds" red block when they reach 0; parents manually top up from the admin UI.

**Goal:** Delete all custom warning + bonus + injection code (~800 LOC + tests). Admin retains per-child cap enforcement and adds a one-click "Top up €0.10" button on the user detail page. Kids see only the LibreChat native balance display and native insufficient-funds block.
**Plans:** 1/1 plans complete
**Requirements:** [SIMPLIFY-01]

Plans:
- [x] 15.3-01-PLAN.md — Delete custom bonus+warning system, add parent top-up button, simplify admin settings, UAT

### Phase 15.4: Cost Cap & Alert Contract Fixes (gap closure)
Gap-closure phase for v2.4 audit findings. Three issues surfaced: (1) `balance_state.monthlySpendEur` is a dead field — initialized and reset but never incremented, so the monthly usage bar is stuck at 0% and the monthly cap is never actually enforced; (2) `monthlyCapExhausted` is computed in `evaluateChildState` but has zero consumers in `src/`; (3) `/api/notify/safety-alert` route whitelists only `safety_redirect` and `jailbreak_attempt` alertTypes, rejecting `image_prompt` with HTTP 400 (production is unaffected today because the alerts page bypasses the HTTP route via a direct server-action call, but the contract is broken). Also fix the latent `$set` clobber in `topUpDailyBudget` which erases parent top-ups at midnight UTC.

**Goal:** Make monthly cap tracking + enforcement real; wire a consumer for `monthlyCapExhausted`; fix `/api/notify/safety-alert` to accept `image_prompt`; stop `topUpDailyBudget` from clobbering mid-day parent top-ups.
**Requirements:** [IMG-LIMITS-03, IMG-ENFORCE-02, IMG-SAFETY-04]
**Gap closure:** true
**Audit source:** `.planning/v2.4-MILESTONE-AUDIT.md`

Plans:
- [ ] 15.4-01-PLAN.md — Wire monthlySpendEur accumulation, actually enforce monthly cap, fix top-up clobber, whitelist image_prompt alertType

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | — | Complete | 2026-04-04 |
| 2. Configuration | v1.0 | — | Complete | 2026-04-04 |
| 3. Safety & Accounts | v1.0 | — | Complete | 2026-04-04 |
| 4. Foundation | v2.0 | 3/3 | Complete | 2026-04-04 |
| 5. Conversations & User Management | v2.0 | 3/3 | Complete | 2026-04-04 |
| 6. Analytics & Safety Alerts | v2.0 | 2/2 | Complete | 2026-04-04 |
| 7. Trust Home | v2.1 | 2/2 | Complete | 2026-04-04 |
| 8. Safety Transparency | v2.1 | 2/2 | Complete | 2026-04-04 |
| 9. Parent Test Mode | v2.1 | 2/2 | Complete | 2026-04-05 |
| 10. Cost Tracking | v2.2 | 2/2 | Complete | 2026-04-05 |
| 11. Admin Chatbot | v2.2 | 2/2 | Complete | 2026-04-05 |
| 12. Prompt Editor | v2.2 | 2/2 | Complete | 2026-04-05 |
| 13. Parent Email Notifications | v2.3 | 3/3 | Complete | 2026-04-05 |
| 14. Enable & Safeguard Image Generation | 1/1 | Complete    | 2026-04-10 | — |
| 15. Safety Alert Extension & Rate Limiting | 5/6 | In Progress|  | — |
| 15.4. Cost Cap & Alert Contract Fixes | v2.4 | 0/1 | Not started | — |
