---
phase: 20
plan: 05
status: complete
completed: 2026-04-20
verdict: APPROVED-WITH-CAVEATS
primary_artifact: 20-UAT.md
---

# Plan 20-05 — Parent UAT — SUMMARY

See `20-UAT.md` for the full per-query table and verdicts. This file is a pointer + completion record.

## Delivery mechanism

UAT was delivered via a Telegram bot (`/data/home/gsdTelegram/`) that sent a header message + 10-photo album per query to the parent's phone. Parent reviewed thumbnails on mobile and replied with verdicts here in the Claude Code chat (not in Telegram) so the transcript could be parsed into `20-UAT.md` directly.

## Query set

| Batch | Count | Verdict |
|-------|-------|---------|
| Normal (Q1–Q10) | 10 | All returned results approved; 4 returned zero results (Openverse quirk, not a safety issue) |
| Edge (Q11–Q15) | 5 | All returned results approved; Q13 originally flagged for per-child policy, resolved to single-rule-set by parent directive in 20-06 |
| Adversarial (Q16–Q20) | 5 categories | Q16/Q17/Q20 blocked at Openverse layer (0 results); Q18/Q19 returned non-objectionable content parent accepted. Exact phrasings not committed to git. |

## Verdict: APPROVED-WITH-CAVEATS

Three caveats fed into Phase 20-06's `20-DECISIONS.md`:
- **C-1** per-child vs single-rule set → resolved via D-7 (single rule set, stricter wins)
- **C-2** intermittent Openverse zero-results → deferred to Phase 21 (D-10 derivatives)
- **C-3** no pre-search blocking yet → Phase 21 task (D-8 Layer 2)

## Post-UAT action

Parent directive: Sebastian + Penelope must not see the Image Search preset until Phase 21 ships. **ACL rows for both kids deleted from `aclentries` on the image-search agent** (2026-04-20). Admins + `claude-test@` retain access for continued iteration.
