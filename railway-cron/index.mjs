/**
 * KidsChat Notification Cron
 *
 * Run by Railway on a daily schedule (0 8 * * * — daily 8am UTC).
 * Calls the admin dashboard's notification endpoints with a shared secret.
 *
 * - Daily summary: runs every day
 * - Weekly digest: runs every day but the endpoint auto-skips on non-Mondays
 *
 * Required env vars:
 *   ADMIN_URL    — Base URL of the admin dashboard (no trailing slash)
 *   CRON_SECRET  — Shared secret that must match the admin app's CRON_SECRET
 */

async function callEndpoint(adminUrl, cronSecret, path, label) {
  const url = `${adminUrl}${path}`;
  console.log(`[cron] POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({ trigger: "cron" }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }

  console.log(`[cron] ${label} — status: ${res.status}`);
  console.log(`[cron] ${label} — body:`, JSON.stringify(body, null, 2));

  if (!res.ok) {
    console.error(`[cron] ERROR: ${label} endpoint returned non-OK status:`, res.status);
    return false;
  }

  console.log(`[cron] ${label} completed successfully.`);
  return true;
}

async function main() {
  const adminUrl = process.env.ADMIN_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!adminUrl) {
    console.error("[cron] ERROR: ADMIN_URL environment variable is not set.");
    process.exit(1);
  }

  if (!cronSecret) {
    console.error("[cron] ERROR: CRON_SECRET environment variable is not set.");
    process.exit(1);
  }

  // 1. Daily summary — runs every day
  const dailyOk = await callEndpoint(
    adminUrl,
    cronSecret,
    "/api/notify/daily-summary",
    "Daily Summary"
  );

  // 2. Weekly digest — endpoint auto-skips on non-Mondays
  const weeklyOk = await callEndpoint(
    adminUrl,
    cronSecret,
    "/api/notify/weekly-digest",
    "Weekly Digest"
  );

  if (!dailyOk || !weeklyOk) {
    console.error("[cron] One or more endpoints failed.");
    process.exit(1);
  }

  console.log("[cron] All notification endpoints triggered successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[cron] Unhandled error:", err);
    process.exit(1);
  });
