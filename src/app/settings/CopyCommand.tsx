"use client";

import { useState } from "react";

export default function CopyCommand({
  command,
  label,
}: {
  command: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fall back to selecting
    }
  }

  return (
    <div className="flex items-stretch gap-1.5 overflow-hidden rounded-md border border-black/15 bg-black/[0.03] font-mono text-xs">
      <code className="flex-1 select-all overflow-x-auto whitespace-nowrap px-2.5 py-1.5 text-black/80">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 border-l border-black/10 bg-white px-2.5 py-1.5 text-[11px] font-medium text-black/70 transition-colors duration-150 hover:bg-accent/10 hover:text-accent"
        aria-label={label ?? "Copy command"}
      >
        {copied ? "✓ copied" : "copy"}
      </button>
    </div>
  );
}
