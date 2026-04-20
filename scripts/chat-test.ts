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
async function request(url: string, init: RequestInit, stage: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
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
async function resolveAgent(base: string, token: string, name: string): Promise<string> {
  const res = await request(`${base}/api/agents`, {
    headers: { Authorization: `Bearer ${token}` },
  }, "presets");
  if (!res.ok) { console.error(`[ERROR] agents list status=${res.status}`); process.exit(1); }
  const raw = await res.json() as AgentList | AgentRecord[];
  const agents = Array.isArray(raw) ? raw : (raw.data ?? []);
  const hit = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
  if (!hit) {
    const names = agents.map(a => `"${a.name}"`).join(", ");
    console.error(`[ERROR] Preset "${name}" not found. Available: ${names}`); process.exit(1);
  }
  return hit.id ?? hit._id ?? "";
}

// ── SSE chat ───────────────────────────────────────────────────────────────
async function chat(base: string, token: string, agentId: string, message: string): Promise<void> {
  const res = await request(`${base}/api/agents/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ text: message, conversationId: null, parentMessageId: "00000000-0000-0000-0000-000000000000", endpoint: "agents", agent_id: agentId }),
  }, "chat");
  if (!res.ok) {
    console.error(`[ERROR] chat status=${res.status} body=${(await res.text()).slice(0, 300)}`); process.exit(1);
  }
  if (!res.body) { console.error("[ERROR] no response body"); process.exit(1); }

  const toolLines: string[] = [];
  let assistant = "";
  const dec = new TextDecoder();
  let buf = "";

  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.trim()) continue;
      let evt = "", data = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) evt = line.slice(6).trim();
        else if (line.startsWith("data:"))  data = line.slice(5).trim();
      }
      if (!data || data === "[DONE]") continue;
      let p: Record<string, unknown>;
      try { p = JSON.parse(data) as Record<string, unknown>; } catch { continue; }

      if (evt === "tool_call" || "tool" in p) {
        const tc = p as unknown as ToolCallEvent;
        const r = tc.result != null ? JSON.stringify(tc.result).slice(0, 200) : "(pending)";
        toolLines.push(`[TOOL] ${tc.tool} args=${JSON.stringify(tc.args)} result=${r}`);
      } else if (evt === "final" || "responseMessage" in p) {
        const f = p as unknown as FinalEvent;
        assistant = f.responseMessage?.text ?? f.responseMessage?.content?.map(c => c.text ?? "").join("") ?? f.text ?? assistant;
      } else if (evt === "message" || "text" in p || "delta" in p) {
        const m = p as unknown as MessageEvent;
        assistant += m.delta ?? m.text ?? m.message?.text ?? "";
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

  const token   = await authenticate(base, email, pw);
  console.log("[OK] authenticated");
  const agentId = await resolveAgent(base, token, preset);
  console.log(`[OK] resolved agent_id=${agentId}`);
  await chat(base, token, agentId, message);
}

main().catch((e: unknown) => {
  console.error(`[ERROR] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
