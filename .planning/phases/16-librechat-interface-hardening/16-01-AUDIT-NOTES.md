# Phase 16-01 Audit Notes — LibreChat Interface Hardening

Generated: 2026-04-12T11:38:34Z

## Live Gist Status

- **Gist URL:** https://gist.github.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf
- **Gist ID:** e23b999f1d3cd77726a97c20e26f0abf
- **Pre-change commit hash:** 8a4a743e37e0c6b21c441aa1a93b57da885eb9ef
- **PRE snapshot line count:** 93 lines
- **Snapshot verified:** Contains `modelSpecs:` and `interface:` blocks

## Schema Research

Source files fetched:
- `packages/data-provider/src/config.ts` — 2073 lines (authoritative Zod schema)
- `librechat.example.yaml` — 609 lines (config reference)

LibreChat version in use: v0.8.4 (per Phase 2 notes)

---

## HARDEN-MCP-01 — Disable MCP Server Add UI

**Finding:** Schema key FOUND at `interface.mcpServers` (object form).

Schema definition (config.ts ~line 664):
```typescript
const mcpServersSchema = z.object({
  placeholder: z.string().optional(),
  use: z.boolean().optional(),       // Allow using configured MCP servers
  create: z.boolean().optional(),    // Allow users to create/add new MCP servers
  share: z.boolean().optional(),
  public: z.boolean().optional(),
  trustCheckbox: z.object({...}).optional(),
}).optional();
```

Default values (from schema defaults at ~line 778):
```
mcpServers: { use: true, create: true, share: false, public: false }
```

**Decision:** Set `interface.mcpServers: {use: false, create: false, share: false, public: false}` — disables both using and creating/adding MCP servers. This closes the capability-escalation path completely.

**Rationale:** `create: false` removes the "Add MCP Server" dialog. `use: false` prevents using any globally configured servers too. Belt-and-suspenders approach since even pre-configured servers could grant arbitrary tool access.

**Config key:** `interface.mcpServers`
**Schema line:** config.ts:664
**Default:** `{use: true, create: true, share: false, public: false}`
**Accepted limitation:** No — fully closable via config.

---

## HARDEN-MARKETPLACE-01 — Disable Agent Marketplace

**Finding:** Schema key FOUND at `interface.marketplace.use`.

Schema definition (config.ts ~line 732):
```typescript
marketplace: z.object({
  use: z.boolean().optional(),
}).optional()
```

Default value (from schema defaults at ~line 775):
```
marketplace: { use: false }
```

**Decision:** Set `interface.marketplace: {use: false}` explicitly in the config (the schema default is already false, but our current live config does not set it explicitly — adding it makes the intent unambiguous and protects against any future default change).

**Config key:** `interface.marketplace.use`
**Schema line:** config.ts:732
**Default:** `false`
**Accepted limitation:** No — fully closable via config.

---

## HARDEN-DELETE-01 — Block Conversation Delete

**Finding:** NOT FOUND in schema. Exhaustive search of config.ts (2073 lines) and librechat.example.yaml (609 lines) found no:
- `interface.deleteConversations`
- `permissions.USER.conversations.delete`
- `features.conversationDelete`
- Any other conversation-delete toggle

The `interfaceSchema` Zod object does not contain a delete-conversations field. The permissions system in LibreChat v0.8.x is role-based at the server level (admin/user roles) but does not expose a per-feature toggle for conversation deletion.

**Fallback decision:** Accept as limitation. Document in DIFF.md. Do NOT fork LibreChat. Do NOT inject CSS (brittle, bypassable via devtools). Do NOT invent a schema key (will cause ZodError on startup as happened in Phase 2 Plan 03).

**Mitigation:** The admin dashboard provides full conversation visibility regardless of whether kids delete locally (LibreChat's server-side delete may or may not cascade to the custom MongoDB view). Parent oversight is maintained via the admin dashboard's conversation logs.

**Config key:** NONE — not available in LibreChat v0.8.4 config schema
**Accepted limitation:** YES — config toggle does not exist in this version

---

## POLISH-ICONS-01 — Distinct Preset Icons

**Finding:** `modelSpecs.list[*].iconURL` is a valid schema key (confirmed via LibreChat docs and Phase 2 research notes). The field accepts a URL string pointing to a publicly accessible SVG or PNG.

**Icon URL validation (all return HTTP/2 200 after redirect):**
- `https://unpkg.com/lucide-static@latest/icons/graduation-cap.svg` → 200 OK
- `https://unpkg.com/lucide-static@latest/icons/smile.svg` → 200 OK
- `https://unpkg.com/lucide-static@latest/icons/scale-3d.svg` → 200 OK
- `https://unpkg.com/lucide-static@latest/icons/briefcase.svg` → 200 OK

**Preset → icon mapping:**
| Preset | Icon Name | Rationale |
|--------|-----------|-----------|
| Friendly Tutor | `graduation-cap` | Learning / school context |
| Casual Buddy | `smile` | Friendly / relaxed tone |
| Balanced Helper | `scale-3d` | Balance / equilibrium |
| Standard Formal | `briefcase` | Professional / formal context |

**Config key:** `modelSpecs.list[*].iconURL`
**Accepted limitation:** No — fully supported via config.
