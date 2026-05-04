/**
 * Hotlink proxy — SEARCH-06.
 *
 * Streams remote image bytes server-side for thumbnails whose upstream blocks
 * hotlinking (~5-10% rate observed in Phase 20 UAT Q1). Input URL is passed as
 * base64url on `?u=`; direct URLs with `?`/`&` would break the MCP's own
 * URL parse.
 *
 * Threat mitigations (see 21-01-PLAN threat_model):
 *   - T-21-03 (DoS)  : 10s timeout + 5MB body cap + content-type gate
 *   - T-21-04 (SSRF) : https-only + private-IP reject (URLs from Openverse API, not user input)
 *   - T-21-01 (Info) : only proxied thumbnail URL ever returned; raw upstream
 *                      URL never leaves the tool boundary
 */

import type { IncomingMessage, ServerResponse } from "node:http";

// 1x1 transparent PNG — returned when upstream fails / non-image content / etc.
const BLANK_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
    "0000000d49444154789c63000100000005000100" +
    "0d0a2db40000000049454e44ae426082",
  "hex",
);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 10_000;

function decodeBase64Url(s: string): string {
  try {
    return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function isPrivateHost(hostname: string): boolean {
  // IPv4 private / loopback / link-local / multicast; any non-IPv4 hostname
  // returns false here (DNS resolution checks are too expensive for v1).
  const h = hostname.toLowerCase();
  if (h === "localhost") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function sendBlank(res: ServerResponse, status: number = 200): void {
  if (res.headersSent) {
    try {
      res.end();
    } catch {
      /* noop */
    }
    return;
  }
  res.writeHead(status, {
    "Content-Type": "image/png",
    "Content-Length": String(BLANK_PNG.length),
    "Cache-Control": "public, max-age=60",
  });
  res.end(BLANK_PNG);
}

export async function handleProxy(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const fullUrl = new URL(req.url || "/", "http://x");
  const uParam = fullUrl.searchParams.get("u");
  if (!uParam) {
    sendBlank(res, 400);
    return;
  }
  const decoded = decodeBase64Url(uParam);
  if (!decoded) {
    sendBlank(res, 400);
    return;
  }

  let target: URL;
  try {
    target = new URL(decoded);
  } catch {
    sendBlank(res, 400);
    return;
  }

  if (target.protocol !== "https:") {
    console.log(
      JSON.stringify({ event: "proxy.reject", reason: "non_https", host: target.hostname }),
    );
    sendBlank(res, 400);
    return;
  }
  if (isPrivateHost(target.hostname)) {
    console.log(
      JSON.stringify({ event: "proxy.reject", reason: "private_host", host: target.hostname }),
    );
    sendBlank(res, 400);
    return;
  }
  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Don't send a restrictive Accept header — Openverse thumb endpoint
      // returns HTTP 406 on Accept: image/* (content-negotiation quirk).
      // We validate content-type below after the response.
      headers: { "User-Agent": "kidschat-image-search-mcp/0.2" },
    });
    if (!upstream.ok) {
      console.log(
        JSON.stringify({
          event: "proxy.upstream_error",
          host: target.hostname,
          status: upstream.status,
        }),
      );
      sendBlank(res, 200);
      return;
    }
    const ct = upstream.headers.get("content-type") || "";
    if (!ct.toLowerCase().startsWith("image/")) {
      console.log(
        JSON.stringify({
          event: "proxy.bad_content_type",
          host: target.hostname,
          ct,
        }),
      );
      sendBlank(res, 200);
      return;
    }
    // Stream with a hard byte cap. We read chunks rather than buffer the full
    // body at once; abort if MAX_BYTES is exceeded.
    const reader = upstream.body?.getReader();
    if (!reader) {
      sendBlank(res, 200);
      return;
    }
    res.writeHead(200, {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=3600",
    });
    let sent = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      sent += value.byteLength;
      if (sent > MAX_BYTES) {
        console.log(
          JSON.stringify({
            event: "proxy.size_cap",
            host: target.hostname,
            sent,
          }),
        );
        try {
          reader.cancel();
        } catch {
          /* noop */
        }
        break;
      }
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.log(
      JSON.stringify({
        event: "proxy.fetch_error",
        host: target.hostname,
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    sendBlank(res, 200);
  }
}
