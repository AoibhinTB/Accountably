"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { toggleQuickLog } from "@/app/pacts/actions";
import { NoteSheet, type NoteSheetPrompt } from "@/components/note-sheet";
import { timeAgo } from "@/lib/period";

// Hold this long to log a check-in. Pointer-up before START_TAP_MS fires
// a tap (navigates to the pact); anywhere between START_TAP_MS and HOLD_MS
// is a cancelled hold. The fill ring stays at zero for the first
// START_TAP_MS so a quick tap never shows any progress.
const HOLD_MS = 850;
const START_TAP_MS = 200;

export type TodayPact = {
  id: string;
  name: string;
  icon: string | null;
  frequency: "daily" | "weekly";
  myCount: number;
  target: number;
  // ISO timestamp of the most recent nudge I've received in this period for
  // this pact's challenge, or null. Cleared when I check in.
  nudgedAt: string | null;
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
};

type NotePrompt = NoteSheetPrompt;

const PeriodPill = ({
  frequency,
  nudgedAt,
}: {
  frequency: "daily" | "weekly";
  nudgedAt: string | null;
}) => {
  if (nudgedAt) {
    return (
      <span
        className="label"
        style={{ fontSize: 9, color: "var(--accent)", fontWeight: 600 }}
      >
        nudged · {timeAgo(nudgedAt)}
      </span>
    );
  }
  return (
    <span className="label" style={{ fontSize: 9 }}>
      {frequency === "daily" ? "today" : "this week"}
    </span>
  );
};

export function TodayBand({ pacts }: { pacts: TodayPact[] }) {
  // Optimistic reducer mirrors the server behaviour: once myCount reaches
  // the target, the next tap wraps back to 0; otherwise we add one. Same
  // logic works for single-target pacts (target=1).
  const [optimistic, applyOptimistic] = useOptimistic<TodayPact[], string>(
    pacts,
    (state, pactId) =>
      state.map((p) => {
        if (p.id !== pactId) return p;
        const target = Math.max(1, p.target);
        const nextCount = p.myCount >= target ? 0 : p.myCount + 1;
        return { ...p, myCount: nextCount };
      }),
  );
  const [, startTransition] = useTransition();
  const [prompt, setPrompt] = useState<NotePrompt | null>(null);
  const router = useRouter();

  if (optimistic.length === 0) return null;

  const fireLog = (pact: TodayPact) => {
    startTransition(async () => {
      applyOptimistic(pact.id);
      const result = await toggleQuickLog(pact.id);
      if (!result.ok) {
        console.error("toggleQuickLog failed:", result.error);
        return;
      }
      if (result.done) {
        setPrompt({
          pactName: pact.name,
          completionId: result.completionId,
          metricKind: pact.metricKind,
          metricName: pact.metricName,
        });
      }
    });
  };

  const navigate = (pact: TodayPact) => {
    router.push(`/pacts/${pact.id}`);
  };

  // Hold state: which pact is being held and how far along (0..1). Stays
  // null when no hold is active. State lives at the band level so we can
  // only hold one pact at a time and the right cell gets the animated fill.
  const [hold, setHold] = useState<{ pactId: string; progress: number } | null>(
    null,
  );
  const holdRef = useRef({
    startTime: 0,
    startX: 0,
    startY: 0,
    rafId: 0,
    fired: false,
    pactId: "",
  });
  const cancelHold = () => {
    if (holdRef.current.rafId) {
      cancelAnimationFrame(holdRef.current.rafId);
      holdRef.current.rafId = 0;
    }
    holdRef.current.startTime = 0;
    setHold(null);
  };

  const onPointerDown = (e: React.PointerEvent, pact: TodayPact) => {
    holdRef.current.startTime = performance.now();
    holdRef.current.startX = e.clientX;
    holdRef.current.startY = e.clientY;
    holdRef.current.fired = false;
    holdRef.current.pactId = pact.id;
    setHold({ pactId: pact.id, progress: 0 });
    const tick = () => {
      if (!holdRef.current.startTime) return;
      const elapsed = performance.now() - holdRef.current.startTime;
      // No fill until we are past the tap window; then ramp linearly to 1
      // by the time HOLD_MS is reached.
      const progress =
        elapsed <= START_TAP_MS
          ? 0
          : Math.min((elapsed - START_TAP_MS) / (HOLD_MS - START_TAP_MS), 1);
      setHold({ pactId: pact.id, progress });
      if (progress >= 1 && !holdRef.current.fired) {
        holdRef.current.fired = true;
        holdRef.current.startTime = 0;
        fireLog(pact);
        // Drop the hold overlay a moment after the log fires so the count
        // updates from the server have a chance to land.
        setTimeout(() => setHold(null), 180);
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
    if (Math.hypot(dx, dy) > 10) {
      cancelHold();
    }
  };

  const onPointerUp = (pact: TodayPact) => {
    if (holdRef.current.fired) return;
    const elapsed = performance.now() - holdRef.current.startTime;
    cancelHold();
    if (elapsed > 0 && elapsed < START_TAP_MS) {
      navigate(pact);
    }
  };

  const onPointerCancel = () => {
    if (!holdRef.current.fired) cancelHold();
  };

  return (
    <>
      <section className="mb-7">
        <div className="label mb-2">today</div>
        <ul
          className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
          style={{
            scrollPaddingLeft: 20,
            touchAction: "pan-x",
            overscrollBehaviorX: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {optimistic.map((p) => (
            <li key={p.id} className="snap-start" style={{ flex: "0 0 auto" }}>
              <button
                type="button"
                onPointerDown={(e) => onPointerDown(e, p)}
                onPointerMove={onPointerMove}
                onPointerUp={() => onPointerUp(p)}
                onPointerCancel={onPointerCancel}
                onPointerLeave={onPointerCancel}
                aria-pressed={p.myCount >= p.target}
                aria-label={`${p.name} — tap to open, hold to log for ${p.frequency === "daily" ? "today" : "this week"}`}
                className="press flex flex-col items-center gap-1.5"
                style={{
                  width: 96,
                  touchAction: "pan-x",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <CompletionDisk
                  count={p.myCount}
                  target={p.target}
                  icon={p.icon}
                  nudged={!!p.nudgedAt}
                  holdProgress={hold?.pactId === p.id ? hold.progress : 0}
                />
                <div
                  className="w-full truncate text-center"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink)",
                    lineHeight: 1.2,
                  }}
                  title={p.name}
                >
                  {p.name}
                </div>
                <PeriodPill frequency={p.frequency} nudgedAt={p.nudgedAt} />
              </button>
            </li>
          ))}
          <li className="snap-start" style={{ flex: "0 0 auto" }}>
            <Link
              href="/pacts"
              className="press flex flex-col items-center gap-1.5"
              style={{ width: 96, touchAction: "pan-x" }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  border: "1.5px dashed var(--line-strong)",
                  background: "transparent",
                  color: "var(--mute)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  lineHeight: 1,
                }}
                aria-hidden
              >
                +
              </div>
              <div
                className="text-center"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink-soft)",
                  lineHeight: 1.2,
                }}
              >
                new pact
              </div>
              <span className="label" style={{ fontSize: 9, visibility: "hidden" }}>
                .
              </span>
            </Link>
          </li>
        </ul>
      </section>

      {prompt && (
        <NoteSheet
          prompt={prompt}
          onClose={() => setPrompt(null)}
        />
      )}
    </>
  );
}


