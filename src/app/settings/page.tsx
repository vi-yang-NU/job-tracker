import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";

export default async function Settings() {
  const { userId } = await requireUser();
  const u = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
  });
  if (!u) return null;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="animate-rise text-2xl font-semibold tracking-tight">Settings</h1>
      <section className="animate-rise-delay-1 card-hover rounded-lg border border-black/10 bg-white p-4 text-sm">
        <div>
          <span className="text-black/60">Signed in as</span>{" "}
          <span className="font-medium">{u.email}</span>
        </div>
      </section>
    </div>
  );
}
