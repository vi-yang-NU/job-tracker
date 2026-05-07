import type { Config } from "./config.js";

export interface RemoteJob {
  id: string;
  url: string;
  canonicalUrl: string;
  site: string;
  status: string;
  lastFetchedAt: string | null;
}

export interface InboxItem {
  id: string;
  kind:
    | "deadline_soon"
    | "deadline_set"
    | "job_opened"
    | "job_removed"
    | "job_unlocked"
    | "new_similar"
    | "fetch_failed";
  jobId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export class Api {
  constructor(private cfg: Config) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.cfg.apiBase}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.cfg.token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  me() {
    return this.req<{ id: string; email: string; name: string | null }>("/api/agent/me");
  }

  jobs() {
    return this.req<{ jobs: RemoteJob[] }>("/api/agent/jobs");
  }

  inbox() {
    return this.req<{ notifications: InboxItem[] }>("/api/agent/inbox");
  }

  ackInbox(ids: string[], via: "imessage" | "macos_notification" | "stdout") {
    return this.req<{ ok: boolean; count: number }>("/api/agent/inbox/ack", {
      method: "POST",
      body: JSON.stringify({ ids, via }),
    });
  }

  postResults(results: unknown) {
    return this.req<{ ok: boolean; eventsEmitted: number }>("/api/agent/results", {
      method: "POST",
      body: JSON.stringify({ results }),
    });
  }

  parseQueue() {
    return this.req<{
      resume: { rawText: string; lastUpdatedAt: string } | null;
      jobs: Array<{ id: string; url: string; title: string | null; description: string | null }>;
    }>("/api/agent/parse-queue");
  }

  parsedResume() {
    return this.req<{
      resume: {
        yoe: number;
        education: string | null;
        skills: string[];
        currentRole: string | null;
        industries: string[];
        lastUpdatedAt: string;
        effectiveYoe: number;
      } | null;
    }>("/api/agent/resume");
  }

  postParsedResume(parsed: {
    yoe: number;
    education: string | null;
    skills: string[];
    currentRole: string | null;
    industries: string[];
    roles?: Array<{ title: string; start: string; end: string; type: string }>;
  }) {
    return this.req<{ ok: boolean }>("/api/agent/parsed-resume", {
      method: "POST",
      body: JSON.stringify(parsed),
    });
  }

  postParsedJobs(items: unknown[]) {
    return this.req<{ ok: boolean; unlockedNow: number }>("/api/agent/parsed-jobs", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }
}
