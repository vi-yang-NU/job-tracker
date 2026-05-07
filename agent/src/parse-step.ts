import type { Api } from "./api.js";
import { ollamaInfo } from "./ollama.js";
import {
  parseResume,
  parseRequirements,
  evaluateEligibility,
  type ParsedResume,
  type ParsedRequirements,
  type Education,
} from "./parse.js";

/**
 * Pulls the parse queue, runs Ollama on whatever's there, posts results.
 * Idempotent — safe to call from each tick. Skips silently when Ollama isn't
 * reachable (the queue persists for the next tick).
 */
export async function runParseStep(api: Api): Promise<void> {
  const queue = await api.parseQueue();
  const hasWork = !!queue.resume || queue.jobs.length > 0;
  if (!hasWork) {
    console.log("[parse] nothing to parse");
    return;
  }

  const info = await ollamaInfo();
  if (!info.available) {
    console.log(
      `[parse] Ollama unavailable (${info.reason ?? "unknown"}). Skipping; queue retained.`
    );
    return;
  }
  console.log(`[parse] using Ollama at ${info.base}, model ${info.selected}`);
  if (info.reason) console.log(`[parse] note: ${info.reason}`);

  // Parse resume first if it's queued.
  if (queue.resume) {
    try {
      const r = await parseResume(queue.resume.rawText);
      await api.postParsedResume({
        yoe: r.yoe,
        education: r.education,
        skills: r.skills,
        currentRole: r.currentRole,
        industries: r.industries,
      });
      console.log(`[parse] resume parsed: yoe=${r.yoe}, ${r.skills.length} skills`);
    } catch (err) {
      console.error(`[parse] resume parse failed: ${(err as Error).message}`);
      return; // can't score without a resume
    }
  }

  if (queue.jobs.length === 0) return;

  // Pull whatever resume the server has now (could be the one we just parsed).
  const { resume: parsedResume } = await api.parsedResume();
  if (!parsedResume) {
    console.log("[parse] no parsed resume available; will score on a later tick");
    return;
  }

  const resumeForScoring: ParsedResume = {
    yoe: parsedResume.yoe,
    education: parsedResume.education as Education | null,
    skills: parsedResume.skills,
    currentRole: parsedResume.currentRole,
    industries: parsedResume.industries,
  };

  const items: unknown[] = [];
  for (const job of queue.jobs) {
    if (!job.description) continue;
    let reqs: ParsedRequirements;
    try {
      reqs = await parseRequirements(`${job.title ?? ""}\n\n${job.description}`);
    } catch (err) {
      console.error(`[parse] req parse failed for ${job.url}: ${(err as Error).message}`);
      continue;
    }
    const eligibility = evaluateEligibility(
      resumeForScoring,
      reqs,
      parsedResume.effectiveYoe
    );
    items.push({
      jobId: job.id,
      requirements: reqs,
      eligibility: {
        status: eligibility.status,
        gaps: eligibility.gaps,
        unlockAt: eligibility.unlockAt?.toISOString() ?? null,
      },
    });
  }

  if (items.length > 0) {
    const ack = await api.postParsedJobs(items);
    console.log(`[parse] posted ${items.length} parsed jobs (${ack.unlockedNow} unlocked)`);
  }
}
