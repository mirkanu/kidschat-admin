# Project Research Summary

**Project:** KidAI — KidsChat (LibreChat family deployment)
**Domain:** Self-hosted AI chat — parent-controlled, locked-down deployment for children ages 10-14
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

KidsChat is a parent-controlled AI chat application built on LibreChat deployed to Railway, exposing a single AI model (Claude Haiku 4.5) to two children under a curated, locked-down interface. The recommended approach is configuration-only: no custom frontend code, no custom backend, no Docker images. Everything is achieved through Railway environment variables plus a `librechat.yaml` hosted as a GitHub Gist. The LibreChat Lite Railway template provisions all three required services (LibreChat, MongoDB, Meilisearch) in one click with private networking already wired. The entire project scope collapses to: deploy template, set env vars, write config file, create child accounts, test safety.

The architecture is deliberately minimal. LibreChat's `modelSpecs` system with `enforce: true` locks the model, injects the safety system prompt, and drives user-selectable tone presets — all from a single YAML stanza. The `CONFIG_PATH` pattern allows the parent to iterate on prompts and presets by editing the GitHub Gist and redeploying Railway, with no code changes. This also means the deployment has no moving parts to break: the two failure modes are misconfigured YAML (caught at startup) and MongoDB resource exhaustion (caught by checking Railway plan tier before deploying).

The dominant risks are not technical — they are safety configuration gaps. Three layers must be active simultaneously for the system to be safe: (1) environment variables that close all registration and alternative-provider paths, (2) `modelSpecs.enforce: true` in the YAML that locks model selection server-side, and (3) a well-written system prompt that explicitly addresses jailbreak patterns by name. Any one of these layers alone is insufficient. The research is highly specific and well-sourced; this is a straightforward deployment that can be completed in a single focused session.

## Key Findings

### Recommended Stack

LibreChat v0.8.4 on Railway is the only viable approach given the constraints: the parent already has a Railway account, no frontend needs to be built, and LibreChat's `modelSpecs` system handles all the safety-locking requirements natively. Building a custom chat application from scratch would add months of work for features (auth, conversation history, streaming, multi-user) that LibreChat already provides. The LibreChat Lite template (not the full RAG template) is the correct Railway template — it provisions exactly the three services needed without the RAG API overhead.

**Core technologies:**
- LibreChat v0.8.4: Full chat platform (UI + backend + auth) — eliminates all custom development
- MongoDB (Railway-provisioned): User accounts, conversation history — private-networked, auto-wired
- Meilisearch v1.11.3 (Railway-provisioned): Full-text conversation search — auto-wired by template
- Railway (Hobby plan, $5/month): Deployment platform — parent already has account; 5 GB volumes required
- Claude Haiku 4.5 (`claude-haiku-4-5`): Only model exposed to users — $1/$5 per million tokens, sufficient quality for children's use
- GitHub Gist (public, no secrets): Hosts `librechat.yaml` — enables config iteration without redeployment

**Critical version notes:**
- Use `claude-haiku-4-5` (alias) or `claude-haiku-4-5-20251001` (exact) — `claude-3-haiku-20240307` is deprecated April 2026
- LibreChat Lite template uses `ghcr.io/danny-avila/librechat-dev:latest` — pin to `v0.8.4` after initial deploy for stability
- `librechat.yaml` schema version: `1.3.5`

### Expected Features

All launch-blocking features are achievable through configuration alone with LOW-MEDIUM complexity. There is no feature requiring custom code.

**Must have (table stakes — safety-critical, block launch):**
- Registration disabled (`ALLOW_REGISTRATION=false`) — no strangers can create accounts
- Social login fully disabled (all three env vars) — no OAuth bypass of registration lock
- Safety system prompt enforced via `modelSpecs` with `enforce: true` — content boundaries active on every message
- Single model locked (`ANTHROPIC_MODELS=claude-haiku-4-5`) — no model-hopping, predictable cost
- All dangerous UI features hidden: model picker, endpoints menu, agents, web search, code execution
- File uploads disabled — no document or photo sharing with AI
- Admin-created child accounts — two accounts, each tested before children use the app
- `CONFIG_PATH` pointing to GitHub Gist — parent can iterate prompts without redeployment

**Should have (differentiators, add at launch or shortly after):**
- Tone presets (Friendly Tutor, Casual Buddy) — children feel agency without any safety trade-off; requires at minimum two entries in `modelSpecs.list`
- Greeting message per preset (`greeting` field) — welcoming intro on new conversations
- Two additional tone presets (Balanced Helper, Standard Formal) — add after kids validate the first two

