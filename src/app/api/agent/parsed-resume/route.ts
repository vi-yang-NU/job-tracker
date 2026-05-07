import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schemaIn = z.object({
  yoe: z.number(),
  education: z.enum(["highschool", "associate", "bachelor", "master", "phd"]).nullable(),
  skills: z.array(z.string()),
  currentRole: z.string().nullable(),
  industries: z.array(z.string()),
});

export async function POST(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schemaIn.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  await db
    .update(schema.resumes)
    .set({
      parsed: {
        yoe: parsed.data.yoe,
        education: parsed.data.education ?? undefined,
        skills: parsed.data.skills,
        currentRole: parsed.data.currentRole,
        industries: parsed.data.industries,
      },
      parsedAt: new Date(),
    })
    .where(eq(schema.resumes.userId, userId));

  return NextResponse.json({ ok: true });
}
