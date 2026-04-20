#!/usr/bin/env tsx
/**
 * chat-test.ts — Headless LibreChat chat test CLI
 * Usage: npx tsx scripts/chat-test.ts "<preset name>" "<message>"
 *
 * ── Confirmed API contracts (probed 2026-04-20, v0.8.x) ──────────────────
 * (a) AUTH   POST /api/auth/login  {email,password} -> {token,user}
 *            HTTP 404 wrong email/pw; /api/ask/agents 404 (doesn't exist)
 * (b) CHAT   POST /api/agents/chat  Bearer token, Content-Type json, Accept SSE
 *            body: {text, conversationId:null, parentMessageId:"00…0", endpoint:"agents", agent_id}
 * (c) AGENTS GET /api/agents -> {data:[{id,name,…}]}  (resolve preset->agent_id)
 *            GET /api/presets also available but agent listing preferred
 * (d) SSE    event:message  data:{text?,delta?,message?:{text}}
 *            event:tool_call data:{tool,args,result?}
 *            event:final    data:{responseMessage:{text}}  |  data:[DONE]
 * ─────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Types ──────────────────────────────────────────────────────────────────
interface AuthResponse  { token?: string; message?: string }
interface AgentRecord   { id?: string; _id?: string; name: string }
interface AgentList     { data?: AgentRecord[] }
interface ToolCallEvent { tool: string; args: Record<string, unknown>; result?: unknown }
interface MessageEvent  { text?: string; delta?: string; message?: { text?: string } }
interface FinalEvent    { responseMessage?: { text?: string; content?: Array<{ text?: string }> }; text?: string }

// ── Env loading (no dotenv dep) ────────────────────────────────────────────
function loadEnv(): void {
  if (process.env["LIBRECHAT_BASE_URL"]) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
  try {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      if (k && !(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
    }
  } catch { /* no .env.local — use process.env */ }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`[ERROR] Missing env var: ${name}`); process.exit(1); }
  return v;
}

function maskEmail(e: string): string {
  const i = e.indexOf("@");
  return i < 2 ? "***" : e[0] + "***" + e.slice(i - 1);
}

