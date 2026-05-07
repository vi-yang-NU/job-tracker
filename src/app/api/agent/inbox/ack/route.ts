import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const ackSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  via: z.enum(["macos_notification", "imessage", "stdout"]).default("macos_notification"),
});

export async function POST(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  await db
    .update(schema.notifications)
    .set({ sentAt: new Date(), deliveredVia: parsed.data.via })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        inArray(schema.notifications.id, parsed.data.ids)
      )
    );

  return NextResponse.json({ ok: true, count: parsed.data.ids.length });
}
