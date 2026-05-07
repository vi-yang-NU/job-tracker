import { requireUser } from "@/lib/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createPortfolioAction } from "./actions";

export default async function Dashboard() {
  const { userId } = await requireUser();
  const portfolios = await db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, userId))
    .orderBy(schema.portfolios.createdAt);

  if (portfolios.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="text-2xl font-semibold">Create your first portfolio</h1>
        <p className="mt-2 text-sm text-black/60">
          A portfolio is a named bucket of jobs with its own location preferences.
          Examples: <em>"NYC startups"</em>, <em>"Remote ML roles"</em>.
        </p>
        <form
          action={async (fd) => {
            "use server";
            const id = await createPortfolioAction(fd);
            redirect(`/p/${id}`);
          }}
          className="mt-6 space-y-3"
        >
          <input
            name="name"
            required
            placeholder="Portfolio name"
            className="w-full rounded-md border px-3 py-2"
          />
          <textarea
            name="description"
            rows={3}
            placeholder="What goes in here? (optional)"
            className="w-full rounded-md border px-3 py-2"
          />
          <button className="rounded-md bg-ink px-4 py-2 text-white">Create</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Portfolios</h1>
        <Link
          href="/dashboard/new"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-black/5"
        >
          New portfolio
        </Link>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {portfolios.map((p) => (
          <li key={p.id}>
            <Link
              href={`/p/${p.id}`}
              className="block rounded-lg border p-4 hover:border-accent hover:bg-white"
            >
              <div className="text-lg font-medium">{p.name}</div>
              {p.description ? (
                <div className="mt-1 text-sm text-black/60">{p.description}</div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
