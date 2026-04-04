import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import type { LibreChatUser } from "@/types/user";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const client = await clientPromise;
        const db = client.db("test"); // LibreChat database name
        const user = await db
          .collection<LibreChatUser>("users")
          .findOne({ email: (credentials.email as string).toLowerCase() });

        if (!user) return null;

        const passwordMatch = await compare(
          credentials.password as string,
          user.password
        );
        if (!passwordMatch) return null;

        // ADMIN role check — non-admin users are explicitly refused here
        if (user.role !== "ADMIN") {
          // Throw error causes NextAuth to return error — non-admin denied
          throw new Error("ACCESS_DENIED");
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Persist role in JWT on initial sign-in
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose role and id in the session object
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // redirect errors back to login page with ?error= query param
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
