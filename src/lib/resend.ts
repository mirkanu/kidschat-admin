import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error(
    'Missing environment variable "RESEND_API_KEY". Add it to your .env.local and Railway environment.'
  );
}

export const resend = new Resend(process.env.RESEND_API_KEY);
