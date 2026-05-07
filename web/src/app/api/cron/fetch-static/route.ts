import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq, ne, or, isNull, lt } from "drizzle-orm";
import { fetchJob, fetchSimilar } from "@jobtracker/core";
import { upsertJobFromFetch, recordSimilar, priorAvailability } from "@/lib/persist";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Vercel Cron handler. Runs every 3h (configured in vercel.json).
 * Iterates over jobs whose adapter does NOT need a browser and refreshes them.
 * Browser-only jobs (LinkedIn, Workday) are left to the per-user Mac agent.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - 2.5 * 3600_000);

  const candidates = await db
    .select({
      job: schema.jobs,
      portfolioId: schema.portfolioJobs.portfolioId,
    })
    .from(schema.jobs)
    .innerJoin(schema.portfolioJobs, eq(schema.portfolioJobs.jobId, schema.jobs.id))
    .where(
      and(
        ne(schema.jobs.status, "withdrawn"),
        or(isNull(schema.jobs.lastFetchedAt), lt(schema.jobs.lastFetchedAt, cutoff))
      )
    )
    .limit(150);

  const results: Array<{ jobId: string; ok: boolean; error?: string }> = [];

  for (const { job, portfolioId } of candidates) {
    const result = await fetchJob(job.canonicalUrl, { staticOnly: true });
    if (!result.ok || !result.job) {
      results.push({ jobId: job.id, ok: false, error: result.error });
      continue;
    }
    const wasAvailable = await priorAvailability(job.id);
    await upsertJobFromFetch(
      { userId: job.userId, portfolioId, url: job.url },
      result.job,
      result.httpStatus
    );
    if (wasAvailable === true && !result.job.available) {
      // For "removed" we leave notification dispatch to the digest cron / agent
    }
    const sims = await fetchSimilar(job.canonicalUrl, { staticOnly: true });
    if (sims.length > 0) await recordSimilar(portfolioId, job.id, sims);
    results.push({ jobId: job.id, ok: true });
  }

  return NextResponse.json({ scanned: candidates.length, results });
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // Allow local dev when not configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}
