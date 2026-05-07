import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { upsertJobFromFetch, recordSimilar, priorAvailability } from "@/lib/persist";
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

  const events: Array<{ kind: string; jobId?: string; payload: unknown }> = [];

  for (const r of parsed.data.results) {
    if (!r.ok || !r.job) continue;
    for (const portfolioId of r.portfolioIds.length > 0 ? r.portfolioIds : [null]) {
      if (!portfolioId) continue; // Need at least one portfolio
      const fetched = {
        ...r.job,
        deadline: r.job.deadline ? new Date(r.job.deadline) : undefined,
        postedAt: r.job.postedAt ? new Date(r.job.postedAt) : undefined,
      };
      const jobId = await upsertJobFromFetch(
        { userId, portfolioId, url: r.url },
        fetched,
        r.httpStatus
      );
      const wasAvailable = await priorAvailability(jobId);
      if (wasAvailable === true && !fetched.available) {
        events.push({ kind: "job_removed", jobId, payload: { url: r.url } });
      }
      if (r.similar && r.similar.length > 0) {
        const added = await recordSimilar(
          portfolioId,
          jobId,
          r.similar.map((s) => ({ ...s }))
        );
        if (added > 0) {
          events.push({ kind: "new_similar", jobId, payload: { count: added, portfolioId } });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, events });
}