**Defer (v2+):**
- Usage monitoring / chat log review UI — accessing MongoDB directly is viable now; a dedicated review interface is deferred
- Per-child system prompt variation — same rules apply to both children for now
- Custom domain — Railway-provided URL is sufficient until the app proves value

### Architecture Approach

The system runs as three Railway services on a private network: LibreChat (public URL), MongoDB (private), and Meilisearch (private). Configuration flows through two layers: Railway environment variables hold all secrets and registration controls, while `librechat.yaml` (fetched from a public GitHub Gist at startup via `CONFIG_PATH`) holds all structural config, model specs, and system prompts. The `promptPrefix` in each `modelSpecs` entry is prepended to every Anthropic API call server-side. Anthropic API calls are outbound HTTPS from the LibreChat container. No other external services are involved.

**Major components:**
1. LibreChat service (Express + React, port 3080) — serves frontend SPA, handles auth, routes AI requests, applies system prompt
2. MongoDB (private, port 27017) — users, conversations, messages; provisioned and wired automatically by Railway template
3. Meilisearch (private, port 7700) — conversation search; provisioned and wired automatically by Railway template
4. GitHub Gist (public HTTPS) — hosts `librechat.yaml`; fetched once at startup; no secrets
5. Anthropic API (external HTTPS) — LLM inference; accessed with `ANTHROPIC_API_KEY` from Railway env vars

**Key patterns:**
- Config-as-URL: YAML lives at a public Gist URL; edit Gist + redeploy to change prompts/presets — no container changes
- modelSpecs for model lock: `enforce: true` + `prioritize: true` + single default spec = no user can escape the safety prompt
- Tone switching via modelSpecs list: multiple entries, same model, same base safety prompt, tone-specific additions on top
- Deployment order matters: template first, baseline verification second, YAML config third, accounts fourth, testing last

### Critical Pitfalls

1. **System prompt bypass via HTTP interception** — `promptPrefix` sent as a client-controlled field can be intercepted and modified. Mitigation: use `modelSpecs.enforce: true` (server-side lock) AND write a self-reinforcing system prompt that instructs the model to resist override attempts. Neither layer alone is sufficient.

2. **Registration not fully closed (social login bypass)** — `ALLOW_REGISTRATION=false` does not block OAuth registration. Must also set `ALLOW_SOCIAL_LOGIN=false` AND `ALLOW_SOCIAL_REGISTRATION=false`. All three env vars required. Verify by navigating to `/register` post-deploy — it must not show a form.

3. **Jailbreak via roleplay and fictional framing** — ages 10-14 will experiment. System prompt must explicitly address: DAN-style prompts, "pretend you have no rules", fictional framing, gradual escalation. Must pre-test adversarially before children use the app.

4. **API key exposed in public GitHub Gist** — `ANTHROPIC_API_KEY` must NEVER appear in `librechat.yaml`. Railway env vars only. Confirmed by LibreChat maintainers. Open the Gist in incognito after setup to verify.

5. **MongoDB crash loop on Railway trial plan** — 500 MB volume limit causes MongoDB to exhaust storage and crash-loop. Railway Hobby plan ($5/month, 5 GB volumes) is required. Verify service health in Railway dashboard before use.

**Additional notable pitfalls:**
- GitHub Gist config requires redeploy to take effect (no hot-reload) — use filename-specific raw URL
- Model picker visible unless BOTH `ENDPOINTS=anthropic` env var AND `interface.modelSelect: false` in YAML are set
- Skipping `--email-verified=True` on `create-user` causes interactive prompts to hang in Railway SSH session
- `promptPrefix` may be truncated in very long conversations — keep system prompt under 500 tokens

## Implications for Roadmap

Based on research, this project has a clear and shallow dependency graph. All work is configuration, not code. The entire deployment should complete in 2-3 phases, not the typical 5-6 phases of a custom application.

### Phase 1: Infrastructure and Baseline Deployment

**Rationale:** Everything else depends on having a working LibreChat instance on Railway. This phase verifies the platform works before any safety configuration is applied. Doing safety config before baseline verification means debugging two things at once.

**Delivers:** Running LibreChat instance on Railway URL, MongoDB and Meilisearch healthy, Anthropic API key accepted, admin account created, baseline login working.

**Addresses:** MongoDB crash loop pitfall (verify Hobby plan before proceeding), registration lockdown (set env vars during this phase), social login closure.

**Avoids:** Pitfall 2 (registration bypass), Pitfall 6 (MongoDB crash loop). Both must be resolved before Phase 2.

