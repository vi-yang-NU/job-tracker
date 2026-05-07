import { Api, type RemoteJob } from "./api";
import { fetchJob, fetchSimilar, detectAdapter } from "@jobtracker/core";
import { fetchHtmlWithBrowser, shutdownBrowser } from "./browser";
import { formatDigest, shortSummary } from "./digest";
import { iMessage, macNotify } from "./notify";
import { loadConfig } from "./config";

const DIGEST_FLAG_HOURS = 22; // send at most one digest per ~day

export async function tick(opts: { sendDigest?: boolean; iMessageTo?: string } = {}) {
  const cfg = loadConfig();
  const api = new Api(cfg);

  const me = await api.me();
  console.log(`[tick] signed in as ${me.email}`);

  const { jobs } = await api.jobs();
  console.log(`[tick] ${jobs.length} jobs to refresh`);

  const results: unknown[] = [];

  for (const job of jobs) {
    const adapter = detectAdapter(job.canonicalUrl);
    const useBrowser = !!adapter.needsBrowser;
    try {
      const fetched = await fetchJob(job.canonicalUrl, {
        fetchHtml: useBrowser ? (u) => fetchHtmlWithBrowser(u) : undefined,
      });
      let similar: Array<{ url: string; site: string; title?: string }> = [];
      if (fetched.ok && fetched.job?.available) {
        similar = await fetchSimilar(job.canonicalUrl, {
          fetchHtml: useBrowser ? (u) => fetchHtmlWithBrowser(u) : undefined,
        });
      }
      results.push(serialize(job, fetched, similar));
    } catch (err) {
      console.error(`[tick] error for ${job.url}:`, (err as Error).message);
      results.push({
        url: job.url,
        canonicalUrl: job.canonicalUrl,
        portfolioIds: job.portfolioIds,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  if (results.length > 0) {
    const ack = await api.postResults(results);
    console.log(`[tick] posted ${results.length} results, ${ack.events.length} events`);
  }

  await shutdownBrowser();

  // Digest: once per day in the morning, or when the user asked explicitly.
  const should = opts.sendDigest ?? shouldSendDigest();
  if (should) {
    await sendDigest(api, opts.iMessageTo);
  }
}

function serialize(
  job: RemoteJob,
  result: Awaited<ReturnType<typeof fetchJob>>,
  similar: Array<{ url: string; site: string; title?: string }>
) {
  return {
    url: job.url,
    canonicalUrl: job.canonicalUrl,
    portfolioIds: job.portfolioIds,
    ok: result.ok,
    httpStatus: result.httpStatus,
    error: result.error,
    job: result.job
      ? {
          ...result.job,
          deadline: result.job.deadline?.toISOString(),
          postedAt: result.job.postedAt?.toISOString(),
        }
      : undefined,
    similar,
  };
}

let lastDigestAt: number | undefined;
function shouldSendDigest(): boolean {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 7 || hour > 11) return false; // 7-11am window
  if (lastDigestAt && Date.now() - lastDigestAt < DIGEST_FLAG_HOURS * 3600_000) return false;
  lastDigestAt = Date.now();
  return true;
}

export async function sendDigest(api: Api, iMessageTo?: string) {
  const d = await api.digest();
  const summary = shortSummary(d);
  if (!summary) {
    console.log("[digest] nothing to report");
    return;
  }
  await macNotify(summary.title, summary.body);
  if (iMessageTo) {
    const ok = await iMessage(formatDigest(d), iMessageTo);
    console.log(`[digest] iMessage to ${iMessageTo}: ${ok ? "sent" : "failed"}`);
  }
}
