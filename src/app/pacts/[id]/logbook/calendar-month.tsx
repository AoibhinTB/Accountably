"use client";

import { useState } from "react";

type Completion = {
  completed_at: string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

// 0=Sun-based getUTCDay → convert to 0=Mon-based weekday so the grid
// starts on Monday.
const mondayWeekday = (d: Date) => (d.getUTCDay() + 6) % 7;

function buildGrid(year: number, monthIdx: number) {
  const firstDay = new Date(Date.UTC(year, monthIdx, 1));
  const offset = mondayWeekday(firstDay);
  const start = new Date(firstDay);
  start.setUTCDate(1 - offset);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push(d);
  }
  return cells;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function CalendarMonth({
  completions,
}: {
  completions: Completion[];
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [cursor, setCursor] = useState({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  });

  const completedDays = new Set(
    completions.map((c) => {
      const d = new Date(c.completed_at);
      d.setUTCHours(0, 0, 0, 0);
      return dayKey(d);
    }),
  );

  const cells = buildGrid(cursor.year, cursor.month);
  const todayKey = dayKey(today);

  const goPrev = () => {
    setCursor((c) => {
      const m = c.month - 1;
      if (m < 0) return { year: c.year - 1, month: 11 };
      return { year: c.year, month: m };
    });
  };
  const goNext = () => {
    setCursor((c) => {
      const m = c.month + 1;
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
  };

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="label">calendar</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="press"
            style={navBtnStyle}
          >
            ‹
          </button>
          <span
            style={{
              fontFamily: "var(--font-stat-mono)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ink)",
              minWidth: 110,
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </span>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="press"
            style={navBtnStyle}
          >
            ›
          </button>
        </div>
      </div>
      <div
        className="px-3 py-3"
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <div
          className="grid grid-cols-7 mb-1.5"
          style={{ gap: 4 }}
        >
          {DAY_LABELS.map((l, i) => (
            <div
              key={i}
              className="label text-center"
              style={{ fontSize: 9, color: "var(--mute)" }}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gap: 4 }}>
          {cells.map((d, i) => {
            const inMonth = d.getUTCMonth() === cursor.month;
            const key = dayKey(d);
            const done = completedDays.has(key);
            const isToday = key === todayKey;
            return (
              <div
                key={i}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 8,
                  background: done
                    ? "var(--accent)"
                    : inMonth
                      ? "var(--card-inset)"
                      : "transparent",
                  border: isToday
                    ? "1.5px solid var(--accent)"
                    : "1px solid transparent",
                  color: done
                    ? "#fff"
                    : inMonth
                      ? "var(--ink)"
                      : "var(--mute)",
                  opacity: inMonth ? 1 : 0.35,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                }}
              >
                {d.getUTCDate()}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "var(--card)",
  border: "1px solid var(--line-strong)",
  color: "var(--ink-soft)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  lineHeight: 1,
};
