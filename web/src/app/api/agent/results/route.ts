import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import {
  upsertJobFromFetch,
  recordSimilar,
  emitNotification,
} from "@/lib/persist";
import { eq } from "drizzle-orm";
import { z } from "zod";

const resultSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().url(),
      canonicalUrl: z.string().url(),
      portfolioIds: z.array(z.string()),
      ok: z.boolean(),
      httpStatus: z.number().optional(),
      error: z.string().optional(),
      job: z
        .object({
          url: z.string(),
          canonicalUrl: z.string(),
          site: z.string(),
          available: z.boolean(),
          title: z.string().optional(),
          company: z.string().optional(),
          location: z.string().optional(),
          isRemote: z.boolean().optional(),
          deadline: z.string().datetime().optional(),
          postedAt: z.string().datetime().optional(),
          contentHash: z.string().optional(),
        })
        .optional(),
      similar: z
        .array(
          z.object({
            url: z.string(),
            site: z.string(),
            title: z.string().optional(),
            company: z.string().optional(),
            location: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
});

export async function POST(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  let eventsEmitted = 0;

  for (const r of parsed.data.results) {
    if (!r.ok || !r.job) continue;
    const portfolioIds = r.portfolioIds.length > 0 ? r.portfolioIds : [];
    if (portfolioIds.length === 0) continue;

    const fetched = {
      ...r.job,
      deadline: r.job.deadline ? new Date(r.job.deadline) : undefined,
      postedAt: r.job.postedAt ? new Date(r.job.postedAt) : undefined,
    };

    for (const portfolioId of portfolioIds) {
      const change = await upsertJobFromFetch(
        { userId, portfolioId, url: r.url },
        fetched,
        r.httpStatus
      );

      // Re-read the job for the notification payload (title/company etc.)
      const job = await db.query.jobs.findFirst({
        where: (j, { eq }) => eq(j.id, change.jobId),
      });
      const summary = jobSummary(job);

      // Transition events ------------------------------------------------
      // Don't notify on the very first time we see a job — that's just adding it.
      if (!change.isNew) {
        if (change.priorAvailable === false && fetched.available) {
          await emitNotification(userId, change.jobId, "job_opened", {
            ...summary,
            portfolioId,
          });
          eventsEmitted++;
        }
        if (change.priorAvailable === true && !fetched.available) {
          await emitNotification(userId, change.jobId, "job_removed", {
            ...summary,
            portfolioId,
          });
          eventsEmitted++;
        }
        if (change.deadlineNewlySet && fetched.deadline) {
          await emitNotification(userId, change.jobId, "deadline_set", {
            ...summary,
            deadline: fetched.deadline.toISOString(),
            portfolioId,
          });
          eventsEmitted++;
        }
      }

      if (r.similar && r.similar.length > 0) {
        const added = await recordSimilar(portfolioId, change.jobId, r.similar);
        if (added > 0) {
          await emitNotification(userId, change.jobId, "new_similar", {
            count: added,
            portfolioId,
            sample: r.similar.slice(0, 3).map((s) => ({ title: s.title, url: s.url })),
          });
          eventsEmitted++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, eventsEmitted });
}

function jobSummary(j: typeof schema.jobs.$inferSelect | undefined) {
  if (!j) return {};
  return {
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.url,
    site: j.site,
  };
}

// silence unused import warning for `eq`
void eq;
