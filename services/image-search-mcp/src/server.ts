/**
 * kidschat-image-search-mcp server
 *
 * Exposes one MCP tool — `image_search` — wrapping the Openverse public API.
 * LibreChat v0.8.4 attaches this via mcpServers.image-search (streamable-http)
 * in the dev Gist librechat.yaml.
 *
 * Design invariants:
 *   - Openverse is the sole provider (see Plan 20-01 Amendment B).
 *   - The tool boundary strips source-site URLs — option-iii click-through
 *     policy lives in providers/openverse.ts, not the prompt layer.
 *
 * Phase 21 additions:
 *   - Pre-call query blocklist (D-8 L2 / SAFETY-01)
 *   - Post-call domain blocklist (SAFETY-01)
 *   - Per-user quota enforcement via kidschat-admin (SEARCH-07)
 *   - /proxy?u=<base64url> route for hotlink-blocked upstream thumbnails (SEARCH-06)
 *   - userId probe + AsyncLocalStorage-based resolution inside /mcp handler
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { searchPixabayImages } from "./providers/pixabay.js";
import { isQueryBlocked, filterBlockedDomains } from "./blocklist.js";
import { checkAndIncrementQuota } from "./quota-client.js";
import { handleProxy } from "./proxy.js";

const HOST = process.env.MCP_HOST || "0.0.0.0";
const PORT = Number(process.env.MCP_PORT || 8080);

// Request-scoped userId storage. Populated inside /mcp route (from headers
// and/or parsed _meta on the JSON-RPC body) and read inside the tool handler.
// If neither source carries a userId, the handler falls back to the optional
// `user_id` tool arg (documented fallback — see comment in handler).
const userIdStore = new AsyncLocalStorage<{ userId: string | null }>();

function resolveUserIdForThisRequest(): string | null {
  return userIdStore.getStore()?.userId ?? null;
}

function extractUserIdFromHeaders(headers: IncomingMessage["headers"]): string | null {
  const candidates = [
    "x-librechat-user-id",
    "x-user-id",
    "x-librechat-user",
  ];
  for (const h of candidates) {
    const v = headers[h];
    if (typeof v === "string" && v.length > 0) return v;
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0]!;
  }
  return null;
}

function extractUserIdFromBody(body: unknown): string | null {
  // LibreChat may thread userId through MCP tool-call _meta on the params.
  // Shape: { jsonrpc:"2.0", method:"tools/call", params:{ name, arguments, _meta:{ ... userId? ... } } }
  if (!body || typeof body !== "object") return null;
  const b = body as any;
  const meta = b?.params?._meta;
  if (meta && typeof meta === "object") {
    for (const k of ["userId", "user_id", "librechat_user_id", "user"]) {
      const v = (meta as any)[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
  }
  return null;
}

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "kidschat-image-search-mcp",
    version: "0.2.0",
  });

  server.registerTool(
    "image_search",
    {
      title: "Image Search",
      description:
        "Search Openverse for safe, kid-appropriate images. Returns thumbnail URLs only — no source-site links.",
      inputSchema: {
        query: z.string().describe("Search query text"),
        count: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(20)
          .describe("Number of results (1-20, default 20). Capped at 20 by Openverse anonymous tier."),
        page: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(1)
          .describe("Result page, 1-indexed (default 1). Increment to fetch more results for the same query."),
        // Fallback userId arg. Only used if neither HTTP header nor _meta carries
        // the authenticated user. Dev Gist agent prompt may inject via system
        // prompt if needed. Preferred paths: x-librechat-user-id header OR _meta.userId.
        user_id: z
          .string()
          .optional()
          .describe("(Fallback) LibreChat user id — used only if the MCP transport does not carry it via headers or _meta."),
      },
    },
    async ({ query, count, page, user_id }) => {
      const started = Date.now();

      // Step 1 — blocklist (D-8 L2 + SAFETY-01)
      const blocked = isQueryBlocked(query);
      if (blocked.blocked) {
        console.log(
          JSON.stringify({
            event: "tool.block",
            reason: blocked.reason,
            query_len: query.length,
          }),
        );
        const payload = {
          images: [],
          provider_used: "pixabay" as const,
          error: "blocked_query" as const,
          block_reason: blocked.reason,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
      }

      // Step 2 — resolve userId (header > meta > tool-arg fallback) and check quota
      const userId = resolveUserIdForThisRequest() ?? user_id ?? null;
      if (userId) {
        const q = await checkAndIncrementQuota(userId);
        if (!q.allowed) {
          console.log(
            JSON.stringify({
              event: "tool.quota_exceeded",
              userId,
              remaining: q.remaining,
            }),
          );
          const payload = {
            images: [],
            provider_used: "pixabay" as const,
            error: "quota_exceeded" as const,
          };
          return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
        }
        if (q.error) {
          console.log(
            JSON.stringify({ event: "tool.quota_error", userId, error: q.error }),
          );
        }
      } else {
        console.log(JSON.stringify({ event: "tool.no_userid" }));
      }

      // Step 3 — upstream call (provider handles internal modifier-trim retry)
      const result = await searchPixabayImages(query, count ?? 10);

      // Step 4 — domain filter (SAFETY-01 post-filter)
      result.images = filterBlockedDomains(result.images);

      const duration_ms = Date.now() - started;
      console.log(
        JSON.stringify({
          event: "tool.call",
          tool: "image_search",
          query_len: query.length,
          result_count: result.images.length,
          error: result.error ?? null,
          duration_ms,
          has_user_id: !!userId,
        }),
      );

      // Step 5 — response payload (thumbnails already proxy-rewritten by provider)
      const payload: Record<string, unknown> = {
        images: result.images,
        provider_used: "pixabay" as const,
        ...(result.error ? { error: result.error } : {}),
      };
      if (result.images.length === 0) {
        payload.user_message =
          `No images found for "${query}" — try a simpler or different search!`;
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    },
  );

  return server;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function main(): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, X-LibreChat-User-Id",
      });
      res.end();
      return;
    }

    const url = req.url || "/";

    if (req.method === "GET" && (url === "/health" || url === "/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, provider: "openverse", version: "0.2.0" }));
      return;
    }

    // Hotlink proxy (SEARCH-06)
    if (req.method === "GET" && url.startsWith("/proxy")) {
      await handleProxy(req, res);
      return;
    }

    if (url.startsWith("/mcp")) {
      // Probe log — structured, no body content (privacy). Leave on for the
      // phase; Task 21-01-02/03 inspect logs to confirm userId-forwarding shape.
      console.log(
        JSON.stringify({
          event: "mcp.probe",
          method: req.method,
          url,
          headers: Object.fromEntries(
            Object.entries(req.headers).filter(
              ([k]) => k.startsWith("x-") || k === "authorization" || k === "mcp-session-id",
            ),
          ),
        }),
      );

      const server = buildMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      try {
        await server.connect(transport);
        const body = await readBody(req);

        // Extract userId before dispatching the tool; store in ALS so the tool
        // handler (which runs inside transport.handleRequest) can read it.
        const headerUserId = extractUserIdFromHeaders(req.headers);
        const bodyUserId = extractUserIdFromBody(body);
        const userId = headerUserId ?? bodyUserId ?? null;
        if (userId) {
          console.log(
            JSON.stringify({
              event: "mcp.userid_resolved",
              source: headerUserId ? "header" : "meta",
            }),
          );
        }

        await userIdStore.run({ userId }, async () => {
          await transport.handleRequest(req, res, body);
        });
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "mcp.error",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal error" },
              id: null,
            }),
          );
        }
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(
      JSON.stringify({
        event: "server.listening",
        host: HOST,
        port: PORT,
        provider: "openverse",
        version: "0.2.0",
      }),
    );
  });
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      event: "server.fatal",
      message: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
