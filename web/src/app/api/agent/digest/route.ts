import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { eq, and, gte, lte, desc, ne, isNull } from "drizzle-orm";

/**
 * GET /api/agent/digest
 * Returns a compact summary the agent uses to compose the morning iMessage.
 * Today's deadlines, soon-expiring deadlines, removed jobs since yesterday, new similar jobs.
 */
export async function GET(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86400_000);
  const yesterday = new Date(now.getTime() - 36 * 3600_000);

  const upcoming = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.userId, userId),
        gte(schema.jobs.deadline, now),
        lte(schema.jobs.deadline, in7d),
        ne(schema.jobs.status, "withdrawn")
      )
    )
    .orderBy(schema.jobs.deadline);

  const recentRemovals = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.userId, userId),
        eq(schema.jobs.status, "removed"),
        gte(schema.jobs.lastFetchedAt, yesterday)
      )
    )
    .limit(20);

  const newSimilar = await db
    .select({
      sj: schema.similarJobs,
      portfolio: schema.portfolios,
    })
    .from(schema.similarJobs)
    .innerJoin(schema.portfolios, eq(schema.portfolios.id, schema.similarJobs.portfolioId))
    .where(
      and(
        eq(schema.portfolios.userId, userId),
        gte(schema.similarJobs.discoveredAt, yesterday),
        isNull(schema.similarJobs.dismissedAt)
      )
    )
    .orderBy(desc(schema.similarJobs.discoveredAt))
    .limit(15);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    upcoming: upcoming.map(slim),
    removed: recentRemovals.map(slim),
    newSimilar: newSimilar.map((r) => ({
      url: r.sj.url,
      title: r.sj.title,
      site: r.sj.site,
      portfolio: r.portfolio.name,
    })),
  });
}

function slim(j: typeof schema.jobs.$inferSelect) {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.url,
    site: j.site,
    deadline: j.deadline?.toISOString() ?? null,
    status: j.status,
  };
}