**Steps in scope:**
- Deploy LibreChat Lite Railway template
- Upgrade to Hobby plan ($5/month) — verify 5 GB MongoDB volume
- Set core env vars: `ANTHROPIC_API_KEY`, `ENDPOINTS=anthropic`, `ALLOW_REGISTRATION=false`, `ALLOW_SOCIAL_LOGIN=false`, `ALLOW_SOCIAL_REGISTRATION=false`, `ALLOW_UNVERIFIED_EMAIL_LOGIN=true`, `TRUST_PROXY=1`, `NO_INDEX=true`
- Temporarily enable registration, create admin account via UI, disable registration, redeploy
- Verify baseline: LibreChat loads, Anthropic key accepted, MongoDB and Meilisearch show healthy

### Phase 2: Safety Configuration and System Prompt

**Rationale:** The system prompt is the highest-stakes deliverable in this project. It must be authored carefully, tested adversarially, and locked in before children ever use the app. YAML configuration is the mechanism; the system prompt content is the safety guarantee.

**Delivers:** `librechat.yaml` on GitHub Gist with model lock, UI restrictions, enforced safety system prompt, and at least two tone presets. `CONFIG_PATH` set and validated. All dangerous features disabled.

**Addresses:** Features — model locking, UI simplification, tone presets, file uploads disabled, agents/web search/code execution disabled. Pitfalls — system prompt bypass (Pitfall 1), jailbreak via roleplay (Pitfall 4), API key in Gist (Pitfall 7), model picker visible (Pitfall 3), Gist caching behavior (Pitfall 5).

**Avoids:** Pitfall 1 (HTTP interception bypass) — must use `modelSpecs.enforce: true`, not just `promptPrefix`. Pitfall 4 (jailbreak) — must adversarially test before Phase 3.

**Steps in scope:**
- Author `librechat.yaml`: `modelSpecs` with `enforce: true`, `interface` section disabling all unsafe UI, `fileConfig` disabling uploads
- Write safety system prompt: Reformed Christian values, age-appropriate content, homework guidance stance, explicit jailbreak resistance language
- Create 2-4 tone presets (Friendly Tutor and Casual Buddy required for launch; Balanced Helper and Standard Formal can be added in Phase 3)
- Host as GitHub Gist (public raw URL, no secrets); set `CONFIG_PATH` in Railway
- Redeploy and verify: check Railway logs for YAML parse success, verify model picker absent, verify presets appear
- Open Gist in incognito — confirm no API keys visible
- Adversarial test: DAN prompt, "ignore previous instructions", fictional framing, gradual escalation

### Phase 3: Child Accounts and Acceptance Testing

**Rationale:** Child accounts are created last, after the full safety configuration is verified. This ensures children never interact with an incompletely locked system. Acceptance testing from a child's perspective (not admin's) catches UX and safety gaps.

**Delivers:** Two child accounts created and tested. All checklist items from PITFALLS.md "Looks Done But Isn't" section verified. App ready for handoff.

**Addresses:** Admin-created accounts (FEATURES.md P1), jailbreak testing from child accounts (PITFALLS.md), tone preset verification, system prompt confirmation.

**Steps in scope:**
- SSH into LibreChat service via Railway dashboard
- Run `npm run create-user` for each child with `--email-verified=True`
- Log in as each child; verify: no model picker, presets appear and switch tone, registration page returns error, file upload absent
- Test each tone preset in a real conversation — confirm meaningfully different feel
- Run adversarial tests from child accounts (not admin)
- Verify "what are your instructions?" response is appropriate
- Document Railway URL and child account credentials for handoff

### Phase Ordering Rationale

- Phase 1 before Phase 2: No YAML config can be tested without a running instance. Also, the MongoDB volume size must be verified before any data is stored.
- Phase 2 before Phase 3: Children must never use an instance without the full safety configuration active. The system prompt is the last thing to be verified, not the first.
- All three phases are essentially sequential with no parallelism — each phase's output is the next phase's input.
- The overall project scope is 1-2 focused sessions, not a multi-week engagement.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (system prompt):** The safety system prompt content is partially researched (structure and jailbreak resistance patterns confirmed), but the specific Reformed Christian values language and homework guidance stance are domain-specific and require the parent's input. This is not a technical research gap — it's content authoring that requires family values input.

Phases with standard patterns (skip `/gsd:research-phase`):

