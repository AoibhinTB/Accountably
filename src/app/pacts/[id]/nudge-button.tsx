"use client";

import { useEffect, useState, useTransition } from "react";
import { sendNudge } from "../actions";

type Feedback = "idle" | "sent" | "cooldown";

export function NudgeButton({
  pactId,
  toUserId,
}: {
  pactId: string;
  toUserId: string;
}) {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [isPending, startTransition] = useTransition();

  // Reset feedback after a short delay so the button doesn't get stuck.
  useEffect(() => {
    if (feedback === "idle") return;
    const t = setTimeout(() => setFeedback("idle"), 1800);
    return () => clearTimeout(t);
  }, [feedback]);

  const onTap = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await sendNudge(pactId, toUserId);
      if (result.ok) {
        setFeedback("sent");
      } else if (result.cooldown) {
        setFeedback("cooldown");
      } else {
        console.error("sendNudge failed:", result.error);
      }
    });
  };

  const label =
    feedback === "sent"
      ? "nudged"
      : feedback === "cooldown"
        ? "wait a sec"
        : "nudge";

  const filled = feedback === "sent";

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={isPending}
      aria-label="Send a nudge"
      className="press"
      style={{
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: filled ? "var(--accent-soft)" : "transparent",
        border: `1px solid ${filled ? "var(--accent)" : "var(--line-strong)"}`,
        color: filled ? "var(--accent)" : "var(--ink-soft)",
        fontFamily: "var(--font-stat-mono)",
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        flexShrink: 0,
        transition:
          "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}
