# Retrospective

## Milestone: v1.0 — KidsChat MVP

**Shipped:** 2026-04-04
**Phases:** 3 | **Plans:** 10

### What Was Built
- Private LibreChat instance on Railway for two children
- Reformed Christian safety system prompt with jailbreak resistance
- 4 tone presets (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal)
- Registration lockdown, model lock, UI lockdown
- Parent admin accounts with MongoDB conversation oversight

### What Worked
- Railway CLI automation — entire deployment without touching the dashboard
- GitHub Gist for config — easy to iterate on YAML without redeploying the container
- Safety prompt framed as identity/values — more robust than rule-based framing
- MongoDB TCP proxy — solved account creation and admin oversight cleanly
- GSD coarse granularity — 3 phases was the right level for a config-only project

### What Was Inefficient
- SSH stdout swallowing wasted ~20 minutes debugging account promotion
- Assumed database name was "LibreChat" — it's "test" in Railway template. Research could have caught this.
- YAML schema mismatch (endpoints.models format) required an inline fix during execution
- GitHub CLI auth required 4 attempts due to username change (manuelkuhs → mirkanu)

### Patterns Established
- Railway CLI: `railway init`, `deploy -t`, `variable set --skip-deploys`, `redeploy --yes`, `service status --all`
- MongoDB TCP proxy via Railway GraphQL API for external admin access
- Config update flow: edit Gist → redeploy service → verify logs
- Account creation via bcryptjs + MongoDB direct insert (bypasses closed registration)
- Conversation oversight via MongoDB `conversations` + `messages` collections

### Key Lessons
- Always verify database name during deployment, not during account creation
- LibreChat admin API lacks cross-user conversation access — MongoDB is the only reliable oversight path
- Railway SSH is not suitable for scripted operations (no stdout capture)
- `--skip-deploys` + single `redeploy` is significantly faster than setting vars one at a time

### Cost Observations
- Model mix: 100% Sonnet for agents, Opus for orchestration
- Sessions: 1 extended session
- Notable: Configuration-only project — zero custom code written, entire deliverable is YAML + env vars

## Milestone: v2.4 — Image Generation

**Shipped:** 2026-04-11
**Phases:** 5 (14, 15, 15.2, 15.3, 15.4) | **Plans:** 9 | **Timeline:** 4 days

### What Was Built
DALL-E 3 image generation across all 4 LibreChat agent presets with child-appropriate safety guardrails. Per-child daily/monthly cost caps enforced via LibreChat-native `balances.tokenCredits` (no shadow accounting). Admin UI for global defaults + per-child overrides. Image-prompt abuse detection wired to parent email alerts via the existing Phase 13 Resend infrastructure. One-click parent "Top up €0.10" button on the user detail page. Railway crons for daily/monthly budget resets.

### What Worked
- **Teardown over rework (15.3).** When Phase 15.2's agent system-prompt injection failed live UAT after 4 different approaches, the user chose to delete the entire custom warning/bonus/injection layer (~800 LOC) rather than ship a 5th fix attempt. This was the right call — research confirmed LibreChat had no native affordances for the feature as specified, and the simpler "native insufficient-funds block + manual parent top-up" design satisfied the real user need (safe budget enforcement) without fighting the upstream tool.
- **LibreChat-native enforcement (15-04 rewrite, via `budget.ts`).** Consolidating cost tracking onto `balances.tokenCredits` eliminated the shadow `cost_ledger` entirely. A small set of helpers (`eurToTokens`, `getEffectiveBudget`, `evaluateChildState`, `topUpDailyBudget`) became the single entry point for every budget operation, which made the 15.4 gap fixes surgical instead of architectural.
- **Audit-driven gap closure (15.4).** The v2.4 milestone audit uncovered three live issues the per-phase verifications had missed — most critically the `monthlySpendEur` dead field, which meant monthly caps were a no-op in production. Running `/gsd:audit-milestone` before `/gsd:complete-milestone` caught bugs that would have otherwise shipped silently. Worth doing every milestone.
- **`$max` for daily refill.** A one-line MongoDB operator swap solved the top-up-clobber bug atomically, no new code paths. Atomic operators are underrated for this kind of "ensure floor without overwriting" logic.

