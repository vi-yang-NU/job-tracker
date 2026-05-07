/**
 * Retrieval-augmented helpers used by the parse step.
 *
 * Embeddings come from a local Ollama embedding model (nomic-embed-text by
 * default). We chunk text on natural boundaries, embed each chunk, then do
 * cosine top-k retrieval in-process — no vector DB needed because resume +
 * one-job-at-a-time corpora are tiny.
 */

const EMBED_BASE = process.env.OLLAMA_BASE ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

export interface Chunk {
  text: string;
  vector: number[];
  /** 0-based position in the source so we can show "earlier in the resume" etc. */
  ord: number;
}

/**
 * Split text into chunks of roughly `maxChars` characters along natural
 * boundaries (paragraph → sentence → hard split). Keeps headings + bullets
 * with their following sentences when possible.
 */
export function chunkText(text: string, maxChars = 800): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= maxChars) return [normalized];

  // First pass: split on blank lines (paragraphs).
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";
  for (const p of paragraphs) {
    if (p.length > maxChars) {
      // Paragraph too big — flush, then split by sentence.
      if (buffer) {
        chunks.push(buffer);
        buffer = "";
      }
      const sentences = p.split(/(?<=[.!?])\s+(?=[A-Z])/);
      let sb = "";
      for (const s of sentences) {
        if (sb.length + s.length + 1 > maxChars && sb) {
          chunks.push(sb.trim());
          sb = "";
        }
        sb += (sb ? " " : "") + s;
      }
      if (sb.trim()) chunks.push(sb.trim());
      continue;
    }
    if (buffer && buffer.length + p.length + 2 > maxChars) {
      chunks.push(buffer);
      buffer = p;
    } else {
      buffer += (buffer ? "\n\n" : "") + p;
    }
  }
  if (buffer) chunks.push(buffer);
  // Hard cap on chunk count to keep embedding cost bounded.
  return chunks.slice(0, 60);
}

/** Cosine similarity. Both vectors must be the same length. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Top-k chunks by cosine similarity to the query vector. */
export function topK(chunks: Chunk[], query: number[], k: number): Chunk[] {
  const scored = chunks.map((c) => ({ c, s: cosine(c.vector, query) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, k).map((x) => x.c);
}

/** Call Ollama's embeddings endpoint. Returns a single vector. */
export async function embed(text: string, opts?: { model?: string }): Promise<number[]> {
  const res = await fetch(`${EMBED_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: opts?.model ?? EMBED_MODEL,
      prompt: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ollama embeddings ${res.status}: ${body || res.statusText}`);
  }
  const data = (await res.json()) as { embedding?: number[] };
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error(`ollama embeddings returned no vector — is ${EMBED_MODEL} pulled?`);
  }
  return data.embedding;
}

/** Embed many strings sequentially (Ollama embed endpoint is single-shot). */
export async function embedAll(
  texts: string[],
  opts?: { model?: string }
): Promise<Chunk[]> {
  const out: Chunk[] = [];
  for (let i = 0; i < texts.length; i++) {
    const vector = await embed(texts[i], opts);
    out.push({ text: texts[i], vector, ord: i });
  }
  return out;
}

/** Build chunks for a body of text in one call. */
export async function chunkAndEmbed(
  text: string,
  opts?: { maxChars?: number; model?: string }
): Promise<Chunk[]> {
  const pieces = chunkText(text, opts?.maxChars);
  return embedAll(pieces, { model: opts?.model });
}
