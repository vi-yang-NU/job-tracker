import Link from "next/link";

export default async function ShowToken({
  searchParams,
}: {
  searchParams: Promise<{ value?: string }>;
}) {
  const { value } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Your agent token</h1>
      <p className="text-sm text-black/70">
        Copy this now — it's shown only once. Paste it into the agent installer when prompted, or
        store it in <code>~/.jobtracker/.token</code>.
      </p>
      <pre className="overflow-x-auto rounded-md bg-black/90 p-4 text-sm text-white">
        {value || "(no token)"}
      </pre>
      <Link
        href="/agent"
        className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-black/5"
      >
        Done
      </Link>
    </div>
  );
}
