/**
 * Openverse provider.
 *
 * Calls the public (unauthenticated) Openverse API and normalizes the response.
 * Strips `foreign_landing_url` and `url` from every result — this is option-iii
 * click-through policy enforcement at the tool boundary, not at the prompt
 * layer. The agent cannot leak a source-site URL because the tool never returns
 * one.
 *
 * Phase 21 additions:
 *   - Zero-result modifier-trim retry (20-05 C-2, SEARCH-02). When the first
 *     call returns 0 results AND the query has >1 non-stopword tokens AND
 *     stripping modifiers actually shortens the query, retry ONCE with the
 *     trimmed query. No third attempt.
 *   - Proxy rewrite of every image `thumbnail` when PROXY_BASE is set. Raw
 *     upstream thumbnail URL never leaves the tool boundary (same policy shape
 *     as D-3 foreign_landing_url stripping).
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
    res = await fetch(url, { headers: { Accept: "application/json" } });
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

  const proxyBase = process.env.PROXY_BASE;
  const raw = Array.isArray(data.results) ? data.results : [];
  const images: OpenverseImage[] = raw
    .filter((r) => typeof r.thumbnail === "string" && r.thumbnail.length > 0)
    .map((r) => {
      const rawThumb = r.thumbnail as string;
      const thumb = proxyBase
        ? `${proxyBase.replace(/\/+$/, "")}/proxy?u=${Buffer.from(rawThumb).toString("base64url")}`
        : rawThumb;
      return {
        thumbnail: thumb,
        title: typeof r.title === "string" ? r.title : "",
        source_domain: typeof r.source === "string" ? r.source : "",
        provider: "openverse" as const,
        license: typeof r.license === "string" ? r.license : "",
      };
    });

  return { images, provider: "openverse" };
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
  if (first.images.length > 0) return first;

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
    return first;
  }

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
  return second;
}
