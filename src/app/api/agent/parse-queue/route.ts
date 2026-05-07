import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { and, eq, isNull, isNotNull, ne } from "drizzle-orm";

/**
 * GET /api/agent/parse-queue
 * Returns work items the local agent should run through Ollama:
 *   - resume.needsParsing: true if the user uploaded resume text not yet parsed
 *   - jobs[]: jobs with a description but no parsed requirements yet
 */
export async function GET(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const resume = await db.query.resumes.findFirst({
    where: (r, { eq }) => eq(r.userId, userId),
  });
  const resumeNeedsParsing = !!(
    resume?.rawText && (!resume.parsedAt || resume.parsedAt < resume.lastUpdatedAt)
  );

  const jobs = await db
    .select({
      id: schema.jobs.id,
      url: schema.jobs.url,
      title: schema.jobs.title,
      description: schema.jobs.description,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.userId, userId),
        ne(schema.jobs.status, "withdrawn"),
        isNotNull(schema.jobs.description),
        isNull(schema.jobs.requirementsParsedAt)
      )
    )
    .limit(20);

  return NextResponse.json({
    resume: resumeNeedsParsing
      ? {
          rawText: resume!.rawText,
          lastUpdatedAt: resume!.lastUpdatedAt.toISOString(),
        }
      : null,
    jobs,
  });
}
