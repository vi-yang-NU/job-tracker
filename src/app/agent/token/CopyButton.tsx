"use client";

import { useState } from "react";

export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
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
      className="absolute right-2 top-2 rounded-md bg-white/10 px-2.5 py-1 text-xs text-white transition-all duration-150 hover:bg-white/20 active:scale-95"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
