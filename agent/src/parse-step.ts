import type { Api } from "./api.js";
import { ollamaInfo } from "./ollama.js";
import {
  parseResume,
  parseRequirements,
  evaluateEligibility,
  type ParsedResume,
  type ParsedRequirements,
  type Education,
  type SkillCheck,
} from "./parse.js";
import { chunkAndEmbed, embed, type Chunk } from "./rag.js";
import { verifySkill, type SkillVerification } from "./verify.js";

/**
 * One iteration of the LLM step: pulls the parse queue, runs Ollama for
 * structure extraction + RAG-grounded skill verification, posts results.
 *
 * Skips silently when Ollama isn't reachable (the queue persists).
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

  // We need access to the user's resume *text* (not just the parsed snapshot)
  // to build chunks for RAG. parseQueue returns it only when it needs parsing;
  // we cache locally if we fetched it, otherwise we still try to score with
  // keyword fallback.
  let parsedResume: ParsedResume | null = null;
  let resumeChunks: Chunk[] | null = null;

  if (queue.resume) {
    try {
      const r = await parseResume(queue.resume.rawText);
      parsedResume = r;
      await api.postParsedResume({
        yoe: r.yoe,
        education: r.education,
        skills: r.skills,
        currentRole: r.currentRole,
        industries: r.industries,
      });
      console.log(`[parse] resume parsed: yoe=${r.yoe}, ${r.skills.length} skills`);

      // Build RAG chunks from the same raw text. ~2-3s for a typical resume.
      try {
        resumeChunks = await chunkAndEmbed(queue.resume.rawText);
        console.log(`[parse] resume embedded into ${resumeChunks.length} chunks`);
      } catch (err) {
        console.error(
          `[parse] resume embedding failed (skill checks will fall back to keyword match): ${
            (err as Error).message
          }`
        );
      }
    } catch (err) {
      console.error(`[parse] resume parse failed: ${(err as Error).message}`);
      return;
    }
  }

  if (queue.jobs.length === 0) return;

  // Pull the parsed snapshot from the server (so we get effectiveYoe even when
  // the resume wasn't in this tick's queue).
  const { resume: serverResume } = await api.parsedResume();
  if (!serverResume) {
    console.log("[parse] no parsed resume yet; will score on a later tick");
    return;
  }

  const resumeForScoring: ParsedResume = parsedResume ?? {
    yoe: serverResume.yoe,
    education: serverResume.education as Education | null,
    skills: serverResume.skills,
    currentRole: serverResume.currentRole,
    industries: serverResume.industries,
  };

  // If we don't have local chunks (resume wasn't in this tick's queue), we
  // skip RAG verification this run. The next time the user updates their
  // resume on the website, the queue will include the raw text again and
  // verification rebuilds.
  const ragAvailable = !!resumeChunks && resumeChunks.length > 0;
  if (!ragAvailable) {
    console.log(
      "[parse] no resume chunks in this tick — skipping RAG; falling back to keyword matching"
    );
  }

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

    let verifications: SkillVerification[] = [];
    if (ragAvailable && resumeChunks) {
      verifications = await runSkillVerifications(reqs, resumeChunks);
    }

    const skillChecks: SkillCheck[] = verifications.map((v) => ({
      skill: v.skill,
      required: v.required,
      covered: v.covered,
    }));

    const eligibility = evaluateEligibility(
      resumeForScoring,
      reqs,
      serverResume.effectiveYoe,
      skillChecks.length > 0 ? skillChecks : undefined
    );

    items.push({
      jobId: job.id,
      requirements: reqs,
      eligibility: {
        status: eligibility.status,
        gaps: eligibility.gaps,
        unlockAt: eligibility.unlockAt?.toISOString() ?? null,
        evidence: verifications.map((v) => ({
          skill: v.skill,
          covered: v.covered,
          confidence: v.confidence,
          quote: v.quote,
          required: v.required,
        })),
      },
    });
  }

  if (items.length > 0) {
    const ack = await api.postParsedJobs(items);
    console.log(`[parse] posted ${items.length} parsed jobs (${ack.unlockedNow} unlocked)`);
  }
}

/**
 * For each required + nice-to-have skill, embed the skill phrase and ask the
 * LLM (grounded on top-k resume chunks) whether the candidate has it.
 *
 * Sequential to avoid hammering Ollama; typical job has ≤ 8-10 required skills.
 */
async function runSkillVerifications(
  reqs: ParsedRequirements,
  resumeChunks: Chunk[]
): Promise<SkillVerification[]> {
  const results: SkillVerification[] = [];
  // Cap to keep tick budget bounded.
  const required = reqs.skillsRequired.slice(0, 12);
  const nice = reqs.skillsNice.slice(0, 6);

  for (const skill of required) {
    try {
      const queryVec = await embed(`Does the candidate have experience with: ${skill}`);
      const v = await verifySkill(skill, resumeChunks, queryVec, true);
      results.push(v);
    } catch (err) {
      console.error(`[parse] verify '${skill}' threw: ${(err as Error).message}`);
      results.push({ skill, required: true, covered: false, confidence: "low" });
    }
  }
  for (const skill of nice) {
    try {
      const queryVec = await embed(`Does the candidate have experience with: ${skill}`);
      const v = await verifySkill(skill, resumeChunks, queryVec, false);
      results.push(v);
    } catch {
      // nice-to-haves are best-effort
    }
  }
  return results;
}
