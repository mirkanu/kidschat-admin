# Phase 14: Enable & Safeguard Image Generation - Research

**Researched:** 2026-04-07
**Domain:** LibreChat DALL-E 3 configuration, OpenAI image generation safety
**Confidence:** MEDIUM — LibreChat docs are sparse on image gen details; key findings cross-verified via GitHub issues and env.example

## Summary

DALL-E 3 in LibreChat is enabled entirely through environment variables — there is no `librechat.yaml` YAML block for the DALL-E endpoint itself. The critical env var is `DALLE3_API_KEY` (same OpenAI key as any other OpenAI feature). The `DALLE3_SYSTEM_PROMPT` env var provides guidance for how the agent rewrites prompts before sending to DALL-E.

The modern LibreChat architecture (v0.7.5+) routes image generation through the **Agents** endpoint, not the deprecated gptPlugins endpoint. An admin creates an agent in the Agent Builder (via the LibreChat UI), adds the DALL-E-3 tool to it, then exposes it to all users via a `modelSpec` with `endpoint: agents` and `agent_id:`. The `interface.agents` flag in `librechat.yaml` must be `true` (or an object with `use: true`) for users to access this endpoint.

DALL-E 2 cannot be explicitly "disabled" via config — instead, simply do not set `DALLE2_API_KEY`, which means the DALL-E 2 tool has no credentials and cannot be used. DALL-E 3 is controlled by `DALLE3_API_KEY`. This is the practical way to offer DALL-E 3 without DALL-E 2.

Content policy rejection from OpenAI surfaces to the LibreChat UI as a generic "Something went wrong" toast with the raw API message "Your request was rejected as a result of our safety system." This is not child-friendly language. The system prompt guidance (`DALLE3_SYSTEM_PROMPT`) shapes how the agent rewrites user prompts before calling DALL-E, giving a layer of pre-filtering above OpenAI's own safety layer. The `promptPrefix` in a modelSpec (Anthropic conversation system prompt) does NOT directly influence the DALL-E API call — DALL-E only sees what the agent sends via the image tool.

**Primary recommendation:** Set `DALLE3_API_KEY` in Railway env, create a KidsChat Drawing agent in LibreChat UI with DALL-E-3 tool, expose it via modelSpec, set `DALLE3_SYSTEM_PROMPT` for child-appropriate framing, and enable `interface.agents: true` in librechat.yaml.

## Standard Stack

### Core
| Component | Version/Value | Purpose | Why Standard |
|-----------|--------------|---------|--------------|
| `DALLE3_API_KEY` env var | same as `OPENAI_API_KEY` | Authenticates DALL-E 3 API | LibreChat's canonical way to enable DALL-E 3 |
| `DALLE3_SYSTEM_PROMPT` env var | Custom string | Guides agent prompt rewriting for image gen | Only mechanism to pre-filter prompts before DALL-E |
| LibreChat Agents endpoint | v0.7.5+ | Routes image generation tool calls | Replaces deprecated gptPlugins approach |
| DALL-E 3 tool in Agent Builder | n/a | Adds image generation capability to an agent | Official LibreChat image generation path |
| modelSpec with `agent_id` | librechat.yaml | Pre-configures agent for all users without them needing to set up | Standard pattern for admin-curated agents |

### Supporting
| Component | Version/Value | Purpose | When to Use |
|-----------|--------------|---------|-------------|
| `fileConfig.imageGeneration.percentage` | 100 | Controls output image scaling | When you want to override default display size |
| `endpoints.agents.disableBuilder: true` | bool | Prevents users from creating/modifying agents | Lock down to admin-curated agent only |
| `interface.agents.create: false` | bool | Users can use agents but not create new ones | Safer than disableBuilder for user experience |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agents endpoint | gptPlugins endpoint | gptPlugins is deprecated since v0.7.5; causes 404/400 errors with DALL-E 3 |
| DALLE3_API_KEY (separate) | Same as OPENAI_API_KEY | Can reuse same key; separate key allows billing isolation |
| DALLE3_SYSTEM_PROMPT | promptPrefix in modelSpec | promptPrefix controls conversation AI (Anthropic), not DALL-E; must use DALLE3_SYSTEM_PROMPT for image guidance |

