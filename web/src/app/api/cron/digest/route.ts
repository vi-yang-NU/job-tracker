import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { Resend } from "resend";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Daily email digest fallback for users who haven't installed the Mac agent.
 * The agent supersedes this — it sends iMessage + native notifications instead.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: "RESEND_API_KEY not configured" });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.DIGEST_FROM_EMAIL ?? "jobs@example.dev";

  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86400_000);

  const users = await db.select().from(schema.users);
  let sent = 0;

  for (const u of users) {
    if (!u.email) continue;
    const upcoming = await db
      .select()
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.userId, u.id),
          gte(schema.jobs.deadline, now),
          lte(schema.jobs.deadline, in7d),
          ne(schema.jobs.status, "withdrawn")
        )
      )
      .orderBy(schema.jobs.deadline)
      .limit(20);

    if (upcoming.length === 0) continue;

    const lines = upcoming
      .map(
        (j) =>
          `<li><a href="${j.url}">${escape(j.title || j.url)}</a> ${
            j.company ? `— ${escape(j.company)}` : ""
          } · deadline ${j.deadline?.toLocaleDateString() ?? "?"}</li>`
      )
      .join("");

    await resend.emails.send({
      from,
      to: u.email,
      subject: `Job tracker · ${upcoming.length} deadline${upcoming.length === 1 ? "" : "s"} this week`,
      html: `<h2>Upcoming deadlines</h2><ul>${lines}</ul>`,
    });
    sent++;
  }

  return NextResponse.json({ usersChecked: users.length, sent });
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;"
  );
}
