import * as cheerio from "cheerio";
import type { SiteAdapter, FetchResult, SimilarPosting } from "../types.js";
import { hashContent, looksRemote, tryParseDate, stripHtml } from "../util.js";

// jobs.ashbyhq.com/<company>/<uuid>
const RE = /^https?:\/\/jobs\.ashbyhq\.com\/([^/]+)\/([0-9a-f-]+)/i;

export const ashby: SiteAdapter = {
  name: "ashby",
  matches(url) {
    return RE.test(url);
  },
  parse({ url, html, status }): FetchResult {
    if (status === 404) return { ok: true, httpStatus: status, job: stub(url, false) };
    if (status >= 400) return { ok: false, httpStatus: status, error: `HTTP ${status}` };
    const $ = cheerio.load(html);
    const ld = readJsonLd($);
    const company = ld?.hiringOrganization?.name || url.match(RE)?.[1];
    const title = ld?.title || $("h1").first().text().trim() || undefined;
    const location =
      ld?.jobLocation?.address?.addressLocality || ld?.jobLocation?.address?.addressRegion;
    const description = stripHtml(ld?.description);
    return {
      ok: true,
      httpStatus: status,
      job: {
        url,
        canonicalUrl: url,
        site: "ashby",
        available: !/position is no longer/i.test(html),
        title,
        company,
        location,
        isRemote: looksRemote(location),
        deadline: tryParseDate(ld?.validThrough),
        postedAt: tryParseDate(ld?.datePosted),
        description,
        contentHash: hashContent(`${title}|${location}|${ld?.description ?? ""}`),
      },
    };
  },
  similarIndexUrl(url) {
    const m = url.match(RE);
    return m ? `https://jobs.ashbyhq.com/${m[1]}` : undefined;
  },
  parseSimilar({ html, finalUrl }): SimilarPosting[] {
    const $ = cheerio.load(html);
    const out: SimilarPosting[] = [];
    $("a[href*='/']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = new URL(href, finalUrl).toString();
      if (!RE.test(abs)) return;
      const title = $(el).text().trim() || undefined;
      out.push({ url: abs, site: "ashby", title });
    });
    return dedupeByUrl(out);
  },
};

function stub(url: string, available: boolean) {
  return { url, canonicalUrl: url, site: "ashby", available };
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
