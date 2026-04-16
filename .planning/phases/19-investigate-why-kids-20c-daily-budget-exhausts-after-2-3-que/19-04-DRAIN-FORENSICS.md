# 19-04 Drain Forensics Report

**Investigation Date:** 2026-04-16  
**Investigator:** Phase 19 Plan 04 agent  
**Incident:** 194,116 tokenCredits drained from Penelope's account with no transaction records

---

## Timeline

| Time (UTC)        | Event | Source |
|-------------------|-------|--------|
| 18:15:59          | Penelope logs in to LibreChat | Railway log |
| 18:16:00          | LibreChat refreshes avatar list | Railway log |
| 18:33:53          | image.jpg (576x768, 991KB) uploaded by Penelope | MongoDB files |
| 18:34:14          | Conv 3aa0b4f3 started ("Pink Mohawk Bunny Art Request") | MongoDB conversations |
| 18:34:14          | Turn 1 user message sent (tokenCount=1204, 1 file attached) | MongoDB messages |
| 18:34:20          | Turn 1 AI response received (tokenCount=352, think+text content) | MongoDB messages |
| 18:34:20          | Transactions written: Turn 1 prompt (-4,494) + completion (-1,760) | MongoDB transactions |
| 18:34:21          | Title generation transactions written: prompt (-268) + completion (-60) | MongoDB transactions |
| 18:34:42          | Turn 2 user message: "draw it!" (tokenCount=23, no files) | MongoDB messages |
| 18:34:48          | MCP_SERVERS poll warning (Penelope still on page) | Railway log |
| 18:35:17          | DALL-E generated image saved to filesystem | MongoDB files |
| 18:35:20          | Turn 2 AI response received (tokenCount=587, think+text+tool_call+text) | MongoDB messages |
| 18:35:20          | Transactions written: Round 1 prompt (-4,928) + completion (-2,425) | MongoDB transactions |
| 18:35:20          | Transactions written: Round 2 prompt (-8,830) + completion (-510) | MongoDB transactions |
| 18:35:20          | **LAST CONFIRMED BALANCE STATE: 217,391 − 23,275 = 194,116 credits** | Arithmetic |
| 18:36:06          | MCP_SERVERS poll warning (Penelope still on page) | Railway log |
| **18:37:46**      | **IMG_2210.jpeg (576x768, 844KB) + IMG_2211.jpeg (642x1999, 1.9MB) uploaded** | MongoDB files |
| **18:37:46–18:38:44** | **MYSTERY WINDOW: 194,116 credits drain with no log entries or transactions** | Gap analysis |
| 18:38:45          | Conv 4594a8db attempted — ResumableAgentController finds balance=0, blocks | Railway log |
| 18:38:45          | Conv 4594a8db user message stored (tokenCount=3195, 2 files attached) | MongoDB messages |
| 18:39:07          | Conv 61046315 attempted — balance=0 again, blocked | Railway log |
| 18:39:07          | Conv 61046315 user message stored (tokenCount=3197, 2 files attached) | MongoDB messages |
| 18:42:38          | Conv 665d16e9 attempted — balance=0, blocked (text only, no files) | Railway log |
| 18:42:38          | Conv 665d16e9 user message stored (tokenCount=22, no files) | MongoDB messages |
| 21:58:46          | Plan 19-03 manual cron restore: tokenCredits set to 543,478 (0.50 EUR cap) | MongoDB cron_state |

---

## Per-Conversation Accounting

### Conv 3aa0b4f3 (Baseline — Successful DALL-E Session)

| Field | Value |
|-------|-------|
| Title | "Pink Mohawk Bunny Art Request" |
| Messages | 4 (2 user, 2 AI) |
| tokenCount values | 1204, 352, 23, 587 |
| Transaction records | 8 (4 prompt + 4 completion) |
| Files attached | image.jpg (991KB), dalle_img (AI-generated, stored at 18:35:17) |
| error flags | none |
| aborted flags | none |
| Total credits spent | 23,275 |

