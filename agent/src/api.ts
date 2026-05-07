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

export interface Digest {
  generatedAt: string;
  upcoming: Array<{
    id: string;
    title: string | null;
    company: string | null;
    location: string | null;
    url: string;
    site: string;
    deadline: string | null;
    status: string;
  }>;
  removed: Digest["upcoming"];
  newSimilar: Array<{ url: string; title: string | null; site: string; portfolio: string }>;
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

  digest() {
    return this.req<Digest>("/api/agent/digest");
  }

  postResults(results: unknown) {
    return this.req<{ ok: boolean; events: Array<{ kind: string }> }>("/api/agent/results", {
      method: "POST",
      body: JSON.stringify({ results }),
    });
  }
}
