"use server";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canonicalize, fetchJob, fetchSimilar, type FetchedJob } from "@jobtracker/core";
import { upsertJobFromFetch, recordSimilar } from "@/lib/persist";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const STATUSES = [
  "active",
  "watching",
  "applied",
  "rejected",
  "offered",
  "withdrawn",
  "removed",
] as const;

export interface JobPreview {
  ok: boolean;
  url: string;
  canonicalUrl: string;
  site: string;
  available: boolean;
  title?: string;
  company?: string;
  location?: string;
  deadline?: string;
  needsBrowserFetch?: boolean;
  error?: string;
}

/**
 * Step 1 of "paste → preview → confirm": fetch the URL statically and return
 * a preview. Nothing is persisted yet.
 */
export async function previewJobAction(url: string): Promise<JobPreview> {
  await requireUser();
  const canonical = canonicalize(url);
  const result = await fetchJob(canonical, { staticOnly: true });
  if (!result.ok || !result.job) {
    return {
      ok: false,
      url: canonical,
      canonicalUrl: canonical,
      site: hostnameOf(canonical),
      available: false,
      needsBrowserFetch: result.error?.includes("browser"),
      error: result.error,
    };
  }
  return {
    ok: true,
    url: result.job.url,
    canonicalUrl: result.job.canonicalUrl,
    site: result.job.site,
    available: result.job.available,
    title: result.job.title,
    company: result.job.company,
    location: result.job.location,
    deadline: result.job.deadline?.toISOString().slice(0, 10),
  };
}

const confirmSchema = z.object({
  url: z.string().url(),
  title: z.string().trim().optional(),
  company: z.string().trim().optional(),
  location: z.string().trim().optional(),
  deadline: z.string().optional(),
  status: z.enum(STATUSES).default("active"),
  targetApplyDate: z.string().optional(),
  notes: z.string().optional(),
});

/** Step 2: persist after the user reviewed (and possibly edited) the preview. */
export async function confirmJobAction(formData: FormData) {
  const { userId } = await requireUser();
  const parsed = confirmSchema.parse({
    url: formData.get("url"),
    title: formData.get("title") || undefined,
    company: formData.get("company") || undefined,
    location: formData.get("location") || undefined,
    deadline: formData.get("deadline") || undefined,
    status: (formData.get("status") as string) || "active",
    targetApplyDate: formData.get("targetApplyDate") || undefined,
    notes: formData.get("notes") || undefined,
  });

  const canonical = canonicalize(parsed.url);
  const result = await fetchJob(canonical, { staticOnly: true });
  const live = result.ok ? result.job : undefined;

  const merged: FetchedJob = {
    url: canonical,
    canonicalUrl: canonical,
    site: live?.site ?? hostnameOf(canonical),
    available: live?.available ?? true,
    title: parsed.title ?? live?.title,
    company: parsed.company ?? live?.company,
    location: parsed.location ?? live?.location,
    deadline: parsed.deadline ? safeDate(parsed.deadline) ?? undefined : live?.deadline,
    isRemote: live?.isRemote,
    postedAt: live?.postedAt,
    contentHash: live?.contentHash,
  };

  const change = await upsertJobFromFetch(
    { userId, url: canonical },
    merged,
    result.httpStatus
  );

  await db
    .update(schema.jobs)
    .set({
      status: parsed.status,
      targetApplyDate: parsed.targetApplyDate ? safeDate(parsed.targetApplyDate) : null,
      notes: parsed.notes || null,
    })
    .where(eq(schema.jobs.id, change.jobId));

  if (live?.available) {
    const sims = await fetchSimilar(canonical, { staticOnly: true });
    if (sims.length > 0) await recordSimilar(userId, change.jobId, sims);
  }

  revalidatePath("/dashboard");
}

const updateSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(STATUSES),
  targetApplyDate: z.string().optional(),
});

export async function updateJobAction(formData: FormData) {
  const { userId } = await requireUser();
  const parsed = updateSchema.parse({
    jobId: formData.get("jobId"),
    status: formData.get("status"),
    targetApplyDate: formData.get("targetApplyDate") ?? undefined,
  });
  await db
    .update(schema.jobs)
    .set({
      status: parsed.status,
      targetApplyDate: parsed.targetApplyDate ? safeDate(parsed.targetApplyDate) : null,
    })
    .where(and(eq(schema.jobs.id, parsed.jobId), eq(schema.jobs.userId, userId)));
  revalidatePath("/dashboard");
}

const removeSchema = z.object({ jobId: z.string().min(1) });

export async function removeJobAction(formData: FormData) {
  const { userId } = await requireUser();
  const parsed = removeSchema.parse({ jobId: formData.get("jobId") });
  await db
    .delete(schema.jobs)
    .where(and(eq(schema.jobs.id, parsed.jobId), eq(schema.jobs.userId, userId)));
  revalidatePath("/dashboard");
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}
