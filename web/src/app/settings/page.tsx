import { requireUser } from "@/lib/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export default async function Settings() {
  const { userId } = await requireUser();
  const u = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
  });
  if (!u) return null;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="rounded-lg border bg-white p-4 text-sm">
        <div>
          <span className="text-black/60">Signed in as</span>{" "}
          <span className="font-medium">{u.email}</span>
        </div>
      </section>
    </div>
  );
}
