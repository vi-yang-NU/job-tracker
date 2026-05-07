import type { Config } from "./config";

export interface RemoteJob {
  id: string;
  url: string;
  canonicalUrl: string;
  site: string;
  status: string;
  lastFetchedAt: string | null;
  portfolioIds: string[];
}

export interface InboxItem {
  id: string;
  kind:
    | "deadline_soon"
    | "deadline_set"
    | "job_opened"
    | "job_removed"
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
}
