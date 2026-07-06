import { Api, type RemoteJob } from "./api.js";
import { fetchJob, fetchSimilar, detectAdapter } from "@jobtracker/core";
import { fetchHtmlWithBrowser, shutdownBrowser } from "./browser.js";
import { fetchHtmlWithScrapy } from "./scrapy.js";
import { formatInbox } from "./digest.js";
import { iMessage, notify } from "./notify.js";
import { loadConfig } from "./config.js";
import { runParseStep } from "./parse-step.js";
import { writeLastTick } from "./state.js";

export async function tick() {
  try {
    await runTick();
  } finally {
    writeLastTick();
  }
}

async function runTick() {
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
      const fetchHtml = useBrowser ? (u: string) => fetchHtmlWithBrowser(u) : fetchHtmlWithScrapy;
      const fetched = await fetchJob(job.canonicalUrl, {
        fetchHtml,
      });
      let similar: Array<{ url: string; site: string; title?: string }> = [];
      if (fetched.ok && fetched.job?.available) {
        similar = await fetchSimilar(job.canonicalUrl, {
          fetchHtml,
        });
      }
      results.push(serialize(job, fetched, similar));
    } catch (err) {
      console.error(`[tick] error for ${job.url}:`, (err as Error).message);
      results.push({
        url: job.url,
        canonicalUrl: job.canonicalUrl,
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

  // Local LLM step: parse resume + job requirements + eligibility via Ollama.
  await runParseStep(api).catch((err) => {
    console.error(`[tick] parse step failed: ${(err as Error).message}`);
  });

  // Drain the inbox: only deliver if there's something new since last tick.
  const inbox = await api.inbox();
  if (inbox.notifications.length === 0) {
    console.log("[tick] inbox empty — staying silent");
    return;
  }

  const formatted = formatInbox(inbox.notifications);
  if (!formatted) return;

  console.log(`[tick] delivering ${inbox.notifications.length} notifications`);
  await notify(formatted.short.title, formatted.short.body);
  let via: "macos_notification" | "imessage" = "macos_notification";
  if (iMessageTo) {
    const r = await iMessage(formatted.full, iMessageTo);
    if (r.ok) {
      via = "imessage";
      console.log(`[tick] iMessage to ${iMessageTo}: sent`);
    } else {
      console.log(`[tick] iMessage to ${iMessageTo}: failed (${r.reason})`);
    }
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
