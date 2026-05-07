import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { and, eq, ne } from "drizzle-orm";

/** GET /api/agent/jobs — every job the agent should refresh for this user. */
export async function GET(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const jobs = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.userId, userId), ne(schema.jobs.status, "withdrawn")));

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      url: j.url,
      canonicalUrl: j.canonicalUrl,
      site: j.site,
      status: j.status,
      lastFetchedAt: j.lastFetchedAt,
    })),
  });
}
