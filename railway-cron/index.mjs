/**
 * KidsChat Weekly Digest Cron
 *
 * Run by Railway on a schedule (0 8 * * 1 — Monday 8am UTC).
 * Calls the admin dashboard's weekly digest endpoint with a shared secret.
 *
 * Required env vars:
 *   ADMIN_URL    — Base URL of the admin dashboard (no trailing slash)
 *   CRON_SECRET  — Shared secret that must match the admin app's CRON_SECRET
 */

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

  const url = `${adminUrl}/api/notify/weekly-digest`;
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

  console.log("[cron] Response status:", res.status);
  console.log("[cron] Response body:", JSON.stringify(body, null, 2));

  if (!res.ok) {
    console.error("[cron] ERROR: Digest endpoint returned non-OK status:", res.status);
    process.exit(1);
  }

  console.log("[cron] Weekly digest triggered successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[cron] Unhandled error:", err);
    process.exit(1);
  });
