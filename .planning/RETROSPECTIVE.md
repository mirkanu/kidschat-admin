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

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 3 |
| Plans | 10 |
| Timeline | 1 day |
| Custom code | 0 lines |
| Config files | 1 (librechat.yaml) |
