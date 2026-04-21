# Requirements — v2.9 Kid Image Search + Test Mode Preset Parity

## Milestone Goal

Penelope and Sebastian can search the web for images inside LibreChat via a dedicated "Image Search" preset — no external browser, no source-site navigation, full parent oversight. Parents can dry-run any preset (including tool-using ones like Image Search and Drawing Studio) from admin Test Mode before it hits the kids.

## v1 Requirements

### Search (kid-facing)

- [ ] **SEARCH-01**: A new "Image Search" preset appears in the LibreChat preset selector alongside the existing 5 presets (4 text + Drawing Studio).
- [x] **SEARCH-02**: Typing a query in the Image Search preset returns an inline grid of 8-12 thumbnail images within the chat message.
- [x] **SEARCH-03**: The image-search tool calls a kid-safe provider with SafeSearch forced to `strict`; SafeSearch cannot be downgraded from the kid side.
- [ ] **SEARCH-04**: Image URLs render inline as plain images, not as clickable hyperlinks to source sites (option iii click-through policy).
- [ ] **SEARCH-05**: The agent returns only a markdown image grid — no text commentary, no AI reasoning about the images, no image manipulation.
- [x] **SEARCH-06**: Images from hotlink-blocking sources render via a server-side proxy fallback so no broken-image icons appear.
- [x] **SEARCH-07**: A per-child, per-day search-count cap is enforced independently of the existing daily cost cap.
- [ ] **SEARCH-08**: The search-count cap has a sensible default and can be overridden per child via the admin dashboard (same UI pattern as existing daily cost overrides).

### Safety (defense-in-depth)

- [x] **SAFETY-01**: A configurable domain blocklist filters results after the provider's SafeSearch, before rendering to the kid.
- [x] **SAFETY-02**: Existing `detectSafetyEvent` pattern matching runs on the kid's raw query text; concerning patterns fire the existing parent email alert pipeline (no new notification code path required).

### Oversight (parent visibility)

- [x] **OVERSIGHT-01**: Every image-search query + returned URLs are logged to MongoDB via the existing LibreChat conversation/message write path — no custom logging code required.
- [x] **OVERSIGHT-02**: The admin dashboard conversation log displays Image Search conversations with a visible preset badge distinguishing them from text-chat conversations.
- [x] **OVERSIGHT-03**: The daily-summary email includes a per-child "Image searches today" count and a sample of recent queries, matching the paraphrased-summary style introduced in quick task 260417-p94.

### Test Mode (admin parity)

- [ ] **TESTMODE-01**: The admin-dashboard Test Mode page includes a preset/agent selector exposing all 6 presets (4 text + Drawing Studio + Image Search).
- [ ] **TESTMODE-02**: Test Mode executes the selected preset with tool parity — DALL-E for Drawing Studio, web_image_search for Image Search — so the parent sees exactly what a kid sees.
- [ ] **TESTMODE-03**: Test Mode's behavior for each preset matches the kid experience closely enough that a parent can use it to catch unsafe-result regressions before deploying preset/tool changes (verified via a side-by-side parity UAT).

## Future Requirements

- Text/web search preset (homework facts, "what is the capital of…") — natural follow-up if Image Search lands well
- Parent-approval queue for searches flagged by safety patterns (currently: alert-only)
- Curated domain allowlist mode (vs. current blocklist approach) — if blocklist proves insufficient
- Search history page in kid-facing admin dashboard section (if it ever exists)
- Save/download-to-parent-shared-folder workflow for images kids want to keep

## Out of Scope

- **LibreChat fork** — preset + tool only; avoid the maintenance burden called out in the Phase 17 memory
- **Kid-facing portal / separate search app** — preset approach obsoletes this for v2.9
- **ML-based image safety moderation** — trust provider SafeSearch + domain blocklist for this milestone
- **Text/web search results** — image search only for v2.9
- **Click-through navigation to source sites** — explicit design choice (option iii); kids save/screenshot instead
- **Image attribution / credit metadata display** — kept minimal to avoid clutter and accidental click-through vectors

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SEARCH-01 | Phase 21 | Planned |
| SEARCH-02 | Phase 21 | Planned |
| SEARCH-03 | Phase 21 | Planned |
| SEARCH-04 | Phase 21 | Planned |
| SEARCH-05 | Phase 21 | Planned |
| SEARCH-06 | Phase 21 | Planned |
| SEARCH-07 | Phase 21 | Planned |
| SEARCH-08 | Phase 21 | Planned |
| SAFETY-01 | Phase 21 | Planned |
| SAFETY-02 | Phase 21 | Planned |
| OVERSIGHT-01 | Phase 21 | Planned |
| OVERSIGHT-02 | Phase 21 | Planned |
| OVERSIGHT-03 | Phase 21 | Planned |
| TESTMODE-01 | Phase 22 | Planned |
| TESTMODE-02 | Phase 22 | Planned |
| TESTMODE-03 | Phase 22 | Planned |

**Note on Phase 20:** Phase 20 is a research+POC phase whose deliverable is architectural decisions (tool mechanism, provider, hotlink mitigation, Test Mode architecture) and a working staging POC. It does not close any v1 requirements directly — every SEARCH/SAFETY/OVERSIGHT/TESTMODE requirement closes in Phase 21 or Phase 22. Phase 20's decisions are load-bearing for both downstream phases.
