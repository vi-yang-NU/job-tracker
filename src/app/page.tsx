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
      <h1 className="text-4xl font-semibold tracking-tight">
        Track jobs that don't ghost you.
      </h1>
      <p className="mt-4 text-lg text-black/70">
        Paste job links. We watch them every few hours, alert you to deadlines,
        flag postings that disappear, and surface similar roles when they do.
      </p>
      <ul className="mt-6 space-y-2 text-black/70">
        <li>– One paste box, no folders to organize. We scrape, you confirm.</li>
        <li>– Map view so you can scan roles by city.</li>
        <li>– <em>Watching</em> status for jobs that won't open until later.</li>
        <li>
          – Optional Mac agent — runs every 3 hours and sends an iMessage when
          something actually changes.{" "}
          <Link href="#agent" className="underline">Set it up</Link>
        </li>
      </ul>
      <Link
        href="/login"
        className="mt-8 inline-block rounded-md bg-ink px-5 py-2.5 text-white"
      >
        Sign in with Google
      </Link>

      <section id="agent" className="mt-16 rounded-lg border bg-white p-6">
        <h2 className="text-xl font-semibold">Optional: install the Mac agent</h2>
        <p className="mt-1 text-sm text-black/60">
          Sign in first, then mint a token at <code>/agent</code>. After that, run this on your Mac:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-black/90 p-3 text-xs text-white">
{`curl -fsSL ${process.env.NEXTAUTH_URL ?? "<your-deployment>"}/install.sh | bash`}
        </pre>
        <p className="mt-2 text-xs text-black/50">
          The agent runs at login + every 3 hours and stays silent unless something has changed.
          Skip this if you only need the dashboard view.
        </p>
      </section>
    </div>
  );
}

function SetupWizard({
  status,
}: {
  status: Awaited<ReturnType<typeof getSetupStatus>>;
}) {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Setup not finished.</strong> This page is what end users would see — finish the
        steps below, redeploy, and this banner goes away automatically.
      </div>

      <h1 className="mt-8 text-2xl font-semibold">Operator setup</h1>
      <p className="mt-1 text-sm text-black/60">
        Env vars and external accounts needed before sign-in and tracking work.
      </p>

      <ul className="mt-6 space-y-3">
        {status.checks.map((c) => (
          <li
            key={c.id}
            className={`rounded-md border p-3 text-sm ${
              c.ok ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={c.ok ? "text-emerald-700" : "text-rose-700"}>
                {c.ok ? "✓" : "✗"}
              </span>
              <span className="font-medium">{c.label}</span>
            </div>
            <div className="mt-1 text-xs text-black/60">{c.hint}</div>
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
