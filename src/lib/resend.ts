import { Resend } from "resend";

let _resend: Resend | undefined;

/**
 * Returns a Resend singleton.
 * Throws at call time (not import time) if RESEND_API_KEY is missing,
 * so the module can be safely imported during Next.js build.
 */
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing environment variable "RESEND_API_KEY". Add it to your .env.local and Railway environment.'
      );
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

/**
 * Resend client proxy — access as `resend.emails.send(...)` exactly like the
 * eagerly-initialized singleton, but the key check is deferred to first use.
 */
export const resend: Resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResend() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
