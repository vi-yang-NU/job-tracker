import { requireUser } from "@/lib/session";
import { db, schema } from "@/lib/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import AddJobForm from "./AddJobForm";
import MapWrapper from "./MapWrapper";
import { updateJobAction, removeJobAction } from "./actions";

const STATUS_OPTIONS = [
  "active",
  "watching",
  "applied",
  "rejected",
  "offered",
  "withdrawn",
  "removed",
] as const;

export default async function Dashboard() {
  const { userId } = await requireUser();

  const jobs = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId))
    .orderBy(desc(schema.jobs.createdAt));

  const similar = await db
    .select()
    .from(schema.similarJobs)
    .where(
      and(eq(schema.similarJobs.userId, userId), isNull(schema.similarJobs.dismissedAt))
    )
    .orderBy(desc(schema.similarJobs.discoveredAt))
    .limit(20);

  const tokenCount = await db.$count(
    schema.agentTokens,
    and(eq(schema.agentTokens.userId, userId), isNull(schema.agentTokens.revokedAt))
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Your jobs</h1>
        <p className="mt-1 text-sm text-black/60">
          Paste a URL, verify what we scraped, and we'll watch it from there.
        </p>
      </header>

      <AddJobForm />

      {tokenCount === 0 ? <AgentInstallBanner /> : null}

      <section className="grid gap-4 lg:grid-cols-[1fr,420px]">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Tracked ({jobs.length})</h2>
          {jobs.length === 0 ? (
            <p className="rounded-md border bg-white p-4 text-sm text-black/60">
              Nothing here yet. Paste a job URL above.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border bg-white">
              {jobs.map((j) => (
                <li key={j.id} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        href={j.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-medium hover:underline"
                      >
                        {j.title || j.url}
                      </a>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-black/60">
                        {j.company ? <span>{j.company}</span> : null}
                        {j.location ? <span>{j.location}</span> : null}
                        <span>· {j.site}</span>
                        <StatusPill status={j.status} />
                        {j.deadline ? (
                          <span>
                            · deadline{" "}
                            {new Date(j.deadline).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ) : null}
                        {j.targetApplyDate ? (
                          <span>
                            · applying{" "}
                            {new Date(j.targetApplyDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <form action={removeJobAction}>
                      <input type="hidden" name="jobId" value={j.id} />
                      <button className="text-xs text-black/50 hover:text-red-600">
                        remove
                      </button>
                    </form>
                  </div>

                  <form action={updateJobAction} className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="hidden" name="jobId" value={j.id} />
                    <label className="text-black/50">Status</label>
                    <select
                      name="status"
                      defaultValue={j.status}
                      className="rounded border px-1.5 py-0.5"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <label className="text-black/50">Target apply</label>
                    <input
                      type="date"
                      name="targetApplyDate"
                      defaultValue={
                        j.targetApplyDate
                          ? new Date(j.targetApplyDate).toISOString().slice(0, 10)
                          : ""
                      }
                      className="rounded border px-1.5 py-0.5"
                    />
                    <button className="rounded border px-2 py-0.5 hover:bg-black/5">
                      save
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="h-[420px] overflow-hidden rounded-lg border bg-white">
          <MapWrapper jobs={jobs} />
        </div>
      </section>

      {similar.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">Similar postings discovered</h2>
          <ul className="mt-2 divide-y rounded-lg border bg-white">
            {similar.map((s) => (
              <li key={s.id} className="p-3 text-sm">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {s.title || s.url}
                </a>
                <span className="ml-2 text-xs text-black/50">{s.site}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "watching"
        ? "bg-violet-100 text-violet-800"
        : status === "removed"
          ? "bg-amber-100 text-amber-800"
          : status === "applied"
            ? "bg-blue-100 text-blue-800"
            : "bg-black/10 text-black/70";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}

function AgentInstallBanner() {
  return (
    <section className="rounded-lg border border-accent/40 bg-blue-50 p-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Get pinged when something changes</h3>
          <p className="mt-1 text-black/70">
            Install the optional Mac agent to get an iMessage / macOS notification when a tracked
            job opens, gets a deadline, or disappears. Silent when nothing's new.
          </p>
        </div>
        <Link
          href="/agent"
          className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-xs text-white"
        >
          Set up agent
        </Link>
      </div>
    </section>
  );
}
