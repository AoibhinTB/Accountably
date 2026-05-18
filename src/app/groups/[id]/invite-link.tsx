"use client";

import { useState } from "react";

export function InviteLink({ url, code }: { url: string; code: string }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  async function copy(value: string, set: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(value);
      set(true);
      setTimeout(() => set(false), 1500);
    } catch {
      // Older browsers / insecure contexts — silently ignore.
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-zinc-100 px-3 py-2.5 text-xs">{url}</code>
        <button
          type="button"
          onClick={() => copy(url, setCopiedUrl)}
          className="min-h-11 shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
        >
          {copiedUrl ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600">Or share the code:</span>
        <code className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-sm">{code}</code>
        <button
          type="button"
          onClick={() => copy(code, setCopiedCode)}
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium"
        >
          {copiedCode ? "Copied" : "Copy code"}
        </button>
      </div>
    </div>
  );
}
