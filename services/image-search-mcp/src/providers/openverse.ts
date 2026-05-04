/**
 * Openverse provider.
 *
 * Calls the Openverse API. Supports OAuth2 client-credential auth via
 * OPENVERSE_CLIENT_ID + OPENVERSE_CLIENT_SECRET env vars (bypasses Cloudflare
 * bot protection on non-Railway IPs). Falls back to unauthenticated when env
 * vars are absent.
 *
 * Strips `foreign_landing_url` and `url` from every result — option-iii
 * click-through policy. The agent cannot leak a source-site URL.
 */

export interface OpenverseImage {
  thumbnail: string;
  title: string;
  source_domain: string;
  provider: "openverse";
  license: string;
}

export interface OpenverseResult {
  images: OpenverseImage[];
  provider: "openverse";
  error?: "rate_limited" | "upstream_error";
}

const OPENVERSE_BASE = "https://api.openverse.org/v1/images/";
const OPENVERSE_TOKEN_URL = "https://api.openverse.org/v1/auth_tokens/token/";

// In-process token cache — reuse until 60s before expiry
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const clientId = process.env.OPENVERSE_CLIENT_ID;
  const clientSecret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { Accept: "application/json" };

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return { Accept: "application/json", Authorization: `Bearer ${cachedToken.value}` };
  }

  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(OPENVERSE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.log(JSON.stringify({ event: "openverse.token_error", status: res.status }));
      return { Accept: "application/json" };
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
    console.log(JSON.stringify({ event: "openverse.token_refreshed", expires_in: data.expires_in }));
    return { Accept: "application/json", Authorization: `Bearer ${cachedToken.value}` };
  } catch {
    return { Accept: "application/json" };
  }
}

// Modifier stopwords — stripped token-by-token on zero-result retry.
// Curated from 20-UAT.md Q1-Q10 zero-result analysis.
export const MODIFIER_STOPWORDS = new Set<string>([
  // Articles / preps
  "a", "an", "the", "of", "in", "on", "at", "for", "with",
  // Color adjectives
  "red", "orange", "yellow", "green", "blue", "purple", "pink",
  "white", "black", "brown", "gray", "grey", "golden", "silver", "rainbow",
  // Size / style adjectives
  "big", "small", "tiny", "huge", "giant", "little",
  "cute", "pretty", "beautiful", "realistic", "cartoon", "animated", "3d",
  // Rendering hints
  "photo", "photograph", "picture", "image", "drawing",
  "painting", "sketch", "illustration",
]);

export function stripModifiers(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0 && !MODIFIER_STOPWORDS.has(t.toLowerCase()))
    .join(" ");
}

async function fetchOpenverseOnce(
  query: string,
  pageSize: number,
  pageNum: number,
): Promise<OpenverseResult> {
  const url = `${OPENVERSE_BASE}?q=${encodeURIComponent(query)}&page_size=${pageSize}&page=${pageNum}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: await getAuthHeaders() });
  } catch {
    return { images: [], provider: "openverse", error: "upstream_error" };
  }

  if (res.status === 429) {
    return { images: [], provider: "openverse", error: "rate_limited" };
  }
  if (res.status >= 500) {
    return { images: [], provider: "openverse", error: "upstream_error" };
  }
  if (!res.ok) {
    return { images: [], provider: "openverse", error: "upstream_error" };
  }

  const data = (await res.json()) as {
    results?: Array<{
      thumbnail?: string;
      title?: string;
      source?: string;
      license?: string;
      // NOTE: foreign_landing_url and url are INTENTIONALLY not destructured
      // below — they must never leave the tool boundary (option iii).
    }>;
  };

  const raw = Array.isArray(data.results) ? data.results : [];
  const images: OpenverseImage[] = raw
    .filter((r) => typeof r.thumbnail === "string" && r.thumbnail.length > 0)
    .map((r) => {
      const rawThumb = r.thumbnail as string;
      return {
        thumbnail: rawThumb, // raw — proxy rewrite happens after validation
        title: typeof r.title === "string" ? r.title : "",
        source_domain: typeof r.source === "string" ? r.source : "",
        provider: "openverse" as const,
        license: typeof r.license === "string" ? r.license : "",
      };
    });

  return { images, provider: "openverse" };
}

/**
 * HEAD-check each raw thumbnail URL in parallel (3s timeout per request).
 * Drops any image whose thumbnail returns a non-2xx response (e.g. HTTP 424
 * from Openverse CDN for newer/niche titles).
 */
async function validateThumbnails(images: OpenverseImage[]): Promise<OpenverseImage[]> {
  if (images.length === 0) return images;

  const results = await Promise.allSettled(
    images.map(async (img) => {
      try {
        const res = await fetch(img.thumbnail, {
          method: "HEAD",
          signal: AbortSignal.timeout(3000),
        });
        return res.ok ? img : null;
      } catch {
        return null;
      }
    }),
  );

  const valid = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((img): img is OpenverseImage => img !== null);

  console.log(
    JSON.stringify({
      event: "openverse.thumbnails_validated",
      original: images.length,
      valid: valid.length,
      dropped: images.length - valid.length,
    }),
  );

  return valid;
}

/**
 * Rewrite raw thumbnail URLs through the /proxy endpoint.
 * No-op when PROXY_BASE is not set.
 */
function proxyRewrite(images: OpenverseImage[], proxyBase: string | undefined): OpenverseImage[] {
  if (!proxyBase) return images;
  const base = proxyBase.replace(/\/+$/, "");
  return images.map((img) => ({
    ...img,
    thumbnail: `${base}/proxy?u=${Buffer.from(img.thumbnail).toString("base64url")}`,
  }));
}

export async function searchOpenverseImages(
  query: string,
  count: number = 10,
  page: number = 1,
): Promise<OpenverseResult> {
  // Openverse anonymous tier: page_size ≤ 20. Values >20 return HTTP 401.
  const pageSize = Math.max(1, Math.min(count, 20));
  const pageNum = Math.max(1, Math.min(Math.floor(page), 20));

  const first = await fetchOpenverseOnce(query, pageSize, pageNum);
  if (first.error) return first;

  // Determine which raw result to validate (original or retry)
  let candidate = first;
  if (first.images.length === 0) {
    const trimmed = stripModifiers(query);
    const origTokens = query.trim().split(/\s+/).filter(Boolean);
    const trimTokens = trimmed.split(/\s+/).filter(Boolean);
    if (trimTokens.length === 0 || trimTokens.length === origTokens.length) {
      console.log(
        JSON.stringify({
          event: "openverse.retry_skipped",
          reason: "no_strippable_tokens",
          query,
        }),
      );
      // no retry; candidate stays as first (empty)
    } else {
      console.log(
        JSON.stringify({ event: "openverse.retry", original: query, trimmed }),
      );
      const second = await fetchOpenverseOnce(trimmed, pageSize, pageNum);
      console.log(
        JSON.stringify({
          event: "openverse.retry_result",
          trimmed,
          hit: second.images.length > 0,
        }),
      );
      candidate = second;
    }
  }

  // Validate thumbnails (HEAD-check raw URLs), then proxy-rewrite valid ones
  const validImages = await validateThumbnails(candidate.images);
  const proxyBase = process.env.PROXY_BASE;
  const finalImages = proxyRewrite(validImages, proxyBase);

  return { images: finalImages, provider: "openverse", error: candidate.error };
}
