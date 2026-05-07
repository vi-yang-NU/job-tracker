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
  const [saving, setSaving] = useState(false);
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
      <form
        onSubmit={handlePreview}
        className="card-hover rounded-lg border border-black/10 bg-white p-4"
      >
        <label htmlFor="job-url" className="text-sm font-semibold">
          Paste a job URL
        </label>
        <p className="mt-1 text-xs text-black/60">
          We'll fetch it and show you what we found before saving anything.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="job-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://boards.greenhouse.io/..."
            className="flex-1 rounded-md border border-black/15 bg-white px-3 py-2 transition-all duration-150 placeholder:text-black/30 hover:border-black/30 focus:border-accent"
          />
          <button
            disabled={pending}
            className="btn-primary group min-w-[110px] disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? (
              <>
                <Spinner />
                <span className="ml-2">Fetching…</span>
              </>
            ) : (
              <>
                Preview
                <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </>
            )}
          </button>
        </div>
        {error ? (
          <p className="animate-fade mt-2 text-sm text-rose-700">{error}</p>
        ) : null}
      </form>
    );
  }

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        try {
          await confirmJobAction(fd);
          back();
          setUrl("");
        } finally {
          setSaving(false);
        }
      }}
      className="animate-rise card-hover rounded-lg border border-accent/50 bg-white p-4 shadow-[var(--shadow-soft)]"
    >
      <input type="hidden" name="url" value={preview.canonicalUrl} />
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Verify before saving</h3>
        <button
          type="button"
          onClick={back}
          className="text-xs text-black/60 transition-colors duration-150 hover:text-black"
        >
          ← back
        </button>
      </div>

      {!preview.available ? (
        <div className="animate-fade mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          We couldn't reach this page or it's marked closed. You can still track it as
          <em> watching</em> and we'll alert you if it opens.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input name="title" defaultValue={preview.title ?? ""} placeholder="(no title found)" />
        </Field>
        <Field label="Company">
          <Input
            name="company"
            defaultValue={preview.company ?? ""}
            placeholder="(no company found)"
          />
        </Field>
        <Field label="Location">
          <Input name="location" defaultValue={preview.location ?? ""} />
        </Field>
        <Field label="Deadline">
          <Input type="date" name="deadline" defaultValue={preview.deadline ?? ""} />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={preview.available ? "active" : "watching"}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm transition-colors duration-150 hover:border-black/30 focus:border-accent"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target apply date (optional)">
          <Input type="date" name="targetApplyDate" />
        </Field>
      </div>

      <Field label="Notes (optional)" className="mt-3">
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm transition-colors duration-150 hover:border-black/30 focus:border-accent"
        />
      </Field>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-black/50">{preview.site}</p>
        <button
          disabled={saving}
          className="btn-primary group disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? (
            <>
              <Spinner />
              <span className="ml-2">Saving…</span>
            </>
          ) : (
            <>
              Save & track
              <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-0.5">
                →
              </span>
            </>
          )}
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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm transition-colors duration-150 placeholder:text-black/30 hover:border-black/30 focus:border-accent ${
        props.className ?? ""
      }`}
    />
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}
