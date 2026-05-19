"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleQuickLog } from "@/app/pacts/actions";

export type TodayPact = {
  id: string;
  name: string;
  icon: string | null;
  frequency: "daily" | "weekly";
  doneThisPeriod: boolean;
};

const PeriodPill = ({ frequency }: { frequency: "daily" | "weekly" }) => (
  <span className="label" style={{ fontSize: 9 }}>
    {frequency === "daily" ? "today" : "this week"}
  </span>
);

export function TodayBand({ pacts }: { pacts: TodayPact[] }) {
  const [optimistic, toggleOptimistic] = useOptimistic<TodayPact[], string>(
    pacts,
    (state, pactId) =>
      state.map((p) =>
        p.id === pactId ? { ...p, doneThisPeriod: !p.doneThisPeriod } : p,
      ),
  );
  const [, startTransition] = useTransition();

  if (optimistic.length === 0) return null;

  const onTap = (pact: TodayPact) => {
    startTransition(async () => {
      toggleOptimistic(pact.id);
      const result = await toggleQuickLog(pact.id);
      if (!result.ok) {
        console.error("toggleQuickLog failed:", result.error);
      }
    });
  };

  return (
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
              onClick={() => onTap(p)}
              aria-pressed={p.doneThisPeriod}
              aria-label={
                p.doneThisPeriod
                  ? `Undo ${p.name} for ${p.frequency === "daily" ? "today" : "this week"}`
                  : `Log ${p.name} for ${p.frequency === "daily" ? "today" : "this week"}`
              }
              className="press flex flex-col items-center gap-1.5"
              style={{ width: 96, touchAction: "pan-x" }}
            >
              <CompletionDisk done={p.doneThisPeriod} icon={p.icon} />
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
              <PeriodPill frequency={p.frequency} />
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
  );
}

function CompletionDisk({
  done,
  icon,
}: {
  done: boolean;
  icon: string | null;
}) {
  return (
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: "50%",
        background: done ? "var(--accent)" : "var(--card)",
        border: done ? "none" : "1.5px solid var(--line-strong)",
        boxShadow: done
          ? "0 8px 20px rgba(216, 98, 58, 0.35)"
          : "0 1px 0 rgba(42, 31, 24, 0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: done ? "#fff" : "var(--mute)",
        position: "relative",
      }}
      aria-hidden
    >
      {done ? (
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
      ) : icon ? (
        <span style={{ fontSize: 32, lineHeight: 1 }}>{icon}</span>
      ) : (
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8.5" strokeDasharray="2 4" />
        </svg>
      )}
    </div>
  );
}
