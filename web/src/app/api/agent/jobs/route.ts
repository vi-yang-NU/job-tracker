import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { eq, and, ne } from "drizzle-orm";

/**
 * GET /api/agent/jobs
 * Returns all jobs the agent should fetch on this user's behalf, with portfolio
 * memberships so the agent can attribute snapshots correctly.
 */
export async function GET(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const jobs = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.userId, userId), ne(schema.jobs.status, "withdrawn")));

  const memberships = await db
    .select({
      jobId: schema.portfolioJobs.jobId,
      portfolioId: schema.portfolioJobs.portfolioId,
    })
    .from(schema.portfolioJobs)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.portfolioJobs.jobId))
    .where(eq(schema.jobs.userId, userId));

  const byJob = new Map<string, string[]>();
  for (const m of memberships) {
    const arr = byJob.get(m.jobId) ?? [];
    arr.push(m.portfolioId);
    byJob.set(m.jobId, arr);
  }

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      url: j.url,
      canonicalUrl: j.canonicalUrl,
      site: j.site,
      status: j.status,
      lastFetchedAt: j.lastFetchedAt,
      portfolioIds: byJob.get(j.id) ?? [],
    })),
  });
}
