import Link from "next/link";

const EXPLANATIONS: Record<string, { title: string; body: string; fix?: string }> = {
  Configuration: {
    title: "Server configuration",
    body: "Auth.js can't talk to its provider or its database. The exact reason was logged on the server.",
    fix: "Vercel → Logs → look for a line tagged `[auth]` after your last sign-in attempt. Most common: a missing env var, or the auth tables aren't pushed to Turso (run `npm run db:push` locally with the Turso env vars set).",
  },
  AccessDenied: {
    title: "Access denied",
    body: "Google said no — usually because you cancelled the consent screen or the OAuth app isn't published / lacks the right test users.",
  },
  Verification: {
    title: "Verification expired",
    body: "The email verification link expired or was already used.",
  },
  OAuthSignin: {
    title: "Couldn't start the Google sign-in",
    body: "Auth.js failed to construct the redirect to Google.",
    fix: "Confirm AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are set in Vercel and have no whitespace.",
  },
  OAuthCallback: {
    title: "Google callback failed",
    body: "Google sent us back but Auth.js couldn't validate the response.",
    fix: "Confirm Authorized redirect URIs in Google Cloud Console contains exactly `" +
      (process.env.NEXTAUTH_URL ?? "https://your-domain") +
      "/api/auth/callback/google`.",
  },
  OAuthCreateAccount: {
    title: "Couldn't create your account",
    body: "OAuth completed, but inserting your user into the database failed.",
    fix: "Run `npm run db:push` locally with the Turso env vars set, to make sure the auth tables match the expected schema.",
  },
  OAuthAccountNotLinked: {
    title: "Email already used by another sign-in method",
    body: "Your email is already associated with a different provider in this database.",
  },
  Default: {
    title: "Something went wrong signing in",
    body: "We hit an error during the sign-in flow.",
    fix: "Check Vercel → Logs for an `[auth]` line, or screenshot this page's URL and share it.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const code = error ?? "Default";
  const info = EXPLANATIONS[code] ?? EXPLANATIONS.Default;

  return (
    <div className="mx-auto mt-24 max-w-lg">
      <div className="animate-rise rounded-2xl border border-rose-200 bg-white p-8 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white">
            !
          </span>
          <h1 className="text-xl font-semibold">{info.title}</h1>
        </div>
        <p className="mt-3 text-sm text-black/70">{info.body}</p>

        <div className="mt-4 rounded-md border border-black/10 bg-black/[0.03] p-3 font-mono text-xs text-black/70">
          error code: {code}
        </div>

        {info.fix ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Try this:</strong> {info.fix}
          </div>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Link href="/login" className="btn-primary">
            Try again
          </Link>
          <Link href="/" className="btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
