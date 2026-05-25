"use client";

import { useOptimistic, useTransition } from "react";
import { toggleQuickLog } from "../actions";

export function PactCircle({
  pactId,
  icon,
  initialDone,
  periodLabel,
}: {
  pactId: string;
  icon: string | null;
  initialDone: boolean;
  periodLabel: string; // "today" or "this week"
}) {
  const [done, applyOptimistic] = useOptimistic<boolean, void>(
    initialDone,
    (state) => !state,
  );
  const [isPending, startTransition] = useTransition();

  const onTap = () => {
    startTransition(async () => {
      applyOptimistic();
      const result = await toggleQuickLog(pactId);
      if (!result.ok) {
        console.error("toggleQuickLog failed:", result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onTap}
        disabled={isPending}
        aria-pressed={done}
        aria-label={
          done
            ? `Undo ${periodLabel}`
            : `Mark ${periodLabel} done`
        }
        className="press"
        style={{
          width: 84,
          height: 84,
          borderRadius: "50%",
          background: done ? "var(--accent)" : "var(--card)",
          border: done ? "none" : "1.5px solid var(--line-strong)",
          boxShadow: done
            ? "0 8px 24px rgba(216, 98, 58, 0.38)"
            : "0 2px 0 rgba(42, 31, 24, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: done ? "#fff" : "var(--ink)",
          touchAction: "manipulation",
        }}
      >
        {done ? (
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        ) : icon ? (
          <span aria-hidden style={{ fontSize: 38, lineHeight: 1 }}>
            {icon}
          </span>
        ) : (
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ color: "var(--mute)" }}
          >
            <circle cx="12" cy="12" r="9" strokeDasharray="2 4" />
          </svg>
        )}
      </button>
      <div
        style={{
          fontFamily: "var(--font-stat-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: done ? "var(--accent)" : "var(--ink-soft)",
          fontWeight: 600,
        }}
      >
        {done ? `${periodLabel} done` : `tap to mark ${periodLabel} done`}
      </div>
    </div>
  );
}
