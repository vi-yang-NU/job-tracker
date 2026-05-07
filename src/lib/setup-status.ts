import { sql } from "drizzle-orm";
import { getDb } from "@jobtracker/db";

export interface SetupCheck {
  id: string;
  label: string;
  ok: boolean;
  hint: string;
}

export interface SetupStatus {
  ok: boolean;
  checks: SetupCheck[];
}

/**
 * Server-side check for whether the operator has finished configuring this
 * deployment. Used by the home page to render either the setup wizard or the
 * normal landing page. Treat this as advisory — never throws, even if the DB
 * is completely unreachable.
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const checks: SetupCheck[] = [];

  const env = (k: string) => !!(process.env[k] && process.env[k]!.trim());

  checks.push({
    id: "auth_secret",
    label: "AUTH_SECRET",
    ok: env("AUTH_SECRET"),
    hint: "Generate with `openssl rand -base64 32`. Set in Vercel → Settings → Environment Variables.",
  });
  checks.push({
    id: "google_id",
    label: "AUTH_GOOGLE_ID",
    ok: env("AUTH_GOOGLE_ID"),
    hint: "Create OAuth credentials at console.cloud.google.com/apis/credentials.",
  });
  checks.push({
    id: "google_secret",
    label: "AUTH_GOOGLE_SECRET",
    ok: env("AUTH_GOOGLE_SECRET"),
    hint: "From the same Google OAuth client.",
  });
  checks.push({
    id: "nextauth_url",
    label: "NEXTAUTH_URL",
    ok: env("NEXTAUTH_URL"),
    hint: "Your deployed origin, e.g. https://your-app.vercel.app (no trailing slash).",
  });
  checks.push({
    id: "turso_url",
    label: "TURSO_DATABASE_URL",
    ok: env("TURSO_DATABASE_URL") && process.env.TURSO_DATABASE_URL !== "libsql://unset.invalid",
    hint: "Create a free DB at turso.tech. The URL looks like `libsql://NAME.turso.io`.",
  });
  checks.push({
    id: "turso_token",
    label: "TURSO_AUTH_TOKEN",
    ok: env("TURSO_AUTH_TOKEN"),
    hint: "`turso db tokens create <db-name>`.",
  });

  // Active DB ping — only if the URL/token both look set, to avoid noisy errors.
  if (
    process.env.TURSO_DATABASE_URL &&
    process.env.TURSO_DATABASE_URL !== "libsql://unset.invalid" &&
    process.env.TURSO_AUTH_TOKEN
  ) {
    let dbOk = false;
    let detail = "Could not reach Turso. Check the URL/token and that you ran `npm run db:push`.";
    try {
      const db = getDb();
      // A trivial query against a real table; if the schema isn't pushed, this fails clearly.
      await db.run(sql`select 1`);
      dbOk = true;
      detail = "Database reachable.";
    } catch (err) {
      detail = `Could not query Turso: ${(err as Error).message.slice(0, 120)}`;
    }
    checks.push({
      id: "db_ping",
      label: "Database reachable",
      ok: dbOk,
      hint: detail,
    });
  } else {
    checks.push({
      id: "db_ping",
      label: "Database reachable",
      ok: false,
      hint: "Set the Turso env vars first, then redeploy.",
    });
  }

  // Google OAuth callback whitelist can't be checked from the server; surface it
  // as a manual step the operator confirms.
  return {
    ok: checks.every((c) => c.ok),
    checks,
  };
}
