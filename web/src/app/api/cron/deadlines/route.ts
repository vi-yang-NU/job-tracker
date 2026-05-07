import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { emitNotification } from "@/lib/persist";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Once a day, scan for jobs whose deadlines fall in the next 3 days and emit
 * a "deadline_soon" notification per (job, day-bucket). The agent's inbox poll
 * picks these up. Idempotency is enforced by checking whether a notification
 * with the same job+kind+bucket already exists.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 86400_000);

  const upcoming = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        gte(schema.jobs.deadline, now),
        lte(schema.jobs.deadline, in3d),
        ne(schema.jobs.status, "withdrawn"),
        ne(schema.jobs.status, "applied")
      )
    );

  let emitted = 0;
  for (const j of upcoming) {
    if (!j.deadline) continue;
    const bucket = j.deadline.toISOString().slice(0, 10); // YYYY-MM-DD
    const existing = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, j.userId),
          eq(schema.notifications.kind, "deadline_soon"),
          eq(schema.notifications.jobId, j.id),
          sql`json_extract(${schema.notifications.payload}, '$.bucket') = ${bucket}`
        )
      )
      .limit(1);
    if (existing.length > 0) continue;
    await emitNotification(j.userId, j.id, "deadline_soon", {
      bucket,
      title: j.title,
      company: j.company,
      url: j.url,
      deadline: j.deadline.toISOString(),
    });
    emitted++;
  }

  return NextResponse.json({ scanned: upcoming.length, emitted });
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}
