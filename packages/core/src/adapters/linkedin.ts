import * as cheerio from "cheerio";
import type { SiteAdapter, FetchResult } from "../types.js";
import { hashContent, looksRemote, tryParseDate } from "../util.js";

const RE = /^https?:\/\/(?:www\.)?linkedin\.com\/jobs\/view\/(\d+)/i;

/**
 * LinkedIn job detail. The public page is JS-heavy, but the OEmbed/SSR HTML
 * usually contains JobPosting JSON-LD. Marked needsBrowser so the agent runs
 * it in Playwright; the Vercel cron skips it.
 */
export const linkedin: SiteAdapter = {
  name: "linkedin",
  needsBrowser: true,
  matches(url) {
    return RE.test(url);
  },
  parse({ url, html, status }): FetchResult {
    if (status === 410 || status === 404) {
      return { ok: true, httpStatus: status, job: stub(url, false) };
    }
    if (status >= 400) return { ok: false, httpStatus: status, error: `HTTP ${status}` };
    const $ = cheerio.load(html);
    const ld = readJsonLd($);
    const title =
      ld?.title ||
      $("h1.top-card-layout__title, h1.topcard__title").first().text().trim() ||
      $("h1").first().text().trim() ||
      undefined;
    const company =
      ld?.hiringOrganization?.name ||
      $("a.topcard__org-name-link, .topcard__flavor a").first().text().trim() ||
      undefined;
    const location =
      ld?.jobLocation?.address?.addressLocality ||
      $(".topcard__flavor--bullet").first().text().trim() ||
      undefined;
    const closed = /no longer accepting applications|this job is no longer/i.test(html);
    return {
      ok: true,
      httpStatus: status,
      job: {
        url,
        canonicalUrl: url,
        site: "linkedin",
        available: !closed,
        title,
        company,
        location,
        isRemote: looksRemote(location),
        deadline: tryParseDate(ld?.validThrough),
        postedAt: tryParseDate(ld?.datePosted),
        contentHash: hashContent(`${title}|${company}|${location}`),
      },
    };
  },
};

function stub(url: string, available: boolean) {
  return { url, canonicalUrl: url, site: "linkedin", available };
}

function readJsonLd($: cheerio.CheerioAPI): any {
  const blocks = $("script[type='application/ld+json']");
  for (const el of blocks.toArray()) {
    try {
      const data = JSON.parse($(el).contents().text());
      if (Array.isArray(data)) {
        for (const d of data) if (d?.["@type"] === "JobPosting") return d;
      } else if (data?.["@type"] === "JobPosting") return data;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}