// ── HTTP with AbortController timeout ─────────────────────────────────────
// LibreChat uaParser middleware rejects non-browser UAs with "Illegal request"
// (api/server/middleware/uaParser.js). Spoof a recent Chrome UA to pass.
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function request(url: string, init: RequestInit, stage: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  const headers = { "User-Agent": BROWSER_UA, ...(init.headers ?? {}) } as Record<string, string>;
  try {
    return await fetch(url, { ...init, headers, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.error(`[TIMEOUT] ${stage}`); process.exit(1);
    }
    throw e;
  } finally { clearTimeout(t); }
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function authenticate(base: string, email: string, pw: string): Promise<string> {
  const res = await request(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  }, "auth");
  const body = await res.json() as AuthResponse;
  if (!res.ok || !body.token) {
    console.error(`[ERROR] auth status=${res.status} message=${body.message ?? JSON.stringify(body)}`);
    process.exit(1);
  }
  return body.token;
}

// ── Agent resolution ───────────────────────────────────────────────────────
// LibreChat v0.8.x: /api/agents returns SSE "Illegal request" for listing. The
// authoritative source for preset -> agent_id is /api/config.modelSpecs.list.
interface ModelSpec { name: string; label?: string; preset?: { agent_id?: string } }
interface ConfigResponse { modelSpecs?: { list?: ModelSpec[] } }

async function resolveAgent(base: string, token: string, name: string): Promise<{ agentId: string; specName: string }> {
  const res = await request(`${base}/api/config`, {
    headers: { Authorization: `Bearer ${token}` },
  }, "config");
  if (!res.ok) { console.error(`[ERROR] config status=${res.status}`); process.exit(1); }
  const cfg = await res.json() as ConfigResponse;
  const list = cfg.modelSpecs?.list ?? [];
  const needle = name.toLowerCase();
  const hit = list.find(s =>
    s.name.toLowerCase() === needle ||
    (s.label ?? "").toLowerCase() === needle,
  );
  if (!hit?.preset?.agent_id) {
    const names = list.map(s => `"${s.label ?? s.name}"`).join(", ");
    console.error(`[ERROR] Preset "${name}" not found. Available: ${names}`); process.exit(1);
  }
  return { agentId: hit.preset.agent_id, specName: hit.name };
}

// ── SSE chat ───────────────────────────────────────────────────────────────
// LibreChat v0.8.x splits chat into two calls:
//   1. POST /api/agents/chat  → returns { streamId }
//   2. GET  /api/agents/chat/stream/:streamId  → SSE stream of events
async function chat(base: string, token: string, agentId: string, specName: string, message: string): Promise<void> {
  const submitRes = await request(`${base}/api/agents/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message,
      conversationId: "new",
      parentMessageId: "00000000-0000-0000-0000-000000000000",
      messageId: crypto.randomUUID(),
      endpoint: "agents",
      agent_id: agentId,
      spec: specName,
      model: "claude-haiku-4-5",
    }),
  }, "chat:submit");
  if (!submitRes.ok) {
    console.error(`[ERROR] chat submit status=${submitRes.status} body=${(await submitRes.text()).slice(0, 300)}`); process.exit(1);
  }
  const submit = await submitRes.json() as { streamId?: string; conversationId?: string };
  const streamId = submit.streamId;
  if (!streamId) { console.error(`[ERROR] no streamId in submit response: ${JSON.stringify(submit)}`); process.exit(1); }
  console.log(`[OK] submit streamId=${streamId}`);

  const res = await request(`${base}/api/agents/chat/stream/${streamId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
  }, "chat:stream");
  if (!res.ok) {
    console.error(`[ERROR] chat stream status=${res.status} body=${(await res.text()).slice(0, 300)}`); process.exit(1);
  }
  if (!res.body) { console.error("[ERROR] no stream body"); process.exit(1); }

  const toolLines: string[] = [];
  let assistant = "";
  const dec = new TextDecoder();
  let buf = "";

  // LibreChat v0.8.x (LangGraph) event shapes (all wrapped in `event: message`):
  //   { created:true, message:{...user text...} }                               — user echo
  //   { event:"on_run_step", data:{type:"tool_calls", stepDetails:{tool_calls:[{name,args,id}]}} }
  //   { event:"on_reasoning_delta", data:{delta:{content:[{type:"think", think:"..."}]}} }
  //   { event:"on_message_delta",   data:{delta:{content:[{type:"text",  text:"..."}]}} }
  //   { event:"on_run_step_completed", data:{...} }
  //   { final:true, responseMessage:{ content:[{type:"think"|"tool_call"|"text", ...}] } }  — authoritative final
  const contentAsText = (content: unknown): string => {
    if (!Array.isArray(content)) return "";
    const parts: string[] = [];
    for (const c of content as Array<Record<string, unknown>>) {
      if (c.type === "text" && typeof c.text === "string") parts.push(c.text);
      else if (c.type === "tool_call" && c.tool_call && typeof c.tool_call === "object") {
        const tc = c.tool_call as Record<string, unknown>;
        const args = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args ?? {});
        const out = typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output ?? null);
        toolLines.push(`[TOOL] ${String(tc.name)} args=${args} result=${out.slice(0, 400)}`);
      }
    }
    return parts.join("");
  };

  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.trim()) continue;
      let data = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      if (!data || data === "[DONE]") continue;
      let p: Record<string, unknown>;
      try { p = JSON.parse(data) as Record<string, unknown>; } catch { continue; }

      // Final (authoritative) — overrides any streaming accumulation
      if (p.final === true && p.responseMessage && typeof p.responseMessage === "object") {
        const rm = p.responseMessage as Record<string, unknown>;
        toolLines.length = 0; // refresh from final payload
        const finalText = contentAsText(rm.content);
        assistant = finalText || (typeof rm.text === "string" ? rm.text : assistant);
        continue;
      }
      // Streaming events
      const inner = p.event as string | undefined;
      const innerData = p.data as Record<string, unknown> | undefined;
      if (inner && innerData) {
        if (inner === "on_run_step" && innerData.stepDetails) {
          const sd = innerData.stepDetails as Record<string, unknown>;
          if (sd.type === "tool_calls" && Array.isArray(sd.tool_calls)) {
            for (const tc of sd.tool_calls as Array<Record<string, unknown>>) {
              toolLines.push(`[TOOL:start] ${String(tc.name)} id=${String(tc.id)}`);
            }
          }
        }
      }
    }
  }

  console.log("\n===== TOOL CALLS =====");
  toolLines.length ? toolLines.forEach(l => console.log(l)) : console.log("(none)");
  console.log("\n===== ASSISTANT =====");
  console.log(assistant.trim() || "(empty)");
  console.log("\n===== END =====");
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  loadEnv();
  const [,, preset, message] = process.argv;
  if (!preset || !message) {
    console.error('Usage: npx tsx scripts/chat-test.ts "<preset name>" "<message>"');
    console.error('Example: npx tsx scripts/chat-test.ts "Image Search" "origami cats"');
    process.exit(1);
  }
  const base  = requireEnv("LIBRECHAT_BASE_URL").replace(/\/$/, "");
  const email = requireEnv("LIBRECHAT_TEST_EMAIL");
  const pw    = requireEnv("LIBRECHAT_TEST_PASSWORD");

  console.log(`Config: base=${base} email=${maskEmail(email)}`);
  console.log(`Preset: "${preset}"  Message: "${message}"\n`);

  const token = await authenticate(base, email, pw);
  console.log("[OK] authenticated");
  const { agentId, specName } = await resolveAgent(base, token, preset);
  console.log(`[OK] resolved agent_id=${agentId} spec=${specName}`);
  await chat(base, token, agentId, specName, message);
}

main().catch((e: unknown) => {
  console.error(`[ERROR] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