**Installation (Railway env vars to add):**
```
DALLE3_API_KEY=<same-value-as-OPENAI_API_KEY>
DALLE3_SYSTEM_PROMPT=<child-safe guidance text>
```

## Architecture Patterns

### How LibreChat Image Generation Works (v0.7.5+)

```
User types: "Draw me a happy dragon"
     ↓
Agent LLM (e.g. Claude Haiku or GPT-4o) receives message
     ↓
DALLE3_SYSTEM_PROMPT guides how agent reformulates the request
     ↓
Agent calls DALL-E 3 tool with reformulated prompt
     ↓
OpenAI DALL-E 3 API: applies its own content filter + auto-rewrites prompt (revised_prompt)
     ↓
Image returned, stored in LibreChat's file storage, displayed in chat
     ↓
If OpenAI rejects: "Something went wrong" + raw API error shown to user
```

### Key Architectural Insight: Two-Layer Safety

1. **Layer 1 — DALLE3_SYSTEM_PROMPT**: Instructs the agent LLM how to rewrite/refuse image prompts before sending to DALL-E. This is where we add child-appropriate guidance.
2. **Layer 2 — OpenAI's built-in content filter**: DALL-E 3 refuses violence, sexual content, real people by default. Cannot be turned off. This is a safety net, not the primary guardrail.

The `promptPrefix` in a modelSpec (Anthropic conversation) does NOT travel to the DALL-E API call. The DALL-E call is made by the agent tool, which only receives the `DALLE3_SYSTEM_PROMPT`. Therefore, image guidance must be in `DALLE3_SYSTEM_PROMPT`, NOT in the modelSpec's `promptPrefix`.

### Pattern 1: Admin-Curated Agent via ModelSpec

1. Admin creates agent in LibreChat Agent Builder UI
2. Adds DALL-E-3 tool to agent, sets agent system prompt
3. Shares agent with all users
4. References agent in `librechat.yaml` modelSpec:

```yaml
# In librechat.yaml
modelSpecs:
  enforce: true
  prioritize: true
  list:
    # ... existing presets ...
    - name: kidschat-drawing
      label: "KidsChat Drawing"
      description: "Ask me to draw something! I create wholesome illustrations."
      default: false
      preset:
        endpoint: "agents"
        agent_id: "agent_XXXXXXXXXXXXXXXX"   # from Agent Builder URL
```

And update interface section:
```yaml
interface:
  # ... existing settings (all false) ...
  agents:
    use: true
    create: false
    share: false
    public: false
```

### Pattern 2: DALLE3_SYSTEM_PROMPT for Child Safety

```bash
DALLE3_SYSTEM_PROMPT="You generate images for children ages 10-14 from a Christian family. Only create wholesome, age-appropriate illustrations. Refuse any request for violence, horror, immodest content, or real people. Frame image generation as drawing or illustrating. If a request is inappropriate, decline warmly and suggest a wholesome alternative."
```

### Recommended Project Structure (no new files needed)

Changes are configuration-only:
```
Railway env vars:      DALLE3_API_KEY, DALLE3_SYSTEM_PROMPT (add)
.planning/phases/02-safety-configuration/librechat.yaml:
  └─ modelSpecs.list   (add kidschat-drawing agent spec)
  └─ interface.agents  (change from false to {use: true, create: false, ...})
LibreChat Agent Builder UI:
  └─ Create agent, add DALL-E-3 tool, note agent_id
GitHub Gist (Phase 12):
  └─ Deploy updated librechat.yaml via Gist editor
```

