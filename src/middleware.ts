export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /login (the auth page itself)
     * - /api/auth/* (NextAuth handlers)
     * - _next/static, _next/image, favicon.ico (Next.js internals)
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
