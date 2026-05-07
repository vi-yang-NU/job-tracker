import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { and, eq, isNull, asc } from "drizzle-orm";

/**
 * GET /api/agent/inbox
 * Returns notifications the agent hasn't yet delivered. The agent posts to
 * /api/agent/inbox/ack with the IDs once they've been sent.
 */
export async function GET(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(
      and(eq(schema.notifications.userId, userId), isNull(schema.notifications.sentAt))
    )
    .orderBy(asc(schema.notifications.createdAt))
    .limit(100);

  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      jobId: n.jobId,
      payload: n.payload,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
