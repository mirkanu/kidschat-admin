import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Use the edge-safe auth config for middleware — no MongoDB, no Node.js modules
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /login (the auth page itself)
     * - /api/auth/* (NextAuth handlers)
     * - /api/health (Railway health check — must be unauthenticated)
     * - _next/static, _next/image, favicon.ico (Next.js internals)
     */
    "/((?!login|api/auth|api/health|api/notify|api/cron|api/admin|_next/static|_next/image|favicon.ico).*)",
  ],
};
