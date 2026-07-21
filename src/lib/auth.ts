import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { emailSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import {
  startSession,
  isSessionActive,
  requestFingerprint,
} from "@/lib/session";

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
    // Refresh-token rotation (Phase 3.3 checklist): satisfied by NextAuth's
    // rolling JWT rather than a separate refresh-token table. The signed session
    // token is short-lived (maxAge 1h) and is re-issued — a fresh `exp` and a
    // re-run of the jwt() callback — on activity, at most once per updateAge
    // window (15m). Because the jwt() callback re-validates the session `sid`
    // against the UserSession table on every rotation, a revoked device stops
    // getting refreshed tokens and its access dies within a rotation window.
    // There is no long-lived refresh secret to steal/replay.
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
      async authorize(credentials, req) {
        const parsedEmail = emailSchema.safeParse(credentials?.email);
        if (!parsedEmail.success || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsedEmail.data },
        });

        // Reject if the user has no local password (e.g. Google-only account).
        if (!user?.passwordHash) {
          await recordAudit({
            action: "auth_login_failed",
            userId: user?.id ?? null,
            metadata: { email: parsedEmail.data, reason: "no_password" },
          });
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) {
          await recordAudit({
            action: "auth_login_failed",
            userId: user.id,
            metadata: { email: parsedEmail.data, reason: "bad_password" },
          });
          return null;
        }

        // Suspended accounts (admin trust-and-safety action) cannot sign in.
        if (user.suspended) {
          await recordAudit({
            action: "auth_login_failed",
            userId: user.id,
            metadata: { email: parsedEmail.data, reason: "suspended" },
          });
          return null;
        }

        await recordAudit({ action: "auth_login_success", userId: user.id });

        // Open a tracked session for this device (Phase 1.3). The row id becomes
        // the JWT `sid`, enabling remote logout + suspicious-login detection.
        const fingerprint = requestFingerprint(
          req?.headers as Record<string, string> | undefined,
        );
        const sid = await startSession({
          userId: user.id,
          ip: fingerprint.ip,
          userAgent: fingerprint.userAgent,
        });

        // Only non-sensitive fields — never the password hash.
        return {
          id: user.id,
          email: user.email,
          verificationLevel: user.verificationLevel,
          sid,
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
        // Credentials sign-in supplies the sid we created in authorize().
        // Google sign-in has no sid yet — open a tracked session now. (Device
        // fingerprint isn't available in this callback for OAuth, so it's
        // recorded without IP/UA; the row still enables remote logout.)
        const sidFromUser = (user as { sid?: string }).sid;
        if (sidFromUser) {
          token.sid = sidFromUser;
        } else if (dbUser) {
          token.sid = await startSession({
            userId: dbUser.id,
            ip: null,
            userAgent: null,
          });
        }
        return token;
      }

      // Subsequent requests: validate the tracked session so remote logout /
      // suspicious-login revocation takes effect. A revoked or missing session
      // clears the identity, which NextAuth treats as an unauthenticated token.
      if (token.sid) {
        const active = await isSessionActive(token.sid as string);
        if (!active) {
          delete token.uid;
          delete token.sid;
          delete token.verificationLevel;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.verificationLevel = token.verificationLevel as string;
        session.user.sid = token.sid as string | undefined;
      }
      return session;
    },
  },
};
