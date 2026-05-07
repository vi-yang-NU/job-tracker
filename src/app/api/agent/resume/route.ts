import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db } from "@/lib/db";

/** GET /api/agent/resume — current parsed resume snapshot for scoring. */
export async function GET(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const resume = await db.query.resumes.findFirst({
    where: (r, { eq }) => eq(r.userId, userId),
  });
  if (!resume?.parsed) return NextResponse.json({ resume: null });

  // effectiveYoe = parsed yoe + (now - lastUpdatedAt) in years
  const ms = Date.now() - resume.lastUpdatedAt.getTime();
  const elapsedYears = ms / (365 * 86400_000);
  const effectiveYoe = (resume.parsed.yoe ?? 0) + Math.max(0, elapsedYears);

  return NextResponse.json({
    resume: {
      ...resume.parsed,
      lastUpdatedAt: resume.lastUpdatedAt.toISOString(),
      effectiveYoe,
    },
  });
}
