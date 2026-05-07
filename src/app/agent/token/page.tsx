import Link from "next/link";
import CopyButton from "./CopyButton";

export default async function ShowToken({
  searchParams,
}: {
  searchParams: Promise<{ value?: string }>;
}) {
  const { value } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="animate-rise text-2xl font-semibold tracking-tight">
        Your agent token
      </h1>
      <p className="animate-rise-delay-1 text-sm text-black/70">
        Copy this now — it's shown only once. Paste it into the agent installer when prompted, or
        store it in <code>~/.jobtracker/agent/.token</code>.
      </p>
      <div className="animate-rise-delay-2 relative">
        <pre className="overflow-x-auto rounded-md bg-black/90 p-4 pr-14 text-sm text-white">
          {value || "(no token)"}
        </pre>
        {value ? <CopyButton value={value} /> : null}
      </div>
      <Link href="/agent" className="btn-ghost mt-2">
        Done
      </Link>
    </div>
  );
}
