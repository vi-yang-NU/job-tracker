import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSetupStatus } from "@/lib/setup-status";

export default async function Home() {
  const status = await getSetupStatus();
  if (!status.ok) {
    return <SetupWizard status={status} />;
  }

  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl py-16">
      <h1 className="animate-rise text-4xl font-semibold tracking-tight sm:text-5xl">
        Track jobs that don't ghost you.
      </h1>
      <p className="animate-rise-delay-1 mt-4 text-lg text-black/70">
        Paste job links. We watch them every few hours, alert you to deadlines, flag
        postings that disappear, and surface similar roles when they do.
      </p>
      <ul className="animate-rise-delay-2 mt-6 space-y-2 text-black/70">
        <li>— One paste box, no folders to organize. We scrape, you confirm.</li>
        <li>— Map view so you can scan roles by city.</li>
        <li>
          — <em>Watching</em> status for jobs that won't open until later.
        </li>
        <li>
          — Optional Mac agent — runs every 3 hours and sends an iMessage when something
          actually changes.{" "}
          <a
            href="#agent"
            className="font-medium text-accent underline-offset-2 transition-colors duration-150 hover:underline"
          >
            Set it up ↓
          </a>
        </li>
      </ul>

      <div className="animate-rise-delay-2 mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="btn-primary group px-5 py-2.5 text-base">
          Sign in with Google
          <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
        <a
          href="#agent"
          className="btn-ghost px-5 py-2.5 text-base"
        >
          Set up Mac agent
        </a>
      </div>

      <section
        id="agent"
        className="card-hover relative mt-16 scroll-mt-24 overflow-hidden rounded-lg border border-black/10 bg-white p-6"
      >
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative">
          <h2 className="text-xl font-semibold">Optional: install the Mac agent</h2>
          <p className="mt-1 text-sm text-black/60">
            Three steps. Skip if you only need the dashboard view.
          </p>

          <ol className="mt-4 space-y-3 text-sm text-black/80">
            <Step n={1} title="Sign in">
              <Link
                href="/login"
                className="text-accent underline-offset-2 hover:underline"
              >
                Sign in with Google
              </Link>{" "}
              if you haven't already.
            </Step>
            <Step n={2} title="Mint an agent token">
              From the dashboard, go to{" "}
              <Link href="/agent" className="text-accent underline-offset-2 hover:underline">
                <code>/agent</code>
              </Link>{" "}
              and click <strong>+ Create token</strong>. Copy the token (shown once).
            </Step>
            <Step n={3} title="Install on your Mac">
              <pre className="mt-1 overflow-x-auto rounded bg-black/90 p-3 text-xs text-white">
{`curl -fsSL ${process.env.NEXTAUTH_URL ?? "<your-deployment>"}/install.sh | bash`}
              </pre>
              <p className="mt-1 text-xs text-black/50">
                Paste the token when prompted. Runs at login + every 3 hours, silent unless
                something has changed.
              </p>
            </Step>
          </ol>
        </div>
      </section>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
        {n}
      </span>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-black/70">{children}</div>
      </div>
    </li>
  );
}

function SetupWizard({
  status,
}: {
  status: Awaited<ReturnType<typeof getSetupStatus>>;
}) {
  const done = status.checks.filter((c) => c.ok).length;
  const total = status.checks.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="animate-rise rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-[var(--shadow-soft)]">
        <strong>Setup not finished.</strong> This page is what end users would see — finish the
        steps below, redeploy, and this banner goes away automatically.
      </div>

      <div className="animate-rise-delay-1 mt-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Operator setup</h1>
        <span className="text-xs tabular-nums text-black/50">
          {done} / {total} ready
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-black/60">
        Env vars and external accounts needed before sign-in and tracking work.
      </p>

      <ul className="animate-rise-delay-2 mt-6 space-y-3">
        {status.checks.map((c, i) => (
          <li
            key={c.id}
            style={{ animationDelay: `${80 + i * 40}ms` }}
            className={`animate-rise card-hover rounded-md border p-3 text-sm ${
              c.ok
                ? "border-emerald-300 bg-emerald-50"
                : "border-rose-300 bg-rose-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  c.ok
                    ? "bg-emerald-500 text-white"
                    : "bg-rose-500 text-white"
                }`}
              >
                {c.ok ? "✓" : "!"}
              </span>
              <span className="font-medium">{c.label}</span>
            </div>
            <div className="mt-1 pl-7 text-xs text-black/60">{c.hint}</div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">Manual steps Vercel can't verify</h2>
      <ol className="mt-3 space-y-2 text-sm text-black/70">
        <li>
          1. In Google Cloud Console, add this URL to <em>Authorized redirect URIs</em> on your
          OAuth client:
          <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-xs">
{`${process.env.NEXTAUTH_URL ?? "https://your-app.vercel.app"}/api/auth/callback/google`}
          </pre>
        </li>
        <li>
          2. Run <code>npm run db:push</code> locally with the Turso env vars set, to create the
          tables.
        </li>
        <li>
          3. Set <code>JOBTRACKER_REPO_URL</code> in Vercel env to the public Git URL of this repo
          (used by the Mac-agent installer).
        </li>
      </ol>

      <p className="mt-8 text-xs text-black/50">
        After fixing each item, redeploy from Vercel. This page re-checks on every load.
      </p>
    </div>
  );
}
