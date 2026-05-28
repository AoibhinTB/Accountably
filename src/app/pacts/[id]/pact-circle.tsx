"use client";

import { useOptimistic, useTransition } from "react";
import { toggleQuickLog } from "../actions";

export function PactCircle({
  pactId,
  icon,
  initialCount,
  target,
  periodLabel,
}: {
  pactId: string;
  icon: string | null;
  initialCount: number;
  target: number;
  periodLabel: string; // "today" or "this week"
}) {
  // Single-target pacts toggle on tap (0 ↔ 1). Multi-target pacts increment
  // forever (each tap = one more completion). The reducer below covers both.
  const [count, applyOptimistic] = useOptimistic<number, "tap">(
    initialCount,
    (state) => {
      if (target === 1) return state === 0 ? 1 : 0;
      return state + 1;
    },
  );
  const [isPending, startTransition] = useTransition();

  const safeTarget = Math.max(1, target);
  const filled = Math.min(count, safeTarget);
  const fullyDone = filled >= safeTarget;
  const angle = Math.round((filled / safeTarget) * 360);

  const onTap = () => {
    startTransition(async () => {
      applyOptimistic("tap");
      const result = await toggleQuickLog(pactId);
      if (!result.ok) {
        console.error("toggleQuickLog failed:", result.error);
      }
    });
  };

  // Label text:
  //   - target 1, not done:  "tap to log {periodLabel}"
  //   - target 1, done:      "{periodLabel} done"
  //   - target >1, partial:  "{count}/{target} done"
  //   - target >1, complete: "log another" (still tappable)
  const label =
    safeTarget === 1
      ? fullyDone
        ? `${periodLabel} done`
        : `tap to log ${periodLabel}`
      : fullyDone
        ? "log another"
        : `${count}/${safeTarget} done`;

  const labelColor = fullyDone ? "var(--accent)" : "var(--ink-soft)";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onTap}
        disabled={isPending}
        aria-pressed={fullyDone}
        aria-label={fullyDone ? `Log another ${periodLabel}` : `Mark ${periodLabel}`}
        className="press"
        style={{
          width: 84,
          height: 84,
          borderRadius: "50%",
          // Conic gradient shows progress around the circle. The center disc
          // re-uses var(--card) when not fully done so the icon stays
          // readable; once done it flips to accent like the original disc.
          background: fullyDone
            ? "var(--accent)"
            : count > 0
              ? `conic-gradient(var(--accent) 0deg ${angle}deg, var(--card) ${angle}deg 360deg)`
              : "var(--card)",
          border: fullyDone ? "none" : "1.5px solid var(--line-strong)",
          boxShadow: fullyDone
            ? "0 8px 24px rgba(216, 98, 58, 0.38)"
            : "0 2px 0 rgba(42, 31, 24, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: fullyDone ? "#fff" : "var(--ink)",
          touchAction: "manipulation",
          position: "relative",
        }}
      >
        {fullyDone ? (
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
        ) : (
          // Inner disc keeps the icon legible against the partially-filled
          // conic background.
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon ? (
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>
                {icon}
              </span>
            ) : (
              <svg
                width="28"
                height="28"
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
          </span>
        )}
      </button>
      <div
        style={{
          fontFamily: "var(--font-stat-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: labelColor,
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 100,
        }}
      >
        {label}
      </div>
    </div>
  );
}
