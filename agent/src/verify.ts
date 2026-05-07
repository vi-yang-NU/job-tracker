import { ollamaJson } from "./ollama.js";
import { topK, type Chunk } from "./rag.js";

export interface SkillVerification {
  skill: string;
  required: boolean;
  covered: boolean;
  confidence: "high" | "medium" | "low";
  quote?: string;
}

const SYSTEM = `You verify whether a candidate has a specific skill, based ONLY on resume excerpts.

Rules:
- "covered" is true only if at least one excerpt clearly demonstrates the skill, including
  closely related work (e.g. building a real-time chat app demonstrates websockets).
- "covered" is false if the excerpts don't directly or indirectly support the skill.
- "quote" is a literal substring (≤ 100 chars) from the most relevant excerpt that backs
  your answer. Empty string if covered=false.
- "confidence": high = explicit match; medium = strongly implied; low = weakly implied.

Return JSON ONLY, no prose, no markdown.`;

/**
 * Verify a single skill against the user's resume chunks. Retrieves top-k
 * chunks by vector similarity and asks the LLM a grounded yes/no.
 */
export async function verifySkill(
  skill: string,
  resumeChunks: Chunk[],
  queryVector: number[],
  required: boolean,
  k = 3
): Promise<SkillVerification> {
  if (resumeChunks.length === 0) {
    return { skill, required, covered: false, confidence: "low" };
  }
  const top = topK(resumeChunks, queryVector, k);
  const numbered = top
    .map((c, i) => `${i + 1}. "${c.text.replace(/"/g, "'").slice(0, 600)}"`)
    .join("\n");

  const prompt = `Skill being checked: "${skill}"

Resume excerpts (most relevant first):
${numbered}`;

  try {
    const result = await ollamaJson<{
      covered?: boolean;
      quote?: string;
      confidence?: "high" | "medium" | "low";
    }>(prompt, { system: SYSTEM, temperature: 0.1 });

    const covered = !!result.covered;
    const quote = covered ? sanitizeQuote(result.quote) : undefined;
    const confidence = ["high", "medium", "low"].includes(result.confidence ?? "")
      ? (result.confidence as "high" | "medium" | "low")
      : "low";
    return { skill, required, covered, confidence, quote };
  } catch (err) {
    console.error(`[verify] '${skill}' failed: ${(err as Error).message}`);
    return { skill, required, covered: false, confidence: "low" };
  }
}

function sanitizeQuote(q: string | undefined): string | undefined {
  if (!q) return undefined;
  const trimmed = q.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (!trimmed) return undefined;
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
}
