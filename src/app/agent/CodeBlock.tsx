"use client";

import { useState } from "react";

export default function CodeBlock({
  value,
  variant = "dark",
}: {
  value: string;
  variant?: "dark" | "light";
}) {
  const [copied, setCopied] = useState(false);
  const dark = variant === "dark";
  return (
    <div className="relative">
      <pre
        className={`overflow-x-auto rounded p-3 text-xs ${
          dark ? "bg-black/90 text-white" : "bg-black/5 text-black/80"
        }`}
      >
        {value}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className={`absolute right-2 top-2 rounded-md px-2.5 py-1 text-xs transition-all duration-150 active:scale-95 ${
          dark
            ? "bg-white/10 text-white hover:bg-white/20"
            : "bg-white text-black/70 hover:bg-black/10"
        }`}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
