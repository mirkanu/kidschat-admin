---
slug: cron-retry-fix
date: 2026-04-22
status: complete
---

# Summary: Cron retry fix

## Root cause
`railway.toml` cron commands used `curl -fsS` with no retry logic. A prior session
intended to add `--retry` flags but they were never actually written to the file —
only noted in memory. One transient HTTP error (e.g. admin restarting, returning 503
or 401) caused the cron deployment to exit non-zero → CRASHED → Railway never fires
it again.

## Fix
Added `--retry 5 --retry-delay 10 --retry-all-errors` to all three cron curl commands
in `railway.toml` (daily-reset, monthly-reset, daily-notifications). Deployed to Railway.

## Commit
e9fa07a — fix(cron): add --retry 5 to all Railway cron curl commands
