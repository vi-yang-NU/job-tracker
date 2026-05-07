/**
 * Tiny client for the local Ollama server (http://localhost:11434).
 *
 * We call /api/chat with `format: "json"` so the model returns parseable JSON.
 * The model is configurable via OLLAMA_MODEL (default llama3.1:8b).
 */
const BASE = process.env.OLLAMA_BASE ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

export interface OllamaInfo {
  available: boolean;
  models: string[];
  base: string;
  selected: string;
  reason?: string;
}

export async function ollamaInfo(): Promise<OllamaInfo> {
  try {
    const res = await fetch(`${BASE}/api/tags`);
    if (!res.ok) {
      return { available: false, models: [], base: BASE, selected: MODEL, reason: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    return {
      available: true,
      models,
      base: BASE,
      selected: MODEL,
      reason: models.includes(MODEL)
        ? undefined
        : `model ${MODEL} not pulled — run \`ollama pull ${MODEL}\``,
    };
  } catch (err) {
    return {
      available: false,
      models: [],
      base: BASE,
      selected: MODEL,
      reason: (err as Error).message,
    };
  }
}

export interface OllamaChatOptions {
  /** System prompt. */
  system?: string;
  /** Override model for this call. */
  model?: string;
  /** Lower for tighter outputs (default 0.2 — we want determinism). */
  temperature?: number;
  /** Abort signal for timeouts. */
  signal?: AbortSignal;
}

/**
 * Run a JSON-mode chat completion. Throws if the model output isn't parseable
 * JSON or the server is unreachable.
 */
export async function ollamaJson<T>(
  prompt: string,
  opts: OllamaChatOptions = {}
): Promise<T> {
  const messages = [
    ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
    { role: "user" as const, content: prompt },
  ];
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? MODEL,
      stream: false,
      format: "json",
      options: { temperature: opts.temperature ?? 0.2 },
      messages,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ollama ${res.status}: ${body || res.statusText}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    throw new Error(
      `ollama returned non-JSON: ${content.slice(0, 200)} (${(err as Error).message})`
    );
  }
}
