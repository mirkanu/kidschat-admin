export interface PixabayImage {
  thumbnail: string;
  title: string;
  source_domain: string;
  provider: "pixabay";
  license: string;
}

export interface PixabayResult {
  images: PixabayImage[];
  provider: "pixabay";
  error?: "upstream_error" | "rate_limited";
}

const PIXABAY_BASE = "https://pixabay.com/api/";

function proxyRewrite(images: PixabayImage[], proxyBase: string | undefined): PixabayImage[] {
  if (!proxyBase) return images;
  const base = proxyBase.replace(/\/+$/, "");
  return images.map((img) => ({
    ...img,
    thumbnail: `${base}/proxy?u=${Buffer.from(img.thumbnail).toString("base64url")}`,
  }));
}

export async function searchPixabayImages(
  query: string,
  count: number = 10,
): Promise<PixabayResult> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    console.log(JSON.stringify({ event: "pixabay.no_api_key" }));
    return { images: [], provider: "pixabay", error: "upstream_error" };
  }

  const pageSize = Math.max(1, Math.min(count, 20));
  const url = `${PIXABAY_BASE}?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&safesearch=true&per_page=${pageSize}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    return { images: [], provider: "pixabay", error: "upstream_error" };
  }

  if (res.status === 429) return { images: [], provider: "pixabay", error: "rate_limited" };
  if (!res.ok) {
    console.log(JSON.stringify({ event: "pixabay.error", status: res.status }));
    return { images: [], provider: "pixabay", error: "upstream_error" };
  }

  const data = (await res.json()) as { hits?: Array<{ previewURL?: string; tags?: string }> };
  const hits = Array.isArray(data.hits) ? data.hits : [];

  const images: PixabayImage[] = hits
    .filter((h) => typeof h.previewURL === "string" && h.previewURL.length > 0)
    .map((h) => ({
      thumbnail: h.previewURL as string,
      title: typeof h.tags === "string" ? h.tags.split(",")[0].trim() : "",
      source_domain: "pixabay.com",
      provider: "pixabay" as const,
      license: "Pixabay License",
    }));

  const proxyBase = process.env.PROXY_BASE;
  return { images: proxyRewrite(images, proxyBase), provider: "pixabay" };
}
