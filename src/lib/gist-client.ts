/**
 * GitHub Gist read/write wrapper using native fetch.
 * Server-only — reads GITHUB_GIST_TOKEN from process.env.
 */

const GITHUB_API_BASE = "https://api.github.com";

function getToken(): string {
  const token = process.env.GITHUB_GIST_TOKEN;
  if (!token) {
    throw new Error("Missing environment variable: GITHUB_GIST_TOKEN");
  }
  return token;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function fetchGist(
  gistId: string
): Promise<{ content: string; updatedAt: string }> {
  const token = getToken();
  const res = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub Gist fetch failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    files: Record<string, { content: string }>;
    updated_at: string;
  };

  const files = data.files;
  const firstFile = Object.values(files)[0];
  if (!firstFile) {
    throw new Error("Gist has no files");
  }

  return {
    content: firstFile.content,
    updatedAt: data.updated_at,
  };
}

export async function updateGist(
  gistId: string,
  filename: string,
  content: string
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    method: "PATCH",
    headers: githubHeaders(token),
    body: JSON.stringify({
      files: {
        [filename]: { content },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub Gist update failed (${res.status}): ${errBody}`);
  }
}