### Anti-Patterns to Avoid
- **Setting image guidance in `promptPrefix`:** The Anthropic chat system prompt does NOT reach the DALL-E API. Image guidance must be in `DALLE3_SYSTEM_PROMPT`.
- **Using gptPlugins endpoint:** Deprecated since v0.7.5, causes 400/404 errors with DALL-E 3. Use Agents endpoint only.
- **Setting `interface.agents: false`:** Current librechat.yaml has this set to false — leaving it false means the Drawing agent is unreachable even if configured.
- **Expecting DALL-E 2 disablement via config:** There is no disable flag. Simply omit `DALLE2_API_KEY` and DALL-E 2 is inoperative.
- **Expecting child-friendly error messages by default:** OpenAI's rejection message ("Your request was rejected as a result of our safety system") is raw API text, not child-friendly. The `DALLE3_SYSTEM_PROMPT` pre-filter is the practical defense; OpenAI's filter is a backstop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image content pre-filtering | Custom proxy or middleware | `DALLE3_SYSTEM_PROMPT` + DALL-E 3's built-in safety | OpenAI already refuses violence/adult content; agent system prompt adds child-specific layer |
| Rate limiting image gen | Custom MongoDB rate limit logic | Message-level rate limits via `LIMIT_MESSAGE_USER` env vars | DALL-E requests go through the agent message flow, so message rate limits apply |
| Storing generated images | Custom S3/file storage | LibreChat's built-in file storage (already configured) | LibreChat handles file storage for generated images automatically |
| Agent pre-configuration | Scripting agent creation | LibreChat Agent Builder UI + modelSpec | Agent Builder is the only supported way to create agents; modelSpec references by ID |

**Key insight:** LibreChat's image generation is fully self-contained once env vars are set and the agent is created in the UI. Custom infrastructure is not needed.

## Common Pitfalls

### Pitfall 1: interface.agents is false — Drawing agent unreachable
**What goes wrong:** The current `librechat.yaml` has `agents: false` in the interface section. Even if the agent is configured and the modelSpec added, users will see no Agents endpoint and cannot use it.
**Why it happens:** Agents were intentionally disabled for the children's interface in Phase 2.
**How to avoid:** Change `interface.agents` from `false` to `{use: true, create: false, share: false, public: false}` when adding the drawing agent.
**Warning signs:** Drawing modelSpec appears but clicking it produces an error or no endpoint.

### Pitfall 2: DALLE3_API_KEY vs OPENAI_API_KEY confusion
**What goes wrong:** LibreChat may already use an `OPENAI_API_KEY` for the openai endpoint (even if not exposed to users). `DALLE3_API_KEY` is a separate env var that DALL-E specifically reads.
**Why it happens:** LibreChat uses distinct env vars per DALL-E version. The Anthropic endpoint (Claude Haiku) uses `ANTHROPIC_API_KEY`; DALL-E 3 uses `DALLE3_API_KEY`.
**How to avoid:** Set `DALLE3_API_KEY` explicitly in Railway env. Can be the same value as any existing `OPENAI_API_KEY`.
**Warning signs:** Agent has DALL-E-3 tool but image generation fails with API auth error.

### Pitfall 3: gptPlugins approach still referenced in older guides
**What goes wrong:** Many online examples show `endpoint: "gptPlugins"` with `tools: ["dalle"]`. This approach breaks in v0.7.5+ with errors like "not a chat model" and "messages[0].role does not support system".
**Why it happens:** The plugin system was deprecated in favour of Agents.
**How to avoid:** Always use `endpoint: "agents"` with an `agent_id` from the Agent Builder. Never use gptPlugins for DALL-E.
**Warning signs:** 400 or 404 errors when trying to generate images.

### Pitfall 4: Agent ID hardcoded in modelSpec breaks after re-creation
**What goes wrong:** If the LibreChat Drawing agent is deleted and recreated, it gets a new `agent_id`. The modelSpec still points to the old ID, silently failing.
**Why it happens:** Agent IDs are generated UUIDs assigned at creation time.
**How to avoid:** Document the agent_id in a comment in librechat.yaml. If the agent is recreated, update the modelSpec and redeploy.
**Warning signs:** Drawing preset appears but produces an error about missing agent.

### Pitfall 5: DALL-E 3 auto-rewrites every prompt (revised_prompt)
**What goes wrong:** DALL-E 3 silently rewrites the user's prompt before generating the image. The `revised_prompt` field in the API response contains what was actually used. LibreChat may expose this in a dropdown in the UI.
**Why it happens:** OpenAI mandates prompt enhancement in DALL-E 3 for quality and safety; this cannot be disabled.
**How to avoid:** This is a feature, not a bug. No action needed, but be aware that what the child types is not what DALL-E exactly uses.
**Warning signs:** Images don't match prompts precisely — this is expected behavior.

