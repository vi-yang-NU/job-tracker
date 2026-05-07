import * as cheerio from "cheerio";
import type { SiteAdapter, FetchResult, SimilarPosting } from "../types.js";
import { hashContent, looksRemote, tryParseDate, stripHtml } from "../util.js";

// boards.greenhouse.io/<company>/jobs/<id>
//   or job-boards.greenhouse.io/<company>/jobs/<id>
const RE = /^https?:\/\/(?:job-)?boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i;

export const greenhouse: SiteAdapter = {
  name: "greenhouse",
  matches(url) {
    return RE.test(url);
  },
  parse({ url, html, status }): FetchResult {
    if (status === 404 || /this position is no longer/i.test(html)) {
      return { ok: true, httpStatus: status, job: stub(url, false) };
    }
    if (status >= 400) return { ok: false, httpStatus: status, error: `HTTP ${status}` };
    const $ = cheerio.load(html);
    const ld = readJsonLd($);
    const title =
      ld?.title || $("h1.app-title, .app-title, h1").first().text().trim() || undefined;
    const company =
      ld?.hiringOrganization?.name ||
      $("span.company-name, .company-name").first().text().trim() ||
      url.match(RE)?.[1] ||
      undefined;
    const location =
      ld?.jobLocation?.address?.addressLocality ||
      $(".location, .job-location, .app-location").first().text().trim() ||
      undefined;
    const deadline = tryParseDate(ld?.validThrough);
    const postedAt = tryParseDate(ld?.datePosted);
    const description =
      stripHtml(ld?.description) ??
      ($("#content, .app-content, .content, [class*='description']").first().text().trim() ||
        undefined);
    return {
      ok: true,
      httpStatus: status,
      job: {
        url,
        canonicalUrl: url,
        site: "greenhouse",
        available: true,
        title,
        company,
        location,
        isRemote: looksRemote(location),
        deadline,
        postedAt,
        description,
        contentHash: hashContent(`${title}|${location}|${ld?.description ?? ""}`),
      },
    };
  },
  similarIndexUrl(url) {
    const m = url.match(RE);
    if (!m) return undefined;
    return `https://boards.greenhouse.io/${m[1]}`;
  },
  parseSimilar({ html, finalUrl }): SimilarPosting[] {
    const $ = cheerio.load(html);
    const out: SimilarPosting[] = [];
    $("a[href*='/jobs/']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = new URL(href, finalUrl).toString();
      if (!RE.test(abs)) return;
      const title = $(el).text().trim() || undefined;
      out.push({ url: abs, site: "greenhouse", title });
    });
    return dedupeByUrl(out);
  },
};

function stub(url: string, available: boolean) {
  return { url, canonicalUrl: url, site: "greenhouse", available };
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
