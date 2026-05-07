import { NextResponse } from "next/server";
import { bearerFromHeader, userIdForAgentToken } from "@/lib/agent-auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { emitNotification } from "@/lib/persist";
import { z } from "zod";

const educationEnum = z.enum([
  "highschool",
  "associate",
  "bachelor",
  "master",
  "phd",
]);

const itemSchema = z.object({
  jobId: z.string().min(1),
  requirements: z.object({
    yoeMin: z.number(),
    yoeMax: z.number().nullable(),
    educationRequired: educationEnum.nullable(),
    skillsRequired: z.array(z.string()),
    skillsNice: z.array(z.string()),
  }),
  eligibility: z.object({
    status: z.enum(["ready", "stretch", "future", "unknown"]),
    gaps: z
      .object({
        missingYoe: z.number().optional(),
        missingSkills: z.array(z.string()).optional(),
        missingEducation: educationEnum.optional(),
        reason: z.string().optional(),
      })
      .optional(),
    unlockAt: z.string().datetime().nullable().optional(),
  }),
});

const bodySchema = z.object({ items: z.array(itemSchema) });

export async function POST(req: Request) {
  const userId = await userIdForAgentToken(bearerFromHeader(req.headers.get("authorization")));
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }

  const now = new Date();
  let unlockedNow = 0;

  for (const item of parsed.data.items) {
    // Confirm the job belongs to this user.
    const job = await db.query.jobs.findFirst({
      where: (j, { and, eq }) => and(eq(j.id, item.jobId), eq(j.userId, userId)),
    });
    if (!job) continue;

    await db
      .update(schema.jobs)
      .set({
        requirements: {
          yoeMin: item.requirements.yoeMin,
          yoeMax: item.requirements.yoeMax ?? undefined,
          education: item.requirements.educationRequired ?? undefined,
          skillsRequired: item.requirements.skillsRequired,
          skillsNice: item.requirements.skillsNice,
        },
        requirementsParsedAt: now,
      })
      .where(eq(schema.jobs.id, item.jobId));

    // Was this job previously locked (future) and now ready? If so, fire a
    // notification — this is the "unlocking" signal.
    const prior = await db.query.eligibility.findFirst({
      where: (e, { and, eq }) => and(eq(e.userId, userId), eq(e.jobId, item.jobId)),
    });
    const becomingReady =
      prior?.status === "future" && item.eligibility.status === "ready";
    if (becomingReady) {
      await emitNotification(userId, item.jobId, "job_unlocked", {
        title: job.title,
        company: job.company,
        url: job.url,
      });
      unlockedNow++;
    }

    await db
      .insert(schema.eligibility)
      .values({
        userId,
        jobId: item.jobId,
        status: item.eligibility.status,
        gaps: item.eligibility.gaps ?? null,
        unlockAt: item.eligibility.unlockAt ? new Date(item.eligibility.unlockAt) : null,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.eligibility.userId, schema.eligibility.jobId],
        set: {
          status: item.eligibility.status,
          gaps: item.eligibility.gaps ?? null,
          unlockAt: item.eligibility.unlockAt ? new Date(item.eligibility.unlockAt) : null,
          computedAt: now,
        },
      });
  }

  // silence unused import
  void and;

  return NextResponse.json({ ok: true, unlockedNow });
}
