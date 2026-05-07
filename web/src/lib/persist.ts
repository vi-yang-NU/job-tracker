import { db, schema } from "./db";
import { and, eq, sql } from "drizzle-orm";
import type { FetchedJob, SimilarPosting } from "@jobtracker/core";

export interface UpsertContext {
  userId: string;
  portfolioId: string;
  url: string;
}

/**
 * Insert-or-update a job for (user, canonical url). Adds it to the portfolio
 * if missing. Records a snapshot. Updates status to "removed" when fetcher
 * reports unavailable.
 */
export async function upsertJobFromFetch(
  ctx: UpsertContext,
  fetched: FetchedJob,
  httpStatus: number | undefined
) {
  const now = new Date();
  const existing = await db.query.jobs.findFirst({
    where: (j, { and, eq }) =>
      and(eq(j.userId, ctx.userId), eq(j.canonicalUrl, fetched.canonicalUrl)),
  });

  let jobId: string;
  if (existing) {
    jobId = existing.id;
    await db
      .update(schema.jobs)
      .set({
        title: fetched.title ?? existing.title,
        company: fetched.company ?? existing.company,
        location: fetched.location ?? existing.location,
        isRemote: fetched.isRemote ?? existing.isRemote,
        deadline: fetched.deadline ?? existing.deadline,
        postedAt: fetched.postedAt ?? existing.postedAt,
        salaryMin: fetched.salaryMin ?? existing.salaryMin,
        salaryMax: fetched.salaryMax ?? existing.salaryMax,
        site: fetched.site,
        lastFetchedAt: now,
        lastSeenAt: fetched.available ? now : existing.lastSeenAt,
        status: fetched.available
          ? existing.status === "removed"
            ? "active"
            : existing.status
          : existing.status === "active"
            ? "removed"
            : existing.status,
      })
      .where(eq(schema.jobs.id, existing.id));
  } else {
    const inserted = await db
      .insert(schema.jobs)
      .values({
        userId: ctx.userId,
        url: ctx.url,
        canonicalUrl: fetched.canonicalUrl,
        site: fetched.site,
        title: fetched.title,
        company: fetched.company,
        location: fetched.location,
        isRemote: fetched.isRemote ?? false,
        deadline: fetched.deadline,
        postedAt: fetched.postedAt,
        salaryMin: fetched.salaryMin,
        salaryMax: fetched.salaryMax,
        lastFetchedAt: now,
        lastSeenAt: fetched.available ? now : undefined,
        status: fetched.available ? "active" : "removed",
      })
      .returning({ id: schema.jobs.id });
    jobId = inserted[0].id;
  }

  await db
    .insert(schema.portfolioJobs)
    .values({ portfolioId: ctx.portfolioId, jobId })
    .onConflictDoNothing();

  await db.insert(schema.snapshots).values({
    jobId,
    httpStatus,
    available: fetched.available,
    contentHash: fetched.contentHash,
  });

  return jobId;
}

export async function recordFetchFailure(jobId: string, httpStatus?: number) {
  await db.insert(schema.snapshots).values({
    jobId,
    httpStatus,
    available: false,
    diff: { error: "fetch_failed" },
  });
  await db
    .update(schema.jobs)
    .set({ lastFetchedAt: new Date() })
    .where(eq(schema.jobs.id, jobId));
}

export async function recordSimilar(
  portfolioId: string,
  sourceJobId: string | null,
  postings: SimilarPosting[]
) {
  if (postings.length === 0) return 0;
  const values = postings.map((p) => ({
    portfolioId,
    sourceJobId,
    url: p.url,
    site: p.site,
    title: p.title,
    company: p.company,
    location: p.location,
  }));
  await db.insert(schema.similarJobs).values(values).onConflictDoNothing();
  return values.length;
}

/** Detect status changes since the previous snapshot. Used for notifications. */
export async function priorAvailability(jobId: string): Promise<boolean | null> {
  const rows = await db
    .select({ available: schema.snapshots.available })
    .from(schema.snapshots)
    .where(eq(schema.snapshots.jobId, jobId))
    .orderBy(sql`${schema.snapshots.fetchedAt} desc`)
    .limit(2);
  // index 0 is the latest (just inserted); 1 is the prior
  return rows.length >= 2 ? Boolean(rows[1].available) : null;
}
