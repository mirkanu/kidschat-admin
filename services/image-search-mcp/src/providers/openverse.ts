/**
 * Openverse provider.
 *
 * Calls the public (unauthenticated) Openverse API and normalizes the response.
 * Strips `foreign_landing_url` and `url` from every result — this is option-iii
 * click-through policy enforcement at the tool boundary, not at the prompt
 * layer. The agent cannot leak a source-site URL because the tool never returns
 * one.
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

export async function searchOpenverseImages(
  query: string,
  count: number = 10,
): Promise<OpenverseResult> {
  const pageSize = Math.max(1, Math.min(count, 30));
  const url = `${OPENVERSE_BASE}?q=${encodeURIComponent(query)}&page_size=${pageSize}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
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
    .map((r) => ({
      thumbnail: r.thumbnail as string,
      title: typeof r.title === "string" ? r.title : "",
      source_domain: typeof r.source === "string" ? r.source : "",
      provider: "openverse" as const,
      license: typeof r.license === "string" ? r.license : "",
    }));

  return { images, provider: "openverse" };
}
