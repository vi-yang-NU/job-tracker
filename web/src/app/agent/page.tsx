import { requireUser } from "@/lib/session";
import { db, schema } from "@/lib/db";
import { eq, isNull, and } from "drizzle-orm";
import { generateAgentToken } from "@/lib/agent-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export default async function AgentPage() {
  const { userId } = await requireUser();
  const tokens = await db
    .select()
    .from(schema.agentTokens)
    .where(and(eq(schema.agentTokens.userId, userId), isNull(schema.agentTokens.revokedAt)))
    .orderBy(schema.agentTokens.createdAt);

  // The freshly-minted token (only shown once) is passed via cookie/redirect search param
  // For simplicity we use a server-action redirect with searchParams
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Mac agent</h1>
      <p className="text-sm text-black/70">
        The agent runs on your Mac, fetches your tracked jobs every 3 hours (and on login),
        and sends you an iMessage + macOS notification when there are deadlines or new
        similar postings. Install with the one-liner below, then paste your token when prompted.
      </p>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold">Install on your Mac</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-black/90 p-3 text-xs text-white">
{`curl -fsSL https://${process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ?? "your-vercel-domain"}/install.sh | bash`}
        </pre>
        <p className="mt-2 text-xs text-black/60">
          Installs to <code>~/.jobtracker</code> and registers a launchd agent that runs at login + every 3 hours.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tokens</h2>
          <form action={createTokenAction}>
            <button className="rounded-md bg-ink px-3 py-1.5 text-sm text-white">
              Create token
            </button>
          </form>
        </div>
        {tokens.length === 0 ? (
          <p className="mt-3 text-sm text-black/60">No active tokens. Create one above.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-mono text-xs text-black/60">{t.id.slice(0, 8)}…</div>
                  <div className="text-xs text-black/50">
                    {t.lastUsedAt
                      ? `last used ${new Date(t.lastUsedAt).toLocaleString()}`
                      : "never used"}
                  </div>
                </div>
                <form action={revokeTokenAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-xs text-red-600 hover:underline">revoke</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function createTokenAction() {
  "use server";
  const { userId } = await requireUser();
  const { token, hash } = generateAgentToken();
  await db.insert(schema.agentTokens).values({
    userId,
    tokenHash: hash,
    label: "agent",
  });
  revalidatePath("/agent");
  // Stash the plaintext token in a one-time-shown server cookie via redirect with hash fragment
  const { redirect } = await import("next/navigation");
  redirect(`/agent/token?value=${encodeURIComponent(token)}`);
}

async function revokeTokenAction(formData: FormData) {
  "use server";
  const { userId } = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  await db
    .update(schema.agentTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.agentTokens.id, id), eq(schema.agentTokens.userId, userId)));
  revalidatePath("/agent");
}
