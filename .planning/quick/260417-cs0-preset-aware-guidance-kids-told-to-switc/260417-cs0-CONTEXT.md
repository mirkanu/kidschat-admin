# Quick Task 260417-cs0: Preset-Aware Guidance - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Task Boundary

Add preset-aware guidance to all 5 agent presets in MongoDB's `agents` collection so kids get pointed to the right preset:

- **Text presets** (Friendly Tutor, Casual Buddy, Balanced Helper, Standard Formal): when the kid asks for a drawing/image, respond with a friendly redirect to Drawing Studio.
- **Drawing Studio**: when the kid's message is clearly off-topic (not a drawing request and not a clarification reply during an in-progress drawing flow), refuse gently and redirect to any chat preset.

Plus cleanup: delete the stray "Image Generator" agent (agent_F6ITBo7EuorE7vqrXsNAm) that isn't in the UI preset picker but has DALL-E access.

Implementation is purely the `instructions` field on each agent doc — no code changes. All 5 presets already exist; their IDs and current `instructions` have been verified from MongoDB.
</domain>

<decisions>
## Implementation Decisions

### Switch-to language (text presets → Drawing Studio)
- Use **named preset + UI hint**: phrasing like "I can't draw here! Tap the preset picker at the top and choose **Drawing Studio** ✨"
- Names the exact UI control so kids don't get lost hunting for it

### Drawing Studio off-topic gate (nuanced)
- **Not** a simple "block everything non-drawing" filter — that would break the existing clarification-before-generation training (where the agent asks "what kind of dog? color? setting?" before burning DALL-E tokens).
- Permit two kinds of text turns in Drawing Studio:
  1. **Drawing request** — "draw me X", "can you make a picture of…", etc.
  2. **Clarification reply** during an in-progress drawing flow — e.g. kid answering the agent's "what color?" question.
- **Refuse** anything else (off-topic chat, general questions, math homework, etc.) with a message like: "I only help with drawings here — switch to any chat preset (Friendly Tutor, Casual Buddy, Balanced Helper, or Standard Formal) to chat." Kids get to pick which chat preset to use.

### Target preset after drawing (from Drawing Studio)
- **Generic wording** mentioning all 4 text presets or "any chat preset" — kid chooses which one to go back to.
- No automatic preset switching: LibreChat has no agent-side mechanism to drive UI actions (preset picker is user-controlled). Auto-switch would require a frontend patch to LibreChat → out of scope for quick task. Parked as a potential future phase if manual switching feels clunky in practice.

### Stray Image Generator agent
- **Delete** agent `agent_F6ITBo7EuorE7vqrXsNAm` ("Image Generator", tools:[dalle]) from MongoDB.
- Not in the UI preset picker (librechat.yaml modelSpecs only references the 5 intended presets), so not kid-reachable via normal flow. Removing it eliminates any residual DALL-E access surface.

### Claude's Discretion
- Exact wording of the refusal/redirect messages — conversational, kid-age appropriate (10-14), uses one friendly emoji max.
- Whether to inject the new guidance as a new section in the existing `instructions` or weave it into existing sections — implementor picks based on readability of resulting prompt.
- Whether to append a closing reminder after a drawing generates successfully ("Want to chat about something else? Switch to any chat preset!") — optional nudge, low token cost if terse. Recommend: yes, one short line.
</decisions>

<specifics>
## Specific Ideas

**Agent IDs + current state (verified 2026-04-17 from MongoDB):**

| Agent name (MongoDB) | Agent ID | Tools | UI label |
|---|---|---|---|
| KidsChat Friendly Tutor | `agent_wxgt6su7d3pcosiil3` | `[]` | "Friendly Tutor" (default) |
| KidsChat Casual Buddy | `agent_y4w1cvoyg77p9thed9` | `[]` | "Casual Buddy" |
| KidsChat Balanced Helper | `agent_64q6z5s57552cpgl0hr` | `[]` | "Balanced Helper" |
| KidsChat Standard Formal | `agent_aiv99mzvdzquym6y89k` | `[]` | "Standard Formal" |
| KidsChat Drawing Studio | `agent_kidschat_drawing_1775634945891` | `["dalle"]` | "Drawing Studio" |
| Image Generator (stray) | `agent_F6ITBo7EuorE7vqrXsNAm` | `["dalle"]` | (not in UI picker) |

**MongoDB connection for editing:**
- External TCP proxy: `mongodb://mongo:bnwf4anlnxzvdrkwlvi4ki6q7p52o33q@switchyard.proxy.rlwy.net:57501`
- DB: `test`, collection: `agents`, update field: `instructions`

**Example new guidance block (text presets, draft):**
```
## DRAWING REQUESTS

If the child asks you to draw, generate, create, or make an image/picture/drawing, DO NOT attempt to draw — you don't have image tools in this mode. Instead, redirect them warmly:

"I can't draw here! Tap the preset picker at the top and choose **Drawing Studio** to make pictures. ✨"

Keep the redirect short and friendly. Don't lecture. After the redirect, don't continue the conversation about drawing — they need to switch presets first.
```

**Example new guidance block (Drawing Studio, draft):**
```
## STAY ON TOPIC

Your purpose is drawings and drawings only. BUT asking clarifying questions about a drawing-in-progress is on-topic (e.g. "what color?", "indoor or outdoor scene?") — those are part of your drawing workflow.

If the child asks about anything else — homework, general questions, just chatting — gently redirect:

"I only help with drawings here! To chat, switch to any chat preset — Friendly Tutor, Casual Buddy, Balanced Helper, or Standard Formal."

After a drawing generates successfully, you MAY add one short line to remind them they can switch back:

"Want to chat about something else? Switch to any chat preset to save your daily budget."
```
</specifics>

<canonical_refs>
## Canonical References

- Phase 19-01 SUMMARY: `.planning/phases/19-investigate-why-kids-20c-daily-budget-exhausts-after-2-3-que/19-01-SUMMARY.md` — established that agent tool binding is at MongoDB agent level (not librechat.yaml), $pull pattern used for tool array edits.
- Live librechat.yaml: Gist revision `4392903e` at `https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/4392903e406fb1958d9389a6cbeaa424db7945bc/librechat.yaml` — defines the 5 UI presets (friendly-tutor, casual-buddy, balanced-helper, standard-formal, drawing-studio). No changes needed to Gist for this task.
- Memory: `/data/home/.claude/projects/-data-home-KidAI/memory/feedback_automate_railway.md` — Railway GraphQL mechanics (not used in this task; purely MongoDB edits).
</canonical_refs>
