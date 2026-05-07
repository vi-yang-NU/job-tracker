import { detectAdapter } from "./adapters/index.js";
import type { FetchResult, SimilarPosting } from "./types.js";
import { canonicalize } from "./util.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) JobTracker/0.1 Chrome/120.0.0.0 Safari/537.36";

export interface FetchOptions {
  /** If true, skip adapters that require a browser (use this on Vercel). */
  staticOnly?: boolean;
  /** Custom HTML fetcher (e.g., Playwright in the agent). Falls back to global fetch. */
  fetchHtml?: (url: string) => Promise<{ html: string; status: number; finalUrl: string }>;
  signal?: AbortSignal;
}

async function defaultFetchHtml(url: string, signal?: AbortSignal) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal,
  });
  const html = await res.text();
  return { html, status: res.status, finalUrl: res.url || url };
}

export async function fetchJob(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const canonical = canonicalize(url);
  const adapter = detectAdapter(canonical);
  if (opts.staticOnly && adapter.needsBrowser) {
    return { ok: false, error: `adapter ${adapter.name} requires a browser` };
  }
  try {
    const { html, status, finalUrl } = await (opts.fetchHtml
      ? opts.fetchHtml(canonical)
      : defaultFetchHtml(canonical, opts.signal));
    const result = adapter.parse({ url: canonical, html, status, finalUrl });
    if (result.job) result.job.canonicalUrl = canonical;
    return result;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function fetchSimilar(
  jobUrl: string,
  opts: FetchOptions = {}
): Promise<SimilarPosting[]> {
  const adapter = detectAdapter(jobUrl);
  if (!adapter.similarIndexUrl || !adapter.parseSimilar) return [];
  if (opts.staticOnly && adapter.needsBrowser) return [];
  const indexUrl = adapter.similarIndexUrl(jobUrl, undefined);
  if (!indexUrl) return [];
  try {
    const { html, status, finalUrl } = await (opts.fetchHtml
      ? opts.fetchHtml(indexUrl)
      : defaultFetchHtml(indexUrl, opts.signal));
    if (status >= 400) return [];
    return adapter.parseSimilar({ url: indexUrl, html, status, finalUrl });
  } catch {
    return [];
  }
}
