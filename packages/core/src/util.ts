import { createHash } from "node:crypto";

export function hashContent(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Strip HTML tags and collapse whitespace. JSON-LD JobPosting `description`
 * fields commonly contain raw HTML — we want plain text for LLM parsing.
 */
export function stripHtml(html: string | undefined | null): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || undefined;
}

export function tryParseDate(s: string | undefined | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function looksRemote(loc: string | undefined): boolean {
  if (!loc) return false;
  return /\bremote\b|anywhere|distributed|wfh/i.test(loc);
}

export function canonicalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // Strip common tracking params
    const drop = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gh_src",
      "gh_jid",
      "ref",
      "source",
    ];
    for (const k of drop) u.searchParams.delete(k);
    // Drop trailing slash on path (but not on root)
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}
