import * as cheerio from "cheerio";
import type { SiteAdapter, FetchResult, SimilarPosting } from "../types";
import { hashContent, looksRemote, tryParseDate } from "../util";

// jobs.lever.co/<company>/<uuid>
const RE = /^https?:\/\/jobs\.lever\.co\/([^/]+)\/([0-9a-f-]+)/i;

export const lever: SiteAdapter = {
  name: "lever",
  matches(url) {
    return RE.test(url);
  },
  parse({ url, html, status }): FetchResult {
    if (status === 404 || /position is no longer available/i.test(html)) {
      return { ok: true, httpStatus: status, job: stub(url, false) };
    }
    if (status >= 400) return { ok: false, httpStatus: status, error: `HTTP ${status}` };
    const $ = cheerio.load(html);
    const ld = readJsonLd($);
    const title =
      ld?.title || $(".posting-headline h2, h2.posting-title").first().text().trim() ||
      $("h2").first().text().trim() ||
      undefined;
    const company =
      ld?.hiringOrganization?.name || url.match(RE)?.[1] || undefined;
    const location =
      $(".posting-categories .location, .sort-by-location").first().text().trim() ||
      ld?.jobLocation?.address?.addressLocality ||
      undefined;
    return {
      ok: true,
      httpStatus: status,
      job: {
        url,
        canonicalUrl: url,
        site: "lever",
        available: true,
        title,
        company,
        location,
        isRemote: looksRemote(location),
        deadline: tryParseDate(ld?.validThrough),
        postedAt: tryParseDate(ld?.datePosted),
        contentHash: hashContent(`${title}|${location}|${ld?.description ?? ""}`),
      },
    };
  },
  similarIndexUrl(url) {
    const m = url.match(RE);
    if (!m) return undefined;
    return `https://jobs.lever.co/${m[1]}`;
  },
  parseSimilar({ html, finalUrl }): SimilarPosting[] {
    const $ = cheerio.load(html);
    const out: SimilarPosting[] = [];
    $("a.posting-title, a[href*='jobs.lever.co']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = new URL(href, finalUrl).toString();
      if (!RE.test(abs)) return;
      const title = $(el).find("h5").text().trim() || $(el).text().trim() || undefined;
      out.push({ url: abs, site: "lever", title });
    });
    return dedupeByUrl(out);
  },
};

function stub(url: string, available: boolean) {
  return { url, canonicalUrl: url, site: "lever", available };
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

function dedupeByUrl(items: SimilarPosting[]): SimilarPosting[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
}
