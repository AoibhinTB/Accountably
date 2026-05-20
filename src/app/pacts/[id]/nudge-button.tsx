"use client";

import { useState, useTransition } from "react";
import { toggleNudge } from "../actions";

export function NudgeButton({
  pactId,
  toUserId,
  alreadyNudged,
}: {
  pactId: string;
  toUserId: string;
  alreadyNudged: boolean;
}) {
  const [nudged, setNudged] = useState(alreadyNudged);
  const [isPending, startTransition] = useTransition();

  const onTap = () => {
    if (isPending) return;
    startTransition(async () => {
      setNudged((n) => !n);
      const result = await toggleNudge(pactId, toUserId);
      if (!result.ok) {
        setNudged((n) => !n); // revert on failure
        console.error("toggleNudge failed:", result.error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={isPending}
      aria-pressed={nudged}
      aria-label={nudged ? "Un-nudge" : "Send a nudge"}
      className="press"
      style={{
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: nudged ? "var(--accent-soft)" : "transparent",
        border: `1px solid ${nudged ? "var(--accent)" : "var(--line-strong)"}`,
        color: nudged ? "var(--accent)" : "var(--ink-soft)",
        fontFamily: "var(--font-stat-mono)",
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        flexShrink: 0,
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
    >
      {nudged ? "nudged" : "nudge"}
    </button>
  );
}