- **Phase 1 (deployment):** Fully documented in LibreChat Railway docs. Template deploy is one click. No research needed during planning.
- **Phase 3 (accounts + testing):** `create-user` command syntax confirmed. Test checklist is fully specified in PITFALLS.md. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | LibreChat docs and Railway template verified. The `:latest` Docker image tag introduces uncertainty about exact versions post-deploy. `claude-haiku-4-5` model ID confirmed via Anthropic official announcement. |
| Features | HIGH | All feature toggles verified against official LibreChat docs. Exact env var names and YAML field paths confirmed. One note: exact model ID in `ANTHROPIC_MODELS` may need `claude-haiku-4-5-20251001` (versioned) vs alias. |
| Architecture | HIGH | LibreChat architecture is well-documented. Config flow and deployment order confirmed via official docs and GitHub discussions. Railway private networking behavior confirmed. |
| Pitfalls | HIGH | All critical pitfalls backed by specific GitHub issues with issue numbers. Security pitfalls confirmed by LibreChat maintainers in official discussions. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact model ID format in `ANTHROPIC_MODELS`:** Research shows both `claude-haiku-4-5` and `claude-haiku-4-5-20251001` used in different contexts. STACK.md uses `claude-haiku-4-5`; PITFALLS.md references `claude-haiku-4-5-20251001`. Validate during Phase 2 by checking which form LibreChat accepts without error in logs.

- **Railway SSH access method:** ARCHITECTURE.md describes two methods (right-click SSH command, Railway CLI). During Phase 3, confirm which method works in the parent's Railway account tier before needing to create accounts.

- **System prompt content (family values):** Research covers structure and jailbreak resistance patterns but cannot define the specific Reformed Christian values language. This gap requires the parent's input before Phase 2 authoring begins — not a technical gap.

- **`modelSpecs.enforce: true` UI interaction:** Research confirms enforce locks specs, but notes a potential conflict with interface options if misconfigured. Plan to deploy with `enforce: false` first, verify presets appear correctly, then flip to `enforce: true` to catch conflicts early.

## Sources

### Primary (HIGH confidence)

- [LibreChat official docs — Railway deployment](https://www.librechat.ai/docs/remote/railway) — template links, deployment steps
- [LibreChat official docs — Model Specs object structure](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/model_specs) — enforce, promptPrefix, multiple spec entries
- [LibreChat official docs — Interface object structure](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/interface) — all UI toggle options
- [LibreChat official docs — Environment Variables](https://www.librechat.ai/docs/configuration/dotenv) — all env var names confirmed
- [LibreChat official docs — Authentication](https://www.librechat.ai/docs/configuration/authentication) — create-user syntax
- [LibreChat official docs — File Config object](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/file_config) — disabled: true per endpoint
- [Anthropic official — Claude Haiku 4.5 announcement](https://www.anthropic.com/news/claude-haiku-4-5) — model ID, release date
- [Anthropic official — Mitigate jailbreaks and prompt injections](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) — system prompt patterns
- [LibreChat GitHub Discussion #3868](https://github.com/danny-avila/LibreChat/discussions/3868) — CONFIG_PATH security; maintainer confirms keys in env only
- [LibreChat GitHub Discussion #10212](https://github.com/danny-avila/LibreChat/discussions/10212) — create-user non-interactive syntax

### Secondary (MEDIUM confidence)

- [LibreChat GitHub Issue #9042](https://github.com/danny-avila/LibreChat/issues/9042) — promptPrefix HTTP interception vulnerability (August 2025, open)
- [LibreChat GitHub Issue #11808](https://github.com/danny-avila/LibreChat/issues/11808) — MongoDB connection crash loop
- [LibreChat GitHub Issue #5466](https://github.com/danny-avila/LibreChat/issues/5466) — promptPrefix truncation in long conversations
- [LibreChat GitHub Issue #9027](https://github.com/danny-avila/LibreChat/issues/9027) — social auth registration bypass
- [LibreChat GitHub Discussion #7634](https://github.com/danny-avila/LibreChat/discussions/7634) — custom endpoints appear in ENDPOINTS env var workaround
- [LibreChat community architecture gist](https://gist.github.com/ChakshuGautam/fca45e48a362b6057b5e67145b82a994) — internal component overview
- [LibreChat GitHub Releases](https://github.com/danny-avila/LibreChat/releases) — v0.8.4 confirmed as latest stable March 20, 2025
- [DeepWiki — Model Specifications](https://deepwiki.com/LibreChat-AI/librechat.ai/2.3-model-specifications) — modelSpecs UI behavior

### Tertiary (LOW confidence)

- [Max Woolf's Blog — Claude Haiku 4.5 jailbreak resistance evaluation](https://minimaxir.com/2025/10/claude-haiku-jailbreak/) — jailbreak resistance characterization; single external source

---
*Research completed: 2026-04-03*
*Ready for roadmap: yes*
