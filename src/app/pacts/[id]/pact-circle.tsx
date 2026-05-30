"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { toggleQuickLog } from "../actions";
import { NoteSheet, type NoteSheetPrompt } from "@/components/note-sheet";

// Same gesture model as the homepage today-band: nothing happens on a
// quick tap; press-and-hold until the ring completes one slice fires a
// log. The fill animation only starts after START_TAP_MS so a stray
// touch never shows progress.
const HOLD_MS = 850;
const START_TAP_MS = 200;

export function PactCircle({
  pactId,
  pactName,
  icon,
  initialCount,
  target,
  periodLabel,
  metricKind,
  metricName,
}: {
  pactId: string;
  pactName: string;
  icon: string | null;
  initialCount: number;
  target: number;
  periodLabel: string;
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
}) {
  const [count, applyOptimistic] = useOptimistic<number, "tap">(
    initialCount,
    (state) => {
      return state >= Math.max(1, target) ? 0 : state + 1;
    },
  );
  const [isPending, startTransition] = useTransition();
  const [holdProgress, setHoldProgress] = useState(0);
  const [prompt, setPrompt] = useState<NoteSheetPrompt | null>(null);

  const holdRef = useRef({
    startTime: 0,
    startX: 0,
    startY: 0,
    rafId: 0,
    fired: false,
  });

  const safeTarget = Math.max(1, target);
  const baseFilled = Math.min(count, safeTarget);
  const baseProgress = baseFilled / safeTarget;
  // The ring grows by one full slice (1/target) during the hold so the
  // user sees they are about to add one check-in.
  const progress = Math.min(1, baseProgress + holdProgress / safeTarget);
  const fullyDone = baseFilled >= safeTarget;

  const fireLog = () => {
    startTransition(async () => {
      applyOptimistic("tap");
      const result = await toggleQuickLog(pactId);
      if (!result.ok) {
        console.error("toggleQuickLog failed:", result.error);
        return;
      }
      if (result.done) {
        setPrompt({
          pactName,
          completionId: result.completionId,
          metricKind,
          metricName,
        });
      }
    });
  };

  const cancelHold = () => {
    if (holdRef.current.rafId) {
      cancelAnimationFrame(holdRef.current.rafId);
      holdRef.current.rafId = 0;
    }
    holdRef.current.startTime = 0;
    setHoldProgress(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    holdRef.current.startTime = performance.now();
    holdRef.current.startX = e.clientX;
    holdRef.current.startY = e.clientY;
    holdRef.current.fired = false;
    const tick = () => {
      if (!holdRef.current.startTime) return;
      const elapsed = performance.now() - holdRef.current.startTime;
      const p =
        elapsed <= START_TAP_MS
          ? 0
          : Math.min((elapsed - START_TAP_MS) / (HOLD_MS - START_TAP_MS), 1);
      setHoldProgress(p);
      if (p >= 1 && !holdRef.current.fired) {
        holdRef.current.fired = true;
        holdRef.current.startTime = 0;
        fireLog();
        setTimeout(() => setHoldProgress(0), 180);
        return;
      }
      holdRef.current.rafId = requestAnimationFrame(tick);
    };
    holdRef.current.rafId = requestAnimationFrame(tick);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!holdRef.current.startTime) return;
    const dx = e.clientX - holdRef.current.startX;
    const dy = e.clientY - holdRef.current.startY;
    if (Math.hypot(dx, dy) > 10) cancelHold();
  };

  const onPointerUp = () => {
    if (holdRef.current.fired) return;
    cancelHold();
  };

  const onPointerCancel = () => {
    if (!holdRef.current.fired) cancelHold();
  };

  const label =
    safeTarget === 1
      ? fullyDone
        ? `${periodLabel} done`
        : `hold to log ${periodLabel}`
      : fullyDone
        ? "hold to log again"
        : `${count}/${safeTarget} · hold to log`;

  const labelColor = fullyDone ? "var(--accent)" : "var(--ink-soft)";

  const SIZE = 84;
  const STROKE = 1.5;
  const PROGRESS_STROKE = 6;
  const R = (SIZE - PROGRESS_STROKE) / 2;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        disabled={isPending}
        aria-pressed={fullyDone}
        aria-label={`Hold to log ${periodLabel}`}
        className="press"
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: "50%",
          background: fullyDone ? "var(--accent)" : "var(--card)",
          border: "none",
          boxSizing: "border-box",
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
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {!fullyDone && (
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth={STROKE}
            />
            {progress > 0 && (
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={PROGRESS_STROKE}
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                strokeLinecap="round"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            )}
          </svg>
        )}
        <span
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            pointerEvents: "none",
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
          maxWidth: 120,
        }}
      >
        {label}
      </div>
      {prompt && (
        <NoteSheet prompt={prompt} onClose={() => setPrompt(null)} />
      )}
    </div>
  );
}
