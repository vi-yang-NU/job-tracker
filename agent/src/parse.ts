import { ollamaJson } from "./ollama.js";

export type Education = "highschool" | "associate" | "bachelor" | "master" | "phd";

export interface ParsedResume {
  yoe: number;
  education: Education | null;
  skills: string[];
  currentRole: string | null;
  industries: string[];
}

export interface ParsedRequirements {
  yoeMin: number;
  yoeMax: number | null;
  educationRequired: Education | null;
  skillsRequired: string[];
  skillsNice: string[];
}

const RESUME_SYSTEM = `You extract structured data from resumes.
You ONLY return valid JSON. No prose, no comments, no markdown.
Fields:
- yoe: number — total years of professional work experience (decimals OK).
- education: one of highschool|associate|bachelor|master|phd, or null if unclear.
- skills: array of lowercase, deduplicated technology / domain keywords (max 30).
- currentRole: most recent job title, or null.
- industries: array of broad industries / domains the person has worked in.`;

const REQUIREMENTS_SYSTEM = `You extract requirements from a job posting.
You ONLY return valid JSON. No prose, no comments, no markdown.
Fields:
- yoeMin: number — minimum years of experience required, 0 if not stated.
- yoeMax: number or null — explicit upper bound only if stated.
- educationRequired: one of highschool|associate|bachelor|master|phd, or null if unclear.
- skillsRequired: lowercase keywords for must-have skills.
- skillsNice: lowercase keywords for preferred / "bonus" skills.

Read carefully — distinguish "required" vs "preferred / nice to have / plus / bonus".`;

export async function parseResume(text: string): Promise<ParsedResume> {
  const trimmed = text.length > 12_000 ? text.slice(0, 12_000) : text;
  const result = await ollamaJson<Partial<ParsedResume>>(`Resume:\n"""\n${trimmed}\n"""`, {
    system: RESUME_SYSTEM,
  });
  return {
    yoe: numberOrZero(result.yoe),
    education: validEducation(result.education ?? null),
    skills: arrayOfStrings(result.skills).map((s) => s.toLowerCase()).slice(0, 30),
    currentRole: stringOrNull(result.currentRole),
    industries: arrayOfStrings(result.industries).slice(0, 10),
  };
}

export async function parseRequirements(
  jobText: string
): Promise<ParsedRequirements> {
  const trimmed = jobText.length > 12_000 ? jobText.slice(0, 12_000) : jobText;
  const result = await ollamaJson<Partial<ParsedRequirements>>(
    `Job posting:\n"""\n${trimmed}\n"""`,
    { system: REQUIREMENTS_SYSTEM }
  );
  return {
    yoeMin: numberOrZero(result.yoeMin),
    yoeMax:
      typeof result.yoeMax === "number" && !Number.isNaN(result.yoeMax)
        ? result.yoeMax
        : null,
    educationRequired: validEducation(result.educationRequired ?? null),
    skillsRequired: arrayOfStrings(result.skillsRequired).map((s) => s.toLowerCase()),
    skillsNice: arrayOfStrings(result.skillsNice).map((s) => s.toLowerCase()),
  };
}

// ---- Eligibility ---------------------------------------------------------

const EDU_LEVEL: Record<Education, number> = {
  highschool: 0,
  associate: 1,
  bachelor: 2,
  master: 3,
  phd: 4,
};

export type EligibilityStatus = "ready" | "stretch" | "future" | "unknown";

export interface EligibilityResult {
  status: EligibilityStatus;
  gaps?: {
    missingYoe?: number;
    missingSkills?: string[];
    missingEducation?: Education;
    reason?: string;
  };
  unlockAt?: Date;
}

export interface SkillCheck {
  skill: string;
  required: boolean;
  covered: boolean;
}

/**
 * Compute eligibility from parsed structures + per-skill RAG verifications.
 *
 * Status definitions:
 *  - ready:   YoE + edu + every required skill verified
 *  - stretch: YoE + edu clear, some required skills missing — user can craft
 *  - future:  YoE gap (closes with time). unlockAt = today + (gap years)
 *  - unknown: missing data we need to score
 */
export function evaluateEligibility(
  resume: ParsedResume,
  reqs: ParsedRequirements,
  effectiveYoe: number,
  skillChecks?: SkillCheck[]
): EligibilityResult {
  const yoeOk = effectiveYoe >= reqs.yoeMin;
  const eduOk =
    !reqs.educationRequired ||
    !resume.education ||
    EDU_LEVEL[resume.education] >= EDU_LEVEL[reqs.educationRequired];

  // Prefer RAG-verified skill coverage; fall back to keyword matching when
  // no verifications were supplied (e.g. embeddings unavailable).
  let missingSkills: string[];
  if (skillChecks && skillChecks.length > 0) {
    missingSkills = skillChecks
      .filter((c) => c.required && !c.covered)
      .map((c) => c.skill);
  } else {
    const haveSkills = new Set(resume.skills.map((s) => s.toLowerCase()));
    missingSkills = reqs.skillsRequired.filter((s) => !skillCovered(s, haveSkills));
  }
  const skillsOk = missingSkills.length === 0;

  if (yoeOk && eduOk && skillsOk) {
    return { status: "ready" };
  }

  if (!yoeOk) {
    const gap = Math.max(0, reqs.yoeMin - effectiveYoe);
    const unlockAt = new Date(Date.now() + gap * 365 * 86400_000);
    return {
      status: "future",
      unlockAt,
      gaps: {
        missingYoe: round(gap, 1),
        missingSkills: missingSkills.length > 0 ? missingSkills : undefined,
        missingEducation: !eduOk ? reqs.educationRequired ?? undefined : undefined,
      },
    };
  }

  // YoE clears, education or skills don't — stretch.
  return {
    status: "stretch",
    gaps: {
      missingSkills: missingSkills.length > 0 ? missingSkills : undefined,
      missingEducation: !eduOk ? reqs.educationRequired ?? undefined : undefined,
      reason: !eduOk
        ? "Education requirement not met"
        : `${missingSkills.length} skill${missingSkills.length === 1 ? "" : "s"} missing — consider tailoring`,
    },
  };
}

/**
 * Match a required skill to the user's skills, allowing "stretch" matches —
 * e.g. "full-stack" covered by ("backend" + "frontend"), "react" by "reactjs".
 */
function skillCovered(req: string, have: Set<string>): boolean {
  const r = req.toLowerCase();
  if (have.has(r)) return true;
  // simple alias-bridge — extend as needed
  const aliases: Record<string, string[]> = {
    "full-stack": ["frontend", "backend"],
    fullstack: ["frontend", "backend"],
    js: ["javascript"],
    ts: ["typescript"],
    react: ["reactjs", "react.js"],
    node: ["nodejs", "node.js"],
    aws: ["amazon web services"],
    gcp: ["google cloud"],
  };
  if (aliases[r]?.every((bridge) => have.has(bridge))) return true;
  // substring fallback (loose)
  for (const h of have) {
    if (h.includes(r) || r.includes(h)) return true;
  }
  return false;
}

function numberOrZero(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}
function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function arrayOfStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function validEducation(v: unknown): Education | null {
  if (typeof v !== "string") return null;
  return v in EDU_LEVEL ? (v as Education) : null;
}
function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