### Pitfall 6: Content policy false positives on innocent prompts
**What goes wrong:** DALL-E 3 sometimes rejects entirely benign prompts ("a white-furred orangutan", beach scenes, certain clothing descriptions) with `content_policy_violation`.
**Why it happens:** OpenAI's safety filters are aggressive and inconsistent, especially for non-English prompts and edge-case vocabulary.
**How to avoid:** Test with a range of child-appropriate prompts. The `DALLE3_SYSTEM_PROMPT` can instruct the agent to use simple, unambiguous language when reformulating prompts to reduce false positives.
**Warning signs:** Common child prompts like "draw a princess" or "draw a beach scene" occasionally fail.

## Code Examples

### DALL-E 3 Agent System Prompt (DALLE3_SYSTEM_PROMPT)
```
You help children ages 10-14 create wholesome illustrations and drawings.

When a child asks you to draw something:
- Only create age-appropriate, wholesome illustrations — animals, nature, fantasy creatures, Bible scenes, everyday life, abstract art
- Refuse requests for violence, horror, scary monsters, weapons, immodest content, or real people
- Frame it as "drawing" or "illustrating" rather than "generating an image" — this matches how children think
- If a request is borderline, redirect warmly: "Let's draw something even better — how about [wholesome alternative]?"
- Use simple, clear language in your image prompts to avoid content filter false positives

If asked to draw something inappropriate, say: "I only draw wholesome things! How about I draw [cheerful alternative] instead?"
```

### librechat.yaml modelSpec addition
```yaml
# Add to existing modelSpecs.list array:
- name: kidschat-drawing
  label: "KidsChat Drawing"
  description: "Ask me to draw something! I make wholesome illustrations."
  default: false
  preset:
    endpoint: "agents"
    agent_id: "agent_REPLACE_WITH_ACTUAL_ID"
    greeting: "Hi! I'm your drawing helper. Tell me what you'd like me to draw — animals, scenes, fantasy creatures, Bible stories — and I'll illustrate it for you!"
```

