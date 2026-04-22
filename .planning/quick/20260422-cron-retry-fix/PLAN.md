---
slug: cron-retry-fix
date: 2026-04-22
status: in-progress
---

# Fix: Add retry logic to Railway cron curl commands

## Problem
`daily-reset-cron` and `daily-notifications-cron` Railway services crash on any transient
HTTP error because `railway.toml` cron commands use `curl -fsS` with no retry flags.
Railway marks a cron deployment CRASHED and never fires it again.

Root cause confirmed: memory note about adding retries was never applied to `railway.toml`.

## Fix
Add `--retry 5 --retry-delay 10 --retry-all-errors` to every curl call in `[[deploy.crons]]`
inside `railway.toml`. Deploy to Railway so the cron service definitions update.

## Tasks
- [ ] Update railway.toml curl commands with retry flags
- [ ] Commit
- [ ] Deploy via `railway up`
- [ ] Verify both cron services show SUCCESS
