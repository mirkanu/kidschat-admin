---
phase: 01-deployment
plan: 02
subsystem: infra
tags: [railway, anthropic-api, registration-lockdown]

requires:
  - phase: 01-01
    provides: Running LibreChat instance with admin accounts
provides:
  - Anthropic API connected with Claude Haiku 4.5
  - All registration and social login paths closed
  - Security env vars configured
affects: [01-03, 01-04, phase-2]

tech-stack:
  added: []
  patterns: [railway-variable-batch-set, skip-deploys-then-redeploy]

key-files:
  created: []
  modified: []

key-decisions:
  - "Set all env vars with --skip-deploys then single redeploy for efficiency"
  - "All three ALLOW_* variables set together (registration, social login, social registration)"
  - "Added ALLOW_UNVERIFIED_EMAIL_LOGIN=true for admin-created accounts"

patterns-established:
  - "Batch env var updates: railway variable set --skip-deploys then railway redeploy --yes"

requirements-completed: [DEPL-03, AUTH-01, AUTH-02, AUTH-03, AUTH-04]

duration: 8min
completed: 2026-04-03
---

# Plan 01-02: Configure API + Registration Lockdown

**Anthropic API connected (Claude Haiku 4.5 responding), all registration and social login paths closed via environment variables.**

## What was done

1. Set 11 environment variables on LibreChat service via Railway CLI:
   - API: ANTHROPIC_API_KEY, ANTHROPIC_MODELS=claude-haiku-4-5, ENDPOINTS=anthropic
   - Lockdown: ALLOW_REGISTRATION=false, ALLOW_SOCIAL_LOGIN=false, ALLOW_SOCIAL_REGISTRATION=false
   - Auth: ALLOW_UNVERIFIED_EMAIL_LOGIN=true
   - Security: TRUST_PROXY=1, NO_INDEX=true, ALLOW_SHARED_LINKS_PUBLIC=false, MIN_PASSWORD_LENGTH=12
2. Triggered single redeploy after batch variable set

## Verification

- Registration attempt returns "Registration is not allowed." ✓
- Config API confirms: registrationEnabled=False, socialLoginEnabled=False ✓
- All individual social providers (Google, GitHub, Discord, etc.) disabled ✓
- API models endpoint shows anthropic: ["claude-haiku-4-5"] only ✓