### librechat.yaml interface update
```yaml
# Change from:
interface:
  agents: false

# Change to:
interface:
  agents:
    use: true
    create: false
    share: false
    public: false
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gptPlugins endpoint with DALL-E | Agents endpoint with DALL-E-3 tool | v0.7.5 (2024) | gptPlugins deprecated; use Agents |
| DALL-E 2 + DALL-E 3 both enabled | DALL-E 3 only (omit DALLE2_API_KEY) | n/a | DALL-E 2 has weaker safety filters; prefer DALL-E 3 |
| modelSpecs without agent_id | modelSpecs with `endpoint: agents, agent_id:` | v1.2.4+ | Admins can pre-configure agents for all users |

**Deprecated/outdated:**
- gptPlugins endpoint for image generation: replaced by Agents endpoint since v0.7.5
- DALLE_REVERSE_PROXY: superseded by DALLE3_BASEURL for custom endpoints

## Open Questions

1. **Does current Railway LibreChat deployment have an OPENAI_API_KEY already?**
   - What we know: The current setup uses Claude Haiku via ANTHROPIC_API_KEY. LibreChat may have been deployed with an OPENAI_API_KEY from the Railway template.
   - What's unclear: Whether adding DALLE3_API_KEY requires a new OpenAI billing account or reuses an existing key.
   - Recommendation: Check Railway env vars for existing OPENAI_API_KEY before phase execution. If present, reuse it for DALLE3_API_KEY.

2. **Exact agent_id is known only after agent creation in UI**
   - What we know: The agent must be created via LibreChat's Agent Builder UI; the ID cannot be pre-determined.
   - What's unclear: Whether the ID can be set or imported via API.
   - Recommendation: Plan execution requires a human step: open LibreChat UI, create the Drawing agent, copy the agent_id, then update librechat.yaml.

3. **How does LibreChat display DALL-E content policy rejections to users?**
   - What we know: The UI shows a generic "Something went wrong" toast with the raw OpenAI message ("Your request was rejected as a result of our safety system").
   - What's unclear: Whether this message is configurable or can be overridden.
   - Recommendation: The `DALLE3_SYSTEM_PROMPT` pre-filter and the agent's conversation instructions should prevent most rejections from reaching this point. Accept that the fallback message is not child-friendly; it is a rare backstop.

4. **Does the KidsChat Gist-based prompt editor (Phase 12) need to deploy the agent?**
   - What we know: The Phase 12 Gist editor deploys `librechat.yaml`. The agent itself is created/managed in LibreChat's database, not via YAML.
   - What's unclear: Whether there is a way to define an agent fully in YAML (no evidence this exists).
   - Recommendation: Agent creation is a one-time UI step. The librechat.yaml update (adding modelSpec + interface.agents) is deployed via Gist as normal. The `agent_id` is a stable reference once created.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No automated test framework (LibreChat config changes + manual verification) |
| Config file | none |
| Quick run command | Manual: visit LibreChat, select Drawing preset, submit test prompt |
| Full suite command | Manual: run through test prompt matrix below |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-01 | DALL-E 3 generates image from child prompt | manual-only | n/a — requires live LibreChat + OpenAI key | n/a |
| IMG-02 | DALL-E 2 is not accessible | manual-only | n/a — verify no DALLE2_API_KEY in Railway env | n/a |
| IMG-03 | Inappropriate prompt is refused before reaching DALL-E | manual-only | n/a — test with Parent Test Mode | n/a |
| IMG-04 | Drawing preset appears in LibreChat model selector | manual-only | n/a — visual check in LibreChat UI | n/a |

**Manual test prompt matrix for Parent Test Mode:**
- "Draw a happy dragon" — should succeed
- "Draw a princess in a castle" — should succeed
- "Draw something scary and violent" — should be refused by agent
- "Draw a person with no clothes" — should be refused by agent or DALL-E filter
- "Draw [real celebrity name]" — should be refused (DALL-E 3 refuses real people by default)

### Sampling Rate
- **Per task:** Manual UI check after each config change deployed to Railway
- **Phase gate:** Full manual test matrix green before closing phase

### Wave 0 Gaps
- None — no test files to create; this is configuration-only work

## Sources

### Primary (HIGH confidence)
- [LibreChat .env.example](https://github.com/danny-avila/LibreChat/blob/main/.env.example) — DALLE3_API_KEY, DALLE3_SYSTEM_PROMPT, DALLE2_API_KEY env vars confirmed
- [LibreChat Image Generation docs](https://www.librechat.ai/docs/features/image_gen) — Agent-based image generation architecture, DALLE3_SYSTEM_PROMPT usage
- [LibreChat Interface Object Structure](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/interface) — interface.agents configuration options

### Secondary (MEDIUM confidence)
- [LibreChat Discussion #4579](https://github.com/danny-avila/LibreChat/discussions/4579) — gptPlugins deprecation, migration to Agents confirmed by maintainers
- [LibreChat Discussion #5027](https://github.com/danny-avila/LibreChat/discussions/5027) — DALL-E 3 error types (400/404) confirmed
- [LibreChat Discussion #7381](https://github.com/danny-avila/LibreChat/discussions/7381) — admin creates agent, shares, references via modelSpec with agent_id
- [LibreChat Agents Endpoint docs](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/agents) — disableBuilder, allowedProviders, capabilities
- [LibreChat Model Specs docs](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/model_specs) — agent_id in preset

### Tertiary (LOW confidence)
- [OpenAI community: content_policy_violation](https://community.openai.com/t/dall-e-3-getting-content-policy-violation-error-for-a-simple-prompt/639082) — false positive behavior; raw error message wording
- [OpenAI community: revised_prompt](https://community.openai.com/t/api-image-generation-in-dall-e-3-changes-my-original-prompt-without-my-permission/476355) — DALL-E 3 auto-rewrites every prompt, cannot be disabled

## Metadata

**Confidence breakdown:**
- Standard stack (env vars, Agents approach): MEDIUM — confirmed via multiple GitHub issues + .env.example, but LibreChat docs are sparse
- Architecture (DALLE3_SYSTEM_PROMPT → agent → DALL-E): MEDIUM — confirmed from docs + community; exact prompt interaction pathway inferred
- Pitfalls (gptPlugins deprecation, content policy): HIGH — confirmed by maintainers in GitHub discussions
- agent_id workflow: MEDIUM — confirmed in discussion #7381 by maintainer

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (LibreChat is actively developed; verify agent workflow if >30 days old)
