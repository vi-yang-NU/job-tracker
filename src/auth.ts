import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required when running behind a proxy (Vercel). Auth.js v5 betas don't
  // always auto-detect this from VERCEL=1, so set it explicitly.
  trustHost: true,
  // Surface the underlying cause to Vercel function logs instead of the opaque
  // "Configuration" string the framework returns to the browser.
  logger: {
    error(error) {
      console.error("[auth]", error);
    },
    warn(code) {
      console.warn("[auth]", code);
    },
    debug(message, metadata) {
      // No-op by default; enable AUTH_DEBUG=1 in env to see verbose output.
      if (process.env.AUTH_DEBUG) console.log("[auth]", message, metadata);
    },
  },
  adapter: DrizzleAdapter(db as any, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) (session.user as any).id = user.id;
      return session;
    },
  },
});
