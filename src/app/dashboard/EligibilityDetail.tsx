"use client";

import { useState } from "react";

export interface Evidence {
  skill: string;
  required: boolean;
  covered: boolean;
  confidence: "high" | "medium" | "low";
  quote?: string;
}

interface Props {
  status: "ready" | "stretch" | "future" | "unknown";
  evidence: Evidence[] | null;
  gaps: {
    missingYoe?: number;
    missingSkills?: string[];
    missingEducation?: string;
    reason?: string;
  } | null;
  unlockAt: Date | null;
  label: string;
}

export default function EligibilityDetail({
  status,
  evidence,
  gaps,
  unlockAt,
  label,
}: Props) {
  const [open, setOpen] = useState(false);

  // No evidence and no gaps → just show a static pill, no toggle.
  const hasDetail = (evidence && evidence.length > 0) || !!gaps;

  const tone =
    status === "ready"
      ? "bg-emerald-200 text-emerald-900 hover:bg-emerald-300"
      : status === "stretch"
        ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
        : status === "future"
          ? "bg-violet-100 text-violet-900 hover:bg-violet-200"
          : "bg-black/10 text-black/60";

  if (!hasDetail) {
    return <span className={`pill ${tone}`}>{label}</span>;
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pill cursor-pointer ${tone} transition-all duration-150`}
        aria-expanded={open}
      >
        {label} {open ? "▴" : "▾"}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg border border-black/10 bg-white p-3 text-xs text-black/80 shadow-[var(--shadow-lift)]">
          {gaps?.missingYoe ? (
            <div className="mb-2 rounded bg-violet-50 px-2 py-1 text-violet-900">
              ◑ Need ~{gaps.missingYoe.toFixed(1)} more years of experience
              {unlockAt
                ? ` (unlocks ${unlockAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                  })})`
                : ""}
            </div>
          ) : null}
          {gaps?.missingEducation ? (
            <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-amber-900">
              Education required: <strong>{gaps.missingEducation}</strong>
            </div>
          ) : null}

          {evidence && evidence.length > 0 ? (
            <ul className="divide-y divide-black/5">
              {evidence.map((e, i) => (
                <li key={i} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      <span
                        className={
                          e.covered
                            ? "text-emerald-700"
                            : e.required
                              ? "text-rose-700"
                              : "text-black/40"
                        }
                      >
                        {e.covered ? "✓" : e.required ? "✗" : "○"}
                      </span>{" "}
                      {e.skill}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-black/40">
                      {e.required ? "required" : "nice"} · {e.confidence}
                    </span>
                  </div>
                  {e.quote ? (
                    <blockquote className="mt-0.5 border-l-2 border-emerald-200 pl-2 italic text-black/60">
                      "{e.quote}"
                    </blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {(!evidence || evidence.length === 0) && !gaps?.missingEducation && !gaps?.missingYoe ? (
            <div className="text-black/50">No detail available.</div>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
