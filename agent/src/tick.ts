import { Api, type RemoteJob } from "./api";
import { fetchJob, fetchSimilar, detectAdapter } from "@jobtracker/core";
import { fetchHtmlWithBrowser, shutdownBrowser } from "./browser";
import { formatInbox } from "./digest";
import { iMessage, macNotify } from "./notify";
import { loadConfig } from "./config";

export async function tick() {
  const cfg = loadConfig();
  const api = new Api(cfg);
  const iMessageTo = process.env.JOBTRACKER_IMESSAGE_TO;

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
    console.log(`[tick] posted ${results.length} results, ${ack.eventsEmitted} events emitted`);
  }

  await shutdownBrowser();

  // Drain the inbox: only deliver if there's something new since last tick.
  const inbox = await api.inbox();
  if (inbox.notifications.length === 0) {
    console.log("[tick] inbox empty — staying silent");
    return;
  }

  const formatted = formatInbox(inbox.notifications);
  if (!formatted) return;

  console.log(`[tick] delivering ${inbox.notifications.length} notifications`);
  await macNotify(formatted.short.title, formatted.short.body);
  let via: "macos_notification" | "imessage" = "macos_notification";
  if (iMessageTo) {
    const ok = await iMessage(formatted.full, iMessageTo);
    if (ok) via = "imessage";
    console.log(`[tick] iMessage to ${iMessageTo}: ${ok ? "sent" : "failed"}`);
  }
  await api.ackInbox(
    inbox.notifications.map((n) => n.id),
    via
  );
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
