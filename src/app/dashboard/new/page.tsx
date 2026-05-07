import { redirect } from "next/navigation";
import { createPortfolioAction } from "../actions";

export default function NewPortfolio() {
  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-semibold">New portfolio</h1>
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
