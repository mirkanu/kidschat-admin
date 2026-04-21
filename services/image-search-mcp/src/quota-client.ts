/**
 * Quota client — calls kidschat-admin /api/image-search/quota with a shared
 * secret, returning { allowed, remaining }. SEARCH-07.
 *
 * DELIBERATE fail-open: if the admin endpoint is unreachable or misconfigured,
 * allow the search to proceed. A quota-service outage must NOT silently disable
 * kid search (T-21-06). The error field lets the caller log it for alerting.
 */

export interface QuotaResult {
  allowed: boolean;
  remaining: number | null;
  error?: string;
}

export async function checkAndIncrementQuota(userId: string): Promise<QuotaResult> {
  const base = process.env.ADMIN_BASE_URL;
  const secret = process.env.ADMIN_QUOTA_SECRET;
  if (!base || !secret) {
    return { allowed: true, remaining: null, error: "not_configured" };
  }
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/image-search/quota`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-quota-secret": secret,
      },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { allowed: true, remaining: null, error: `http_${res.status}` };
    }
    const data = (await res.json()) as { allowed: boolean; remaining: number };
    return { allowed: !!data.allowed, remaining: typeof data.remaining === "number" ? data.remaining : null };
  } catch (e) {
    return {
      allowed: true,
      remaining: null,
      error: e instanceof Error ? e.message : "fetch_error",
    };
  }
}
