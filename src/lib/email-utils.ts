/**
 * Returns the from address for outgoing emails.
 * Falls back to Resend's onboarding address for local development without a verified domain.
 */
export function getFromAddress(): string {
  return process.env.RESEND_FROM_ADDRESS ?? "KidsChat <onboarding@resend.dev>";
}

/**
 * Returns the base URL of the admin dashboard (no trailing slash).
 */
export function getAdminUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    "https://kidschat-admin-production.up.railway.app"
  );
}
