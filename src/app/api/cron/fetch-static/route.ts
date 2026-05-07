import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, ne, or, isNull, lt } from "drizzle-orm";
import { fetchJob, fetchSimilar } from "@jobtracker/core";
import { upsertJobFromFetch, recordSimilar, emitNotification } from "@/lib/persist";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Vercel Cron handler. Runs every 3h (configured in vercel.json).
 * Iterates over every job whose adapter does NOT need a browser and refreshes it.
 * Browser-only jobs (LinkedIn, Workday) are left to the per-user Mac agent.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - 2.5 * 3600_000);

  const candidates = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        ne(schema.jobs.status, "withdrawn"),
        or(isNull(schema.jobs.lastFetchedAt), lt(schema.jobs.lastFetchedAt, cutoff))
      )
    )
    .limit(150);

  const results: Array<{ jobId: string; ok: boolean; error?: string }> = [];

  for (const job of candidates) {
    const result = await fetchJob(job.canonicalUrl, { staticOnly: true });
    if (!result.ok || !result.job) {
      results.push({ jobId: job.id, ok: false, error: result.error });
      continue;
    }
    const change = await upsertJobFromFetch(
      { userId: job.userId, url: job.url },
      result.job,
      result.httpStatus
    );
    if (!change.isNew) {
      const fjob = result.job;
      if (change.priorAvailable === false && fjob.available) {
        await emitNotification(job.userId, change.jobId, "job_opened", {
          title: fjob.title,
          company: fjob.company,
          url: job.url,
          site: fjob.site,
        });
      }
      if (change.priorAvailable === true && !fjob.available) {
        await emitNotification(job.userId, change.jobId, "job_removed", {
          title: fjob.title,
          company: fjob.company,
          url: job.url,
          site: fjob.site,
        });
      }
      if (change.deadlineNewlySet && fjob.deadline) {
        await emitNotification(job.userId, change.jobId, "deadline_set", {
          title: fjob.title,
          company: fjob.company,
          url: job.url,
          deadline: fjob.deadline.toISOString(),
        });
      }
    }
    const sims = await fetchSimilar(job.canonicalUrl, { staticOnly: true });
    if (sims.length > 0) {
      const added = await recordSimilar(job.userId, job.id, sims);
      if (added > 0) {
        await emitNotification(job.userId, job.id, "new_similar", {
          count: added,
          sample: sims.slice(0, 3).map((s) => ({ title: s.title, url: s.url })),
        });
      }
    }
    results.push({ jobId: job.id, ok: true });
  }

  return NextResponse.json({ scanned: candidates.length, results });
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}
