export interface FetchedJob {
  url: string;
  canonicalUrl: string;
  site: string;
  available: boolean;
  title?: string;
  company?: string;
  location?: string;
  isRemote?: boolean;
  deadline?: Date;
  postedAt?: Date;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  contentHash?: string;
  raw?: unknown;
}

export interface SimilarPosting {
  url: string;
  site: string;
  title?: string;
  company?: string;
  location?: string;
}

export interface FetchResult {
  ok: boolean;
  httpStatus?: number;
  job?: FetchedJob;
  similar?: SimilarPosting[];
  error?: string;
}

export interface AdapterInput {
  url: string;
  html: string;
  status: number;
  finalUrl: string;
}

export interface SiteAdapter {
  name: string;
  matches(url: string): boolean;
  parse(input: AdapterInput): FetchResult;
  /**
   * Returns a URL that lists similar postings (typically the company's careers index).
   * Web cron / agent can fetch this and pass it to `parseSimilar` to detect new sibling jobs.
   */
  similarIndexUrl?(url: string, parsed: FetchedJob | undefined): string | undefined;
  parseSimilar?(input: AdapterInput): SimilarPosting[];
  /** True if this adapter should run via headless browser (LinkedIn, Workday). */
  needsBrowser?: boolean;
}
