import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { emailSchema } from "@/lib/validation";

// NextAuth (Auth.js) configuration.
//
// Session strategy is JWT (see technical-foundation.md "Decisions log"): the
// DB/Prisma adapter is intentionally NOT used because its User contract
// conflicts with our schema (emailVerified is a Boolean flag, and we have no
// Account/Session tables). Instead:
//   - Credentials provider authenticates against User.passwordHash with bcrypt.
//   - Google OAuth users are upserted into User by email in the callbacks.
//
// Passwords are never logged and never returned to the client.

const GOOGLE_ENABLED =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    // Short-lived access token; NextAuth rotates the JWT on activity.
    maxAge: 60 * 60, // 1 hour
    updateAge: 15 * 60, // refresh the token at most every 15 minutes
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedEmail = emailSchema.safeParse(credentials?.email);
        if (!parsedEmail.success || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsedEmail.data },
        });

        // Reject if the user has no local password (e.g. Google-only account).
        if (!user?.passwordHash) {
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) {
          return null;
        }

        // Suspended accounts (admin trust-and-safety action) cannot sign in.
        if (user.suspended) {
          return null;
        }

        // Only non-sensitive fields — never the password hash.
        return {
          id: user.id,
          email: user.email,
          verificationLevel: user.verificationLevel,
        };
      },
    }),
    ...(GOOGLE_ENABLED
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    // Upsert Google users into our User table on sign-in.
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase();
        await prisma.user.upsert({
          where: { email },
          update: { emailVerified: true },
          create: {
            email,
            emailVerified: true,
          },
        });
      }
      return true;
    },
    // Persist our internal user id + verification level onto the JWT.
    async jwt({ token, user }) {
      // On initial sign-in `user` is set. For Google, look up the row we just
      // upserted to get our internal cuid rather than the OAuth provider id.
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { id: true, verificationLevel: true },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.verificationLevel = dbUser.verificationLevel;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.verificationLevel = token.verificationLevel as string;
      }
      return session;
    },
  },
};
