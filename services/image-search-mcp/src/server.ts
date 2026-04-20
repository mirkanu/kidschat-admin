/**
 * kidschat-image-search-mcp server
 *
 * Exposes one MCP tool — `image_search` — wrapping the Openverse public API.
 * LibreChat v0.8.4 attaches this via mcpServers.image-search (streamable-http)
 * in the dev Gist librechat.yaml.
 *
 * Design invariants:
 *   - Openverse is the sole provider (see Plan 20-01 Amendment B).
 *   - No credentials. No env vars required beyond MCP_HOST / MCP_PORT.
 *   - The tool boundary strips source-site URLs — option-iii click-through
 *     policy lives in providers/openverse.ts, not the prompt layer.
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { searchOpenverseImages } from "./providers/openverse.js";

const HOST = process.env.MCP_HOST || "0.0.0.0";
const PORT = Number(process.env.MCP_PORT || 8080);

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "kidschat-image-search-mcp",
    version: "0.1.0",
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
      },
    },
    async ({ query, count, page }) => {
      const started = Date.now();
      const result = await searchOpenverseImages(query, count ?? 10, page ?? 1);
      const duration_ms = Date.now() - started;

      // Structured log — never log full query text (privacy); log length only.
      console.log(
        JSON.stringify({
          event: "tool.call",
          tool: "image_search",
          query_len: query.length,
          result_count: result.images.length,
          error: result.error ?? null,
          duration_ms,
        }),
      );

      const payload = {
        images: result.images,
        provider_used: "openverse" as const,
        ...(result.error ? { error: result.error } : {}),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload) }],
      };
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
    // CORS preflight — harmless for LibreChat since it's server-to-server, but
    // allow it so local curl tests from a browser console work.
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id",
      });
      res.end();
      return;
    }

    const url = req.url || "/";

    if (req.method === "GET" && (url === "/health" || url === "/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, provider: "openverse" }));
      return;
    }

    if (url.startsWith("/mcp")) {
      // Fresh stateless transport per request — simplest correct
      // implementation for a single-tool service.
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
        await transport.handleRequest(req, res, body);
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
