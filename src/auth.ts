import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import getMongoClient from "@/lib/mongodb";
import type { LibreChatUser } from "@/types/user";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const client = await getMongoClient();
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
});
