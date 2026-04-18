---
created: 2026-04-18T00:28:57.907Z
title: Set up Resend custom domain for multi-recipient email delivery
area: api
files:
  - src/app/(dashboard)/notifications/page.tsx (amber banner to remove)
  - src/lib/email-utils.ts:1-3 (getFromAddress reads RESEND_FROM_ADDRESS)
  - kidschat-admin Railway service env (RESEND_FROM_ADDRESS to update)
  - notification_recipients MongoDB collection (re-enable Emily-Kate alerts)
---

## Problem

`RESEND_FROM_ADDRESS` is currently `onboarding@resend.dev` (Resend's sandbox sender), which only allows sends to the account owner email (`manuelkuhs@gmail.com`). When Emily-Kate was added as a notification recipient on 2026-04-17 at 14:28 UTC, all multi-recipient daily-summary sends started failing with HTTP 403 (`validation_error: You can only send testing emails to your own email address`).

**Current state (2026-04-18):**
- Emily-Kate is in `notification_recipients` collection but ALL 4 alert subscriptions are temporarily set to `false` (safetyAlerts, weeklyDigest, dailySummary, accountActivity). She receives no emails.
- Amber banner on `/notifications` page explains this to admin.
- Daily-summary cron at 08:00 UTC will succeed (only Manuel as active recipient) but Emily-Kate misses everything.

## Solution

1. **Pick a domain.** Recommended: subdomain of an owned domain (e.g. `mail.kuhsfamily.com`) to isolate from main DNS. Could also use bare domain or a new dedicated one.
2. **Add the domain at Resend.** Either via dashboard at https://resend.com/domains or via API:
   ```
   curl -X POST https://api.resend.com/domains \
     -H "Authorization: Bearer $RESEND_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name":"mail.kuhsfamily.com","region":"us-east-1"}'
   ```
   Response includes 4-5 DNS records (SPF TXT, DKIM TXT, MX or CNAME).
3. **Add DNS records** at user's DNS provider (TBD which provider — ask user). Wait for propagation (usually <15 min, sometimes hours).
4. **Trigger Resend verification:**
   ```
   curl -X POST https://api.resend.com/domains/{domain_id}/verify \
     -H "Authorization: Bearer $RESEND_API_KEY"
   ```
   Poll `GET /domains/{domain_id}` until `status: verified`.
5. **Update Railway env:**
   ```
   railway variables --service kidschat-admin --set RESEND_FROM_ADDRESS="KidsChat <noreply@mail.kuhsfamily.com>"
   ```
   Then `railway up --service kidschat-admin --detach` (env change alone may need a redeploy to pick up — Next.js inlines env at build for some cases).
6. **Re-enable Emily-Kate's subscriptions** in MongoDB:
   ```js
   db.notification_recipients.updateOne(
     { email: 'kuhs.emilykate@gmail.com' },
     { $set: { 'alerts.safetyAlerts': true, 'alerts.weeklyDigest': true, 'alerts.dailySummary': true, 'alerts.accountActivity': false }}
   )
   ```
   (accountActivity was originally false — keep that as-is)
7. **Remove the amber banner** at `src/app/(dashboard)/notifications/page.tsx` (the one starting `{/* Single-recipient banner — Resend sandbox sender ... */}`)
8. **Test:** trigger `/api/notify/daily-summary` and confirm both inboxes receive the email.

## Why deferred

User chose to defer 2026-04-18 — needs to decide on domain + has DNS access. Lower priority than UAT-driven product work.
