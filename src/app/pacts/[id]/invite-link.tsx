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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <code
          className="flex-1 truncate"
          style={{
            background: "var(--card-inset)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 12,
            color: "var(--ink-soft)",
          }}
        >
          {url}
        </code>
        <button
          type="button"
          onClick={() => copy(url, setCopiedUrl)}
          className="press"
          style={{
            minHeight: 44,
            flexShrink: 0,
            padding: "0 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--ink)",
            color: "var(--bg)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {copiedUrl ? "copied" : "copy"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="label">or share the code:</span>
        <code
          style={{
            background: "var(--card-inset)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 13,
            color: "var(--ink)",
          }}
        >
          {code}
        </code>
        <button
          type="button"
          onClick={() => copy(code, setCopiedCode)}
          className="press"
          style={{
            minHeight: 34,
            padding: "0 12px",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "1px solid var(--line-strong)",
            color: "var(--ink-soft)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {copiedCode ? "copied" : "copy"}
        </button>
      </div>
    </div>
  );
}
