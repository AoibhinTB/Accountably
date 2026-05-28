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
  const progress = filled / safeTarget;
  const fullyDone = filled >= safeTarget;

  const onTap = () => {
    startTransition(async () => {
      applyOptimistic("tap");
      const result = await toggleQuickLog(pactId);
      if (!result.ok) {
        console.error("toggleQuickLog failed:", result.error);
      }
    });
  };

  const label =
    safeTarget === 1
      ? fullyDone
        ? `${periodLabel} done`
        : `tap to log ${periodLabel}`
      : fullyDone
        ? "log another"
        : `${count}/${safeTarget} done`;

  const labelColor = fullyDone ? "var(--accent)" : "var(--ink-soft)";

  // SVG progress ring constants. Drawn over the card-coloured background so
  // we get a crisp anti-aliased arc instead of conic-gradient stepping.
  const SIZE = 84;
  const STROKE = 6;
  const R = (SIZE - STROKE) / 2 - 1.5; // leave room for the 1.5px border
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onTap}
        disabled={isPending}
        aria-pressed={fullyDone}
        aria-label={
          fullyDone ? `Log another ${periodLabel}` : `Mark ${periodLabel}`
        }
        className="press"
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: "50%",
          background: fullyDone ? "var(--accent)" : "var(--card)",
          border: fullyDone ? "none" : "1.5px solid var(--line-strong)",
          boxShadow: fullyDone
            ? "0 8px 24px rgba(216, 98, 58, 0.38)"
            : "0 2px 0 rgba(42, 31, 24, 0.06)",
          color: fullyDone ? "#fff" : "var(--ink)",
          touchAction: "manipulation",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {!fullyDone && count > 0 && (
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={STROKE}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </svg>
        )}
        <span
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
          ) : icon ? (
            <span aria-hidden style={{ fontSize: 32, lineHeight: 1 }}>
              {icon}
            </span>
          ) : (
            <svg
              width="32"
              height="32"
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
