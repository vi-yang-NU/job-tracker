import type { InboxItem } from "./api";

export interface FormattedNotifications {
  /** Long-form for iMessage. */
  full: string;
  /** Short for the macOS banner ({title, body}). */
  short: { title: string; body: string };
}

const HEADERS: Record<InboxItem["kind"], string> = {
  job_opened: "🟢 Now accepting applications",
  job_removed: "🔴 Posting removed",
  deadline_set: "⏳ Deadline announced",
  deadline_soon: "⏰ Deadline soon",
  new_similar: "✨ Similar postings",
  fetch_failed: "⚠️ Fetch failed",
};

export function formatInbox(items: InboxItem[]): FormattedNotifications | null {
  if (items.length === 0) return null;

  const buckets = new Map<InboxItem["kind"], InboxItem[]>();
  for (const it of items) {
    const arr = buckets.get(it.kind) ?? [];
    arr.push(it);
    buckets.set(it.kind, arr);
  }

  const lines: string[] = ["📋 Job tracker"];
  for (const [kind, group] of buckets) {
    lines.push("", `${HEADERS[kind] ?? kind} (${group.length})`);
    for (const n of group.slice(0, 6)) {
      lines.push(`• ${describe(n)}`);
    }
    if (group.length > 6) lines.push(`  …and ${group.length - 6} more`);
  }

  const summaryParts: string[] = [];
  for (const [kind, group] of buckets) {
    const noun =
      kind === "job_opened"
        ? "opened"
        : kind === "job_removed"
          ? "removed"
          : kind === "deadline_set"
            ? "deadline added"
            : kind === "deadline_soon"
              ? "deadline soon"
              : kind === "new_similar"
                ? "new similar"
                : kind;
    summaryParts.push(`${group.length} ${noun}`);
  }

  return {
    full: lines.join("\n"),
    short: { title: "Job tracker", body: summaryParts.join(" · ") },
  };
}

function describe(n: InboxItem): string {
  const p = n.payload as { title?: string; company?: string; url?: string; deadline?: string; count?: number };
  const t = p.title || p.url || "(untitled)";
  const company = p.company ? ` — ${p.company}` : "";
  switch (n.kind) {
    case "deadline_set":
      return `${t}${company} (${p.deadline?.slice(0, 10) ?? ""})`;
    case "deadline_soon":
      return `${t}${company} — due ${p.deadline?.slice(0, 10) ?? ""}`;
    case "new_similar":
      return `${p.count ?? 1} new at ${company.slice(3) || "tracked company"}`;
    default:
      return `${t}${company}`;
  }
}
