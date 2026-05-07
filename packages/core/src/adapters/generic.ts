import * as cheerio from "cheerio";
import type { SiteAdapter, FetchResult } from "../types.js";
import { hashContent, looksRemote, tryParseDate } from "../util.js";

/** Last-resort adapter: tries JSON-LD JobPosting then falls back to <title>. */
export const generic: SiteAdapter = {
  name: "generic",
  matches() {
    return true;
  },
  parse({ url, html, status }): FetchResult {
    if (status >= 500) return { ok: false, httpStatus: status, error: `HTTP ${status}` };
    const available = status < 400;
    const $ = cheerio.load(html);
    const ld = readJsonLd($);
    const title =
      ld?.title || $("meta[property='og:title']").attr("content") || $("title").text().trim();
    const company =
      ld?.hiringOrganization?.name || $("meta[property='og:site_name']").attr("content");
    const location = ld?.jobLocation?.address?.addressLocality;
    return {
      ok: true,
      httpStatus: status,
      job: {
        url,
        canonicalUrl: url,
        site: hostnameOf(url),
        available,
        title: title || undefined,
        company: company || undefined,
        location: location || undefined,
        isRemote: looksRemote(location),
        deadline: tryParseDate(ld?.validThrough),
        postedAt: tryParseDate(ld?.datePosted),
        contentHash: hashContent(`${title}|${location}|${ld?.description ?? ""}`),
      },
    };
  },
};

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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}
