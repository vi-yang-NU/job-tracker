import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { saveResumeAction, refreshResumeDateAction } from "./actions";
import CopyCommand from "./CopyCommand";

export default async function Settings() {
  const { userId } = await requireUser();
  const u = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
  });
  const resume = await db.query.resumes.findFirst({
    where: (r, { eq }) => eq(r.userId, userId),
  });
  if (!u) return null;

  const parsed = resume?.parsed;
  const ageDays = resume
    ? Math.floor((Date.now() - resume.lastUpdatedAt.getTime()) / 86400_000)
    : null;
  const effectiveYoe = parsed
    ? (parsed.yoe ?? 0) +
      (resume ? Math.max(0, (Date.now() - resume.lastUpdatedAt.getTime()) / (365 * 86400_000)) : 0)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="animate-rise text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="animate-rise-delay-1 card-hover rounded-lg border border-black/10 bg-white p-4 text-sm">
        <div>
          <span className="text-black/60">Signed in as</span>{" "}
          <span className="font-medium">{u.email}</span>
        </div>
      </section>

      <section className="animate-rise-delay-2 card-hover rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-lg font-semibold">Resume</h2>
        <p className="mt-1 text-sm text-black/60">
          Paste your resume text below. The Mac agent runs Ollama locally to extract your years of
          experience, skills, and education — your resume text never leaves your machine after
          this upload, and we only store the structured snapshot for matching.
        </p>

        {parsed ? (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <Stat label="Years of experience" value={`${parsed.yoe ?? 0}y`} />
            <Stat
              label="Effective YoE today"
              value={effectiveYoe ? `${effectiveYoe.toFixed(1)}y` : "—"}
              hint={ageDays !== null ? `resume ${ageDays}d old` : undefined}
            />
            <Stat label="Education" value={parsed.education ?? "—"} />
            <Stat label="Skills" value={`${parsed.skills?.length ?? 0}`} />
            {parsed.currentRole ? (
              <Stat label="Current role" value={parsed.currentRole} className="col-span-2" />
            ) : null}
          </div>
        ) : resume?.rawText ? (
          <div className="mt-4 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              Resume uploaded but not yet parsed. The Mac agent ticks every 3h — fire one now to
              parse this immediately:
            </p>
            <CopyCommand command="open -a Ollama; sleep 2; launchctl start com.jobtracker.agent" label="Run agent now" />
            <p className="text-xs text-amber-800/80">
              Then refresh this page. Check timing with{" "}
              <code className="font-mono">node ~/.jobtracker/agent/dist/index.js status</code>.
              Make sure Ollama is running (<code>brew services start ollama</code>) and{" "}
              <code>llama3.1:8b</code> + <code>nomic-embed-text</code> are pulled.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-xs text-black/60">No resume on file yet.</p>
        )}

        <form action={saveResumeAction} className="mt-4 space-y-3">
          <textarea
            name="text"
            required
            minLength={20}
            rows={10}
            placeholder="Paste resume text here…"
            defaultValue={resume?.rawText ?? ""}
            className="w-full rounded-md border border-black/15 bg-white p-3 font-mono text-xs transition-colors duration-150 hover:border-black/30 focus:border-accent"
          />
          <button className="btn-primary">Save resume</button>
        </form>

        {resume ? (
          <form action={refreshResumeDateAction} className="mt-2">
            <button className="btn-ghost text-xs">Mark as up-to-date today</button>
            <p className="mt-1 text-[11px] text-black/50">
              Tells us your resume reflects current state. We use this date to compute your{" "}
              <em>effective</em> YoE — it grows by ~1 year per year automatically until you mark
              again.
            </p>
          </form>
        ) : null}
      </section>

      <section className="animate-rise-delay-3 card-hover rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-lg font-semibold">Mac agent</h2>
        <p className="mt-1 text-sm text-black/60">
          The agent runs on a 3-hour <code>launchd</code> timer. After saving a resume or adding
          jobs, fire a tick now instead of waiting:
        </p>
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-black/50">Run a tick now</div>
          <CopyCommand command="open -a Ollama; sleep 2; launchctl start com.jobtracker.agent" />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-black/50">
            Check last / next tick
          </div>
          <CopyCommand command="node ~/.jobtracker/agent/dist/index.js status" />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-black/50">Watch live logs</div>
          <CopyCommand command="tail -f ~/.jobtracker/agent.log" />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wide text-emerald-700/70">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-emerald-900">{value}</div>
      {hint ? <div className="text-[10px] text-emerald-700/60">{hint}</div> : null}
    </div>
  );
}
