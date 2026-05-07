"use server";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canonicalize, fetchJob, fetchSimilar } from "@jobtracker/core";
import { upsertJobFromFetch, recordSimilar } from "@/lib/persist";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addSchema = z.object({
  portfolioId: z.string().min(1),
  url: z.string().url(),
});

export async function addJobAction(formData: FormData) {
  const { userId } = await requireUser();
  const { portfolioId, url } = addSchema.parse({
    portfolioId: formData.get("portfolioId"),
    url: formData.get("url"),
  });

  const portfolio = await db.query.portfolios.findFirst({
    where: (p, { and, eq }) => and(eq(p.id, portfolioId), eq(p.userId, userId)),
  });
  if (!portfolio) throw new Error("portfolio not found");

  const canonical = canonicalize(url);
  // Try a static fetch immediately so the user sees title/company without waiting.
  const result = await fetchJob(canonical, { staticOnly: true });
  if (result.ok && result.job) {
    await upsertJobFromFetch(
      { userId, portfolioId, url: canonical },
      result.job,
      result.httpStatus
    );
    // Best-effort similar discovery
    const sims = await fetchSimilar(canonical, { staticOnly: true });
    if (sims.length > 0) {
      await recordSimilar(portfolioId, null, sims);
    }
  } else {
    // Insert a placeholder so the agent can pick it up later for browser fetching
    await db
      .insert(schema.jobs)
      .values({
        userId,
        url: canonical,
        canonicalUrl: canonical,
        site: new URL(canonical).hostname,
        status: "active",
      })
      .onConflictDoNothing()
      .returning({ id: schema.jobs.id });
    const placeholder = await db.query.jobs.findFirst({
      where: (j, { and, eq }) => and(eq(j.userId, userId), eq(j.canonicalUrl, canonical)),
    });
    if (placeholder) {
      await db
        .insert(schema.portfolioJobs)
        .values({ portfolioId, jobId: placeholder.id })
        .onConflictDoNothing();
    }
  }
  revalidatePath(`/p/${portfolioId}`);
}

const removeSchema = z.object({
  portfolioId: z.string().min(1),
  jobId: z.string().min(1),
});

export async function removeJobAction(formData: FormData) {
  const { userId } = await requireUser();
  const { portfolioId, jobId } = removeSchema.parse({
    portfolioId: formData.get("portfolioId"),
    jobId: formData.get("jobId"),
  });
  const owns = await db.query.portfolios.findFirst({
    where: (p, { and, eq }) => and(eq(p.id, portfolioId), eq(p.userId, userId)),
  });
  if (!owns) throw new Error("portfolio not found");
  await db
    .delete(schema.portfolioJobs)
    .where(
      and(
        eq(schema.portfolioJobs.portfolioId, portfolioId),
        eq(schema.portfolioJobs.jobId, jobId)
      )
    );
  revalidatePath(`/p/${portfolioId}`);
}
