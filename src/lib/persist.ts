import { db, schema } from "./db";
import { eq, sql } from "drizzle-orm";
import type { FetchedJob, SimilarPosting } from "@jobtracker/core";

export interface UpsertContext {
  userId: string;
  url: string;
}

export interface UpsertChange {
  jobId: string;
  isNew: boolean;
  /** Availability of the job in the previous snapshot. null = never fetched before. */
  priorAvailable: boolean | null;
  deadlineNewlySet: boolean;
  priorStatus: string | null;
}

/** Upsert a job by (user, canonical url) and append a snapshot. */
export async function upsertJobFromFetch(
  ctx: UpsertContext,
  fetched: FetchedJob,
  httpStatus: number | undefined
): Promise<UpsertChange> {
  const now = new Date();
  const existing = await db.query.jobs.findFirst({
    where: (j, { and, eq }) =>
      and(eq(j.userId, ctx.userId), eq(j.canonicalUrl, fetched.canonicalUrl)),
  });

  let jobId: string;
  const isNew = !existing;
  const priorStatus = existing?.status ?? null;
  const deadlineNewlySet = !existing?.deadline && !!fetched.deadline;

  if (existing) {
    jobId = existing.id;
    let nextStatus = existing.status;
    if (existing.status === "active" && !fetched.available) nextStatus = "removed";
    else if (existing.status === "removed" && fetched.available) nextStatus = "active";

    // Description changed → invalidate parsed requirements so the agent re-runs.
    const descriptionChanged =
      typeof fetched.description === "string" &&
      fetched.description !== existing.description;
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
        description: fetched.description ?? existing.description,
        requirementsParsedAt: descriptionChanged ? null : existing.requirementsParsedAt,
        site: fetched.site,
        lastFetchedAt: now,
        lastSeenAt: fetched.available ? now : existing.lastSeenAt,
        status: nextStatus,
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
        description: fetched.description,
        lastFetchedAt: now,
        lastSeenAt: fetched.available ? now : undefined,
        status: fetched.available ? "active" : "watching",
      })
      .returning({ id: schema.jobs.id });
    jobId = inserted[0].id;
  }

  const priorAvailable = await priorAvailability(jobId);

  await db.insert(schema.snapshots).values({
    jobId,
    httpStatus,
    available: fetched.available,
    contentHash: fetched.contentHash,
  });

  return { jobId, isNew, priorAvailable, deadlineNewlySet, priorStatus };
}

export async function recordSimilar(
  userId: string,
  sourceJobId: string | null,
  postings: SimilarPosting[]
) {
  if (postings.length === 0) return 0;
  const values = postings.map((p) => ({
    userId,
    sourceJobId,
    url: p.url,
    site: p.site,
    title: p.title,
    company: p.company,
    location: p.location,
  }));
  const result = await db
    .insert(schema.similarJobs)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: schema.similarJobs.id });
  return result.length;
}

export async function priorAvailability(jobId: string): Promise<boolean | null> {
  const rows = await db
    .select({ available: schema.snapshots.available })
    .from(schema.snapshots)
    .where(eq(schema.snapshots.jobId, jobId))
    .orderBy(sql`${schema.snapshots.fetchedAt} desc`)
    .limit(1);
  return rows.length > 0 ? Boolean(rows[0].available) : null;
}

export async function emitNotification(
  userId: string,
  jobId: string | null,
  kind:
    | "deadline_soon"
    | "deadline_set"
    | "job_opened"
    | "job_removed"
    | "job_unlocked"
    | "new_similar"
    | "fetch_failed",
  payload: Record<string, unknown>
) {
  await db.insert(schema.notifications).values({
    userId,
    jobId,
    kind,
    payload,
  });
}