### What Was Inefficient
- **Five failed attempts at synthetic message rendering (Phase 15.2).** Direct insert, React Query invalidation, `Conversation.updatedAt` bump, agent-side injection, agent system-prompt injection — each took a full cycle to test end-to-end. The root cause (LibreChat's React Query cache never refetching on external writes) wasn't identified until after three of those attempts. A half-day of LibreChat source-reading up front would have saved ~2 days of failed iteration. Next time a phase involves injecting into a third-party UI, research the cache/render path FIRST, not after the 2nd failure.
- **`monthlySpendEur` dead field shipped twice.** Phase 15-04 defined the field in the schema, wrote the read path, wrote the reset path, and wrote the tests — but never wrote the increment path. No test caught it because the tests mocked the stored value. Phase 15.3 touched the surrounding code and didn't catch it either (scope was focused on bonus-flow deletion). It took a milestone-level audit with a goal-backward grep to surface. **Lesson:** tests that only exercise read/reset aren't enough — TDD needs at least one test that proves the write path exists.
- **Phase 14 shipped with no VERIFICATION.md.** The SUMMARY claimed all UAT checks passed, but there's no formal verification artifact, which made the v2.4 milestone audit harder (had to reconstruct what was verified from the SUMMARY prose). Small process gap, easy fix going forward: always run verify-phase, always write VERIFICATION.md.

### Patterns Established
- **Decimal phases for recovery.** When a major phase (15) ships partially-working code, prefer a decimal phase chain (15.2 attempt → 15.3 teardown → 15.4 gap closure) over in-place rework. Each decimal phase has its own PLAN/SUMMARY/VERIFICATION, commits are atomic, and the git history tells the honest story of what was tried and what was abandoned.
- **Audit is a milestone gate.** `/gsd:audit-milestone` before `/gsd:complete-milestone` is non-negotiable. The milestone audit found 3 live bugs that per-phase verifications missed because per-phase verifications check "did the phase's must_haves pass" while the milestone audit checks "do the requirements actually work end-to-end". Both are needed.
- **Superseded requirements are first-class.** Phases can supersede each other's requirements. Mark them explicitly in the audit (`superseded:` list), don't count them against the score, and don't count them as gaps. `IMG-BONUS-01`, `IMG-BONUS-02`, `SYNTH-RENDER-01` were all intentionally deleted, not unsatisfied.

### Key Lessons
- **When a third-party tool fights you 3+ times, stop fighting.** Phase 15.2's injection failures were LibreChat telling us "this rendering path is not meant to be written to externally". The right move was to redesign around what the tool supports natively, which is what 15.3 did.
- **Schema without write path is a bug, not a feature.** Any new field in a state collection needs an increment/write path AND a test that proves that path runs in at least one end-to-end scenario. `monthlySpendEur` had the former but not the latter.
- **Gap closure can be small.** Phase 15.4 was 4 code tasks + 1 deploy, autonomous, all atomic commits, shipped in one execute-phase run. Gap closure shouldn't feel like a second milestone — if the audit is precise, the fix is usually 10-20 LOC of targeted patches + tests.

### Cost Observations
- Model mix: 100% Sonnet for executors/planner/verifiers/researcher, Opus for orchestrator
- Sessions: 1 extended session across plan-phase → execute-phase → audit → gap close → complete
- Notable: Autonomous gap-closure plan (15.4) required zero user interaction from spawn to deploy — shows the value of precise audit files as planner input

## Cross-Milestone Trends

| Metric | v1.0 | v2.4 |
|--------|------|------|
| Phases | 3 | 5 |
| Plans | 10 | 9 |
| Timeline | 1 day | 4 days |
| Custom code | 0 lines | ~400 LOC added, ~800 LOC deleted (net −400) |
| Config files | 1 (librechat.yaml) | librechat.yaml + budget.ts + 2 crons + settings UI |
| Tests | 0 | 65 passing (6 suites) |
