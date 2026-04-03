---
phase: 01-deployment
plan: 01
subsystem: infra
tags: [railway, librechat, mongodb, meilisearch]

requires:
  - phase: none
    provides: first phase
provides:
  - LibreChat Lite deployed on Railway with 3 healthy services
  - Two admin accounts (Manuel + Emily-Kate) created and verified
  - Public URL: https://librechat-production-bff2.up.railway.app
affects: [01-02, 01-03, 01-04, phase-2, phase-3]

tech-stack:
  added: [librechat-dev:latest, mongo:latest, meilisearch:v1.11.3]
  patterns: [railway-cli-deployment, api-based-user-creation, mongodb-tcp-proxy-for-admin]

key-files:
  created: []
  modified: []

key-decisions:
  - "Used Railway CLI (not dashboard) for all deployment steps"
  - "Created admin accounts via LibreChat registration API before lockdown"
  - "Promoted Emily-Kate to ADMIN via MongoDB TCP proxy (direct DB update)"
  - "Database name is 'test' not 'LibreChat' in Railway template"

patterns-established:
  - "Railway CLI automation: railway init, deploy, variable set, service status"
  - "MongoDB TCP proxy for external admin access"

requirements-completed: [DEPL-01, DEPL-02]

duration: 15min
completed: 2026-04-03
---

# Plan 01-01: Deploy LibreChat Lite + Create Admin Accounts

**LibreChat Lite deployed on Railway with MongoDB + Meilisearch, two admin accounts created (Manuel as ADMIN, Emily-Kate promoted to ADMIN via MongoDB).**

## What was done

1. Created Railway project "KidsChat" via `railway init`
2. Deployed LibreChat Lite template (`_fTxzh`) — provisions LibreChat, MongoDB, Meilisearch
3. Generated public domain: https://librechat-production-bff2.up.railway.app
4. Created Manuel's admin account via registration API (auto-assigned ADMIN as first user)
5. Created Emily-Kate's account via registration API (email: kuhs.emilykate@gmail.com)
6. Promoted Emily-Kate to ADMIN via MongoDB TCP proxy (database is `test`, not `LibreChat`)

## Issues encountered

- Railway SSH swallows stdout — scripts run but produce no visible output
- MongoDB database name is `test` (not `LibreChat` as assumed by research) — discovered via database enumeration
- Emily-Kate's account was initially `USER` role — required direct MongoDB update since LibreChat admin API has no role-change endpoint
- Enabled TCP proxy on MongoDB via Railway GraphQL API to connect externally

## Verification

- Both accounts log in successfully via API
- Manuel: role ADMIN ✓
- Emily-Kate: role ADMIN ✓
- All 3 Railway services healthy ✓
