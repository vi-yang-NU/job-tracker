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
      <header className="animate-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Your jobs</h1>
        <p className="mt-1 text-sm text-black/60">
          Paste a URL, verify what we scraped, and we'll watch it from there.
        </p>
      </header>

      <div className="animate-rise-delay-1">
        <AddJobForm />
      </div>

      {tokenCount === 0 ? (
        <div className="animate-rise-delay-2">
          <AgentInstallBanner />
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr,420px]">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-black/70">
            Tracked <span className="tabular-nums text-black/40">({jobs.length})</span>
          </h2>
          {jobs.length === 0 ? (
            <p className="rounded-md border border-dashed border-black/20 bg-white/60 p-6 text-center text-sm text-black/50">
              Nothing here yet. Paste a job URL above.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.06] rounded-lg border border-black/10 bg-white shadow-[var(--shadow-soft)]">
              {jobs.map((j, i) => (
                <li
                  key={j.id}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className="animate-rise row-hover space-y-2 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        href={j.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-medium underline-offset-2 transition-colors duration-150 hover:text-accent hover:underline"
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
                      <button className="text-xs text-black/50 transition-colors duration-150 hover:text-rose-600">
                        remove
                      </button>
                    </form>
                  </div>

                  <form
                    action={updateJobAction}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <input type="hidden" name="jobId" value={j.id} />
                    <label className="text-black/50">Status</label>
                    <select
                      name="status"
                      defaultValue={j.status}
                      className="rounded border border-black/15 bg-white px-1.5 py-0.5 transition-colors duration-150 hover:border-black/30"
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
                      className="rounded border border-black/15 bg-white px-1.5 py-0.5 transition-colors duration-150 hover:border-black/30"
                    />
                    <button className="rounded border border-black/15 px-2 py-0.5 transition-colors duration-150 hover:border-black/30 hover:bg-black/5">
                      save
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="h-[420px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-[var(--shadow-soft)]">
          <MapWrapper jobs={jobs} />
        </div>
      </section>

      {similar.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-black/70">
            Similar postings discovered
          </h2>
          <ul className="mt-2 divide-y divide-black/[0.06] rounded-lg border border-black/10 bg-white shadow-[var(--shadow-soft)]">
            {similar.map((s, i) => (
              <li
                key={s.id}
                style={{ animationDelay: `${i * 30}ms` }}
                className="animate-rise row-hover p-3 text-sm"
              >
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline-offset-2 transition-colors duration-150 hover:text-accent hover:underline"
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
  return <span className={`pill ${tone}`}>{status}</span>;
}

function AgentInstallBanner() {
  return (
    <section className="card-hover relative overflow-hidden rounded-lg border border-accent/40 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-sm">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Get pinged when something changes</h3>
          <p className="mt-1 text-black/70">
            Install the optional Mac agent to get an iMessage / macOS notification when a tracked
            job opens, gets a deadline, or disappears. Silent when nothing's new.
          </p>
        </div>
        <Link href="/agent" className="btn-primary group shrink-0 px-3 py-1.5 text-xs">
          Set up agent
          <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
