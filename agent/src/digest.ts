import type { Digest } from "./api";

export function formatDigest(d: Digest): string {
  const lines: string[] = ["📋 Job tracker"];
  if (d.upcoming.length > 0) {
    lines.push("", `Deadlines this week (${d.upcoming.length}):`);
    for (const j of d.upcoming.slice(0, 5)) {
      const when = j.deadline
        ? new Date(j.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "?";
      lines.push(`• ${j.title || j.url} — ${j.company ?? ""} (${when})`);
    }
  }
  if (d.removed.length > 0) {
    lines.push("", `Removed since yesterday (${d.removed.length}):`);
    for (const j of d.removed.slice(0, 3)) {
      lines.push(`• ${j.title || j.url} — ${j.company ?? ""}`);
    }
  }
  if (d.newSimilar.length > 0) {
    lines.push("", `New similar postings (${d.newSimilar.length}):`);
    for (const s of d.newSimilar.slice(0, 5)) {
      lines.push(`• ${s.title || s.url} (${s.portfolio})`);
    }
  }
  if (lines.length === 1) lines.push("Nothing new today. ☕");
  return lines.join("\n");
}

export function shortSummary(d: Digest): { title: string; body: string } | null {
  const total = d.upcoming.length + d.removed.length + d.newSimilar.length;
  if (total === 0) return null;
  const parts: string[] = [];
  if (d.upcoming.length) parts.push(`${d.upcoming.length} deadline${plural(d.upcoming.length)}`);
  if (d.removed.length) parts.push(`${d.removed.length} removed`);
  if (d.newSimilar.length) parts.push(`${d.newSimilar.length} new similar`);
  return {
    title: "Job tracker",
    body: parts.join(" · "),
  };
}

function plural(n: number) {
  return n === 1 ? "" : "s";
}
