"use server";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uploadSchema = z.object({
  text: z.string().trim().min(20).max(40_000),
});

export async function saveResumeAction(formData: FormData) {
  const { userId } = await requireUser();
  const parsed = uploadSchema.parse({ text: formData.get("text") });
  const now = new Date();

  await db
    .insert(schema.resumes)
    .values({
      userId,
      rawText: parsed.text,
      parsed: null,
      parsedAt: null,
      lastUpdatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.resumes.userId,
      set: {
        rawText: parsed.text,
        parsed: null,
        parsedAt: null,
        lastUpdatedAt: now,
      },
    });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function refreshResumeDateAction() {
  const { userId } = await requireUser();
  await db
    .update(schema.resumes)
    .set({ lastUpdatedAt: new Date() })
    .where(eqUserId(userId));
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

import { eq } from "drizzle-orm";
function eqUserId(userId: string) {
  return eq(schema.resumes.userId, userId);
}
