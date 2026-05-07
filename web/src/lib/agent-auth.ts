import { createHash, randomBytes } from "node:crypto";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

const PREFIX = "jta_";

export function generateAgentToken(): { token: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const token = `${PREFIX}${raw}`;
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function userIdForAgentToken(token: string | null | undefined): Promise<string | null> {
  if (!token || !token.startsWith(PREFIX)) return null;
  const hash = hashToken(token);
  const row = await db.query.agentTokens.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.tokenHash, hash), isNull(t.revokedAt)),
  });
  if (!row) return null;
  await db
    .update(schema.agentTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.agentTokens.id, row.id));
  return row.userId;
}

export function bearerFromHeader(h: string | null | undefined): string | null {
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}
