import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq, lte } from "drizzle-orm";
import { emitNotification } from "@/lib/persist";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Daily unlock scan. Pure SQL — for every eligibility row with status='future'
 * and unlock_at <= now, flip to 'ready' and emit a `job_unlocked` notification.
 *
 * This complements the agent-driven re-scoring: the agent recomputes when
 * descriptions change or the resume is updated; this cron flips eligibility
 * purely as time passes, no LLM call needed.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();

  const due = await db
    .select({
      el: schema.eligibility,
      job: schema.jobs,
    })
    .from(schema.eligibility)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.eligibility.jobId))
    .where(
      and(
        eq(schema.eligibility.status, "future"),
        lte(schema.eligibility.unlockAt, now)
      )
    )
    .limit(200);

  let unlocked = 0;
  for (const { el, job } of due) {
    await db
      .update(schema.eligibility)
      .set({ status: "ready", computedAt: now, unlockAt: null })
      .where(
        and(
          eq(schema.eligibility.userId, el.userId),
          eq(schema.eligibility.jobId, el.jobId)
        )
      );
    await emitNotification(el.userId, el.jobId, "job_unlocked", {
      title: job.title,
      company: job.company,
      url: job.url,
    });
    unlocked++;
  }

  return NextResponse.json({ scanned: due.length, unlocked });
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}