function CompletionDisk({
  count,
  target,
  icon,
  nudged,
  holdProgress = 0,
}: {
  count: number;
  target: number;
  icon: string | null;
  nudged: boolean;
  holdProgress?: number;
}) {
  const safeTarget = Math.max(1, target);
  const filled = Math.min(count, safeTarget);
  const baseProgress = filled / safeTarget;
  // Holding adds one slice (1/target) on top of the current progress, so
  // the ring visibly grows as the user holds. The actual count update
  // arrives from the server when the hold completes and the log fires.
  const progress = Math.min(1, baseProgress + holdProgress / safeTarget);
  const fullyDone = filled >= safeTarget;

  const SIZE = 76;
  const STROKE = 1.5;
  const PROGRESS_STROKE = 6;
  const R = (SIZE - PROGRESS_STROKE) / 2;
  const C = 2 * Math.PI * R;

  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        background: fullyDone ? "var(--accent)" : "var(--card)",
        // Outline lives in the SVG so it shares a coordinate space with the
        // progress arc — no CSS border to offset the absolutely-positioned
        // SVG against.
        border: "none",
        boxSizing: "border-box",
        boxShadow: fullyDone
          ? "0 8px 20px rgba(216, 98, 58, 0.35)"
          : "0 1px 0 rgba(42, 31, 24, 0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: fullyDone ? "#fff" : "var(--mute)",
        position: "relative",
      }}
      aria-hidden
    >
      {!fullyDone && (
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
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
      {fullyDone ? (
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      ) : (
        <span
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink)",
          }}
        >
          {icon ? (
            <span
              style={{
                fontSize: 30,
                lineHeight: 1,
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                pointerEvents: "none",
              }}
            >
              {icon}
            </span>
          ) : (
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--mute)" }}
            >
              <circle cx="12" cy="12" r="8.5" strokeDasharray="2 4" />
            </svg>
          )}
        </span>
      )}
      {nudged && !fullyDone && (
        <span
          aria-label="You've been nudged"
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid var(--bg)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          !
        </span>
      )}
    </div>
  );
}
