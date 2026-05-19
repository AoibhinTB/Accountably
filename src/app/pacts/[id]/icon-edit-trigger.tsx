"use client";

import { ReactNode } from "react";

// Wraps the pact-hero icon so tapping it opens the `edit pact` disclosure
// and scrolls to it. The disclosure element is found by its DOM id.
export function IconEditTrigger({
  targetId,
  children,
  ariaLabel,
}: {
  targetId: string;
  children: ReactNode;
  ariaLabel: string;
}) {
  const open = () => {
    const el = document.getElementById(targetId) as HTMLDetailsElement | null;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <button
      type="button"
      onClick={open}
      aria-label={ariaLabel}
      className="press"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        display: "inline-flex",
      }}
    >
      {children}
    </button>
  );
}