Transaction breakdown:
- Turn 1: prompt (-4,494) + completion (-1,760) = -6,254
- Title gen: prompt (-268) + completion (-60) = -328
- Turn 2 Round 1: prompt (-4,928) + completion (-2,425) = -7,353
- Turn 2 Round 2: prompt (-8,830) + completion (-510) = -9,340

### Conv 4594a8db (Incident #1 — Blocked by balance=0)

| Field | Value |
|-------|-------|
| Title | "New Chat" |
| Messages | 1 (user message only, no AI response) |
| tokenCount values | 3,195 (user message with 2 large photos) |
| Transaction records | 0 |
| Files attached | IMG_2210.jpeg (576x768, 844KB), IMG_2211.jpeg (642x1999, 1.9MB) |
| error flags | false (no error on message doc) |
| aborted flags | undefined |
| Balance at check time | 0 (from Railway log: `"balance":0`) |
| API call made | NO — blocked by pre-flight balance gate |
| Token cost estimate | 3,195 promptTokens (LibreChat's pre-API estimate) |

### Conv 61046315 (Incident #2 — Blocked by balance=0)

| Field | Value |
|-------|-------|
| Title | "New Chat" |
| Messages | 1 (user message only, no AI response) |
| tokenCount values | 3,197 |
| Transaction records | 0 |
| Files attached | IMG_2210.jpeg, IMG_2211.jpeg (same 2 photos) |
| error flags | false |
| aborted flags | undefined |
| Balance at check time | 0 |
| API call made | NO |
| Token cost estimate | 3,197 promptTokens |

### Conv 665d16e9 (Incident #3 — Blocked, no photos)

| Field | Value |
|-------|-------|
| Title | "New Chat" |
| Messages | 1 (user message only, no AI response) |
| tokenCount values | 22 |
| Transaction records | 0 |
| Files attached | none |
| error flags | false |
| aborted flags | undefined |
| Balance at check time | 0 |
| API call made | NO |
| Note | Sent AFTER balance was already 0; text-only question |

---

## Accounting Delta Summary

Of 194,116 unexplained credits, **0 credits are attributable to any logged API call** (convs 4594a8db, 61046315, and 665d16e9 never reached the Anthropic API — all were blocked by LibreChat's pre-flight balance gate).

**194,116 credits remain entirely unexplained.**

| Starting balance | 217,391 | From April 11 daily reset (eurToTokens(0.20 EUR)) |
|---|---|---|
| Confirmed spend | -23,275 | 8 transactions for conv 3aa0b4f3 |
| Expected remaining | 194,116 | Should have been available for further use |
| Actual balance at 18:38:45 | 0 | Confirmed from ResumableAgentController error log |
| Unaccounted drain | 194,116 | No transactions, no log entries |

The drain occurred in a 58-second window: after 18:37:46 (file upload to MongoDB) and before 18:38:45 (first balance=0 check). The only MongoDB event in this window was the file storage of IMG_2210 and IMG_2211. However, file upload does NOT trigger an Anthropic API call or a balance deduction in LibreChat's normal flow — files are stored to disk and MongoDB only; billing happens when the message containing the files is SENT.

---

## Classification

**Classification: D — Unknown / insufficient evidence (with strong circumstantial correlation to image upload)**

**Justification:**

1. **API calls for convs 4594a8db, 61046315, 665d16e9 were NEVER made.** The ResumableAgentController log confirms `balance:0` was detected at pre-flight check time, blocking all three attempts BEFORE reaching Anthropic. These conversations cannot account for the drain.

2. **The drain happened between 18:35:20 and 18:38:45.** This window contains exactly one MongoDB event: the file upload of IMG_2210 + IMG_2211 at 18:37:46. No API call logs exist for this window (LibreChat v0.8.5-rc1 only logs errors at info level; successful completions are not logged).

3. **The depletion cannot be explained by conv 3aa0b4f3 undercounting.** All 8 transactions are accounted for (total: 23,275). The math is internally consistent. The 8,830 prompt tokens in Round 2 plausibly include the DALL-E image (4 tiles × 750 tokens = 3,000 vision tokens) plus conversation history.

4. **Four alternative hypotheses exhausted:**
   - A (vision cost, transaction write bug): No API call was ever made for the photo messages — this cannot be the cause.
   - B (streaming aborts): The photo messages never started streaming — LibreChat blocked them at balance gate.
   - C (pre-deduction without refund): Plausible but unconfirmed. Would require LibreChat to pre-deduct balance when processing the upload request, not when the message is sent. No evidence of this in logs.
   - D (Unknown): Best fit given evidence.

5. **The 194,116 figure may reflect an incorrect starting balance assumption.** The research assumed starting balance = 217,391 (eurToTokens(0.20 EUR)) based on daily reset logic. However: the balance document was created April 10 by our code using `$max`; the April 11 midnight cron would have found balance=217,391 and applied `$max(217,391, 217,391)` = no change. Between April 11 and April 16 the cron did not run (confirmed broken). If any earlier session consumed part of the balance, the true starting balance on April 16 would be LESS than 217,391, making the "unexplained" deficit correspondingly smaller. However, Penelope has ZERO transaction records before April 16 — confirming she had no spending before today. The 217,391 starting balance assumption is correct.

**The drain is real and unexplained by available evidence.** The most parsimonious explanation is a LibreChat v0.8.5-rc1 bug: balance pre-deduction that occurs at file-upload time or session initialization for large image payloads, bypassing the transaction-write code path. This cannot be confirmed without LibreChat source code inspection or debug logging.

---

## Evidence Log

See `19-04-LOGS-LIBRECHAT.txt` for raw Railway log output.

**Complete log evidence retrieved:** 6 log entries total for the 18:00–19:00 UTC window from deployment 4f74df22. There is a 18-minute gap (18:16:08–18:34:48) during which no log entries exist despite active user sessions. This is consistent with LibreChat not logging successful operations at info level.

**MongoDB evidence completeness:**
- All 8 Penelope transactions: verified
- All 5 Penelope conversations: verified  
- All 8 Penelope messages: verified
- All 4 file uploads (Apr 16): verified with exact byte sizes
- Balance_state history: no audit log (current value only)
- Balances history: no audit log (current value only, currently 543,478 after Plan 19-03 restore)

---

## LibreChat Version + Known Issues

**Version:** LibreChat v0.8.5-rc1  
**Config version:** 1.3.7 (outdated; latest 1.3.8 at time of incident)  
**Deployment:** Railway Docker container, started 2026-04-12T15:06:53  
**Image source:** Railway-managed image (no explicit LIBRECHAT_IMAGE variable found in service)

**Known issues relevant to this incident:**

1. **No balance audit log in LibreChat.** The `balances` collection stores only current `tokenCredits`. There is no history or audit trail. This makes post-hoc forensics impossible for the balance-change sequence.

2. **LibreChat uses `$inc` for balance updates** (per LibreChat source: `api/models/Balance.js`). This is atomic but produces no log and no pre/post snapshot. If a `$inc` fires without a corresponding transaction insert (two separate MongoDB operations), the balance decrements but no evidence exists.

3. **LibreChat GitHub issues — balance drain:**
   - No specific issue found for "pre-deduct + no refund on upload" pattern. The project has issues for "balance not updating" and "credits not reflecting" but none specifically for the file-upload-time drain scenario.
   - LibreChat GitHub: https://github.com/danny-avila/LibreChat/issues

4. **ResumableAgentController behavior (confirmed from logs):** Balance check is a PRE-FLIGHT gate. If `balance < tokenCost`, the error `{"type":"token_balance","balance":0}` is thrown BEFORE any API call. This rules out hypothesis A (API was called and charged without transaction) for the 3 incident conversations.

5. **LOG WARNING observed:** `"The CHECK_BALANCE environment variable is deprecated. Please use the balance field in the librechat.yaml config file instead."` — this is cosmetic but confirms the balance system was in transition between config mechanisms. The yaml-based balance config (which we use) was active.
