"use client";

import { useState, useTransition } from "react";
import {
  previewJobAction,
  confirmJobAction,
  type JobPreview,
} from "./actions";

const STATUSES = [
  "active",
  "watching",
  "applied",
  "rejected",
  "offered",
  "withdrawn",
] as const;

export default function AddJobForm() {
  const [stage, setStage] = useState<"input" | "preview">("input");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<JobPreview | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;
    startTransition(async () => {
      try {
        const p = await previewJobAction(url.trim());
        setPreview(p);
        setStage("preview");
        if (!p.ok) setError(p.error ?? "Couldn't read this URL.");
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function back() {
    setStage("input");
    setPreview(null);
    setError(null);
  }

  if (stage === "input" || !preview) {
    return (
      <form onSubmit={handlePreview} className="rounded-lg border bg-white p-4">
        <label className="text-sm font-semibold">Paste a job URL</label>
        <p className="mt-1 text-xs text-black/60">
          We'll fetch it and show you what we found before saving anything.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://boards.greenhouse.io/..."
            className="flex-1 rounded-md border px-3 py-2"
          />
          <button
            disabled={pending}
            className="rounded-md bg-ink px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? "Fetching…" : "Preview"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </form>
    );
  }

  return (
    <form
      action={async (fd) => {
        await confirmJobAction(fd);
        back();
        setUrl("");
      }}
      className="rounded-lg border border-accent bg-white p-4"
    >
      <input type="hidden" name="url" value={preview.canonicalUrl} />
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Verify before saving</h3>
        <button type="button" onClick={back} className="text-xs text-black/60 hover:underline">
          ← back
        </button>
      </div>

      {!preview.available ? (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          We couldn't reach this page or it's marked closed. You can still track it as
          <em> watching</em> and we'll alert you if it opens.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input
            name="title"
            defaultValue={preview.title ?? ""}
            placeholder="(no title found)"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Company">
          <input
            name="company"
            defaultValue={preview.company ?? ""}
            placeholder="(no company found)"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Location">
          <input
            name="location"
            defaultValue={preview.location ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Deadline">
          <input
            type="date"
            name="deadline"
            defaultValue={preview.deadline ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={preview.available ? "active" : "watching"}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target apply date (optional)">
          <input
            type="date"
            name="targetApplyDate"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label="Notes (optional)" className="mt-3">
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-black/50">{preview.site}</p>
        <button className="rounded-md bg-ink px-4 py-2 text-sm text-white">
          Save & track
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs ${className ?? ""}`}>
      <span className="text-black/60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
