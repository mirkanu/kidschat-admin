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
     * - /image-search-proxy/* (MCP proxy for image thumbnails — no session cookie in img src)
     * - _next/static, _next/image, favicon.ico (Next.js internals)
     */
    "/((?!login|api/auth|api/health|api/notify|api/cron|api/admin|api/image-search|image-search-proxy|_next/static|_next/image|favicon.ico).*)",
  ],
};
