import { requireUser } from "@/lib/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export default async function PortfolioSettings({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireUser();
  const portfolio = await db.query.portfolios.findFirst({
    where: (p, { and, eq }) => and(eq(p.id, id), eq(p.userId, userId)),
  });
  if (!portfolio) return notFound();

  const prefs = portfolio.locationPrefs ?? {};
  const role = portfolio.rolePrefs ?? {};

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href={`/p/${id}`} className="text-sm text-black/60 hover:underline">
        ← Back to portfolio
      </Link>
      <h1 className="text-2xl font-semibold">{portfolio.name} — preferences</h1>

      <form action={savePrefsAction} className="space-y-5 rounded-lg border bg-white p-5">
        <input type="hidden" name="id" value={id} />

        <div>
          <label className="block text-sm font-medium">Cities (comma-separated)</label>
          <input
            name="cities"
            defaultValue={(prefs.cities ?? []).join(", ")}
            placeholder="New York, San Francisco, Remote"
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remote" defaultChecked={!!prefs.remote} />
            Remote OK
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hybrid" defaultChecked={!!prefs.hybrid} />
            Hybrid OK
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium">Role keywords</label>
          <input
            name="keywords"
            defaultValue={(role.keywords ?? []).join(", ")}
            placeholder="ML, infrastructure, frontend"
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Titles to prioritize</label>
          <input
            name="titles"
            defaultValue={(role.titles ?? []).join(", ")}
            placeholder="Senior MLE, Staff Engineer"
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <button className="rounded-md bg-ink px-4 py-2 text-sm text-white">Save</button>
      </form>
    </div>
  );
}

const prefsSchema = z.object({
  id: z.string().min(1),
  cities: z.string(),
  remote: z.string().optional(),
  hybrid: z.string().optional(),
  keywords: z.string(),
  titles: z.string(),
});

async function savePrefsAction(formData: FormData) {
  "use server";
  const { userId } = await requireUser();
  const parsed = prefsSchema.parse(Object.fromEntries(formData));
  const owns = await db.query.portfolios.findFirst({
    where: (p, { and, eq }) => and(eq(p.id, parsed.id), eq(p.userId, userId)),
  });
  if (!owns) throw new Error("not found");

  const split = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  await db
    .update(schema.portfolios)
    .set({
      locationPrefs: {
        cities: split(parsed.cities),
        remote: parsed.remote === "on",
        hybrid: parsed.hybrid === "on",
      },
      rolePrefs: {
        keywords: split(parsed.keywords),
        titles: split(parsed.titles),
      },
    })
    .where(eq(schema.portfolios.id, parsed.id));

  revalidatePath(`/p/${parsed.id}`);
  redirect(`/p/${parsed.id}`);
}
