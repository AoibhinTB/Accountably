"use client";

import { useEffect, useState } from "react";

export type CalendarCompletion = {
  id: string;
  completed_at: string;
  note: string | null;
  private_note: string | null;
  metric_value: number | null;
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

function formatMetric(
  total: number,
  kind: "count" | "minutes" | null,
  name: string | null,
): string {
  if (!kind) return String(total);
  if (kind === "minutes") {
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h < 24) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d${rh > 0 ? ` ${rh}h` : ""}`;
  }
  return `${total.toLocaleString()} ${name ?? "units"}`.trim();
}

export function CalendarMonth({
  completions,
  metricKind,
  metricName,
}: {
  completions: CalendarCompletion[];
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [cursor, setCursor] = useState({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const completionsByDay = new Map<string, CalendarCompletion[]>();
  for (const c of completions) {
    const d = new Date(c.completed_at);
    d.setUTCHours(0, 0, 0, 0);
    const k = dayKey(d);
    const list = completionsByDay.get(k) ?? [];
    list.push(c);
    completionsByDay.set(k, list);
  }

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
        <div className="grid grid-cols-7 mb-1.5" style={{ gap: 4 }}>
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
            const dayCompletions = completionsByDay.get(key) ?? [];
            const done = dayCompletions.length > 0;
            const isToday = key === todayKey;
            const tappable = done;
            const cellStyle: React.CSSProperties = {
              aspectRatio: "1 / 1",
              borderRadius: 8,
              background: done
                ? isToday
                  ? "var(--accent)"
                  : "var(--perfect)"
                : inMonth
                  ? "var(--card-inset)"
                  : "transparent",
              border:
                isToday && !done
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
              cursor: tappable ? "pointer" : "default",
              padding: 0,
            };

            if (!tappable) {
              return (
                <div key={i} style={cellStyle}>
                  {d.getUTCDate()}
                </div>
              );
            }
            return (
              <button
                type="button"
                key={i}
                onClick={() => setSelected(key)}
                aria-label={`See ${d.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })} details`}
                style={cellStyle}
              >
                {d.getUTCDate()}
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <DayDetailSheet
          dateKey={selected}
          completions={completionsByDay.get(selected) ?? []}
          metricKind={metricKind}
          metricName={metricName}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function DayDetailSheet({
  dateKey,
  completions,
  metricKind,
  metricName,
  onClose,
}: {
  dateKey: string;
  completions: CalendarCompletion[];
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const date = new Date(`${dateKey}T00:00:00Z`);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const checkIns = completions.length;
  const metricTotal = completions.reduce(
    (acc, c) => acc + (c.metric_value ?? 0),
    0,
  );
  const notes = completions
    .flatMap((c) => {
      const out: { id: string; body: string; visibility: "public" | "private" }[] = [];
      if (c.note && c.note.trim().length > 0) {
        out.push({ id: `${c.id}-pub`, body: c.note, visibility: "public" });
      }
      if (c.private_note && c.private_note.trim().length > 0) {
        out.push({
          id: `${c.id}-priv`,
          body: c.private_note,
          visibility: "private",
        });
      }
      return out;
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${dateLabel}`}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(42, 31, 24, 0.32)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: "12px 22px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          boxShadow: "0 -8px 30px rgba(42, 31, 24, 0.18)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            aria-hidden
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              background: "var(--line-strong)",
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              color: "var(--mute)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              lineHeight: 1,
              border: "none",
            }}
          >
            ×
          </button>
        </div>

        <div className="label">your day</div>
        <h2
          className="m-0 mt-1 mb-4"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            lineHeight: 1.1,
            color: "var(--ink)",
          }}
        >
          {dateLabel}
        </h2>

        <ul
          className="mb-4 overflow-hidden"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <li
            className="flex items-baseline justify-between p-3"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <span className="label">check-ins</span>
            <span
              style={{
                fontFamily: "var(--font-stat-mono)",
                fontSize: 14,
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {checkIns}
            </span>
          </li>
          {metricKind && (
            <li className="flex items-baseline justify-between p-3">
              <span className="label">
                {metricKind === "minutes" ? "minutes" : metricName ?? "metric"}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 14,
                  color: metricTotal > 0 ? "var(--ink)" : "var(--mute)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {metricTotal > 0
                  ? formatMetric(metricTotal, metricKind, metricName)
                  : "—"}
              </span>
            </li>
          )}
        </ul>

        {notes.length > 0 && (
          <div>
            <div className="label mb-2">notes</div>
            <ul className="flex flex-col gap-2">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="p-3"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <span
                    className="label"
                    style={{
                      fontSize: 9,
                      padding: "1px 8px",
                      borderRadius: 999,
                      background:
                        n.visibility === "private"
                          ? "var(--card-inset)"
                          : "var(--accent-soft)",
                      color:
                        n.visibility === "private"
                          ? "var(--ink-soft)"
                          : "var(--accent)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {n.visibility}
                  </span>
                  <p
                    className="mt-2 whitespace-pre-wrap"
                    style={{
                      fontSize: 14,
                      color: "var(--ink)",
                      lineHeight: 1.4,
                      paddingLeft: 10,
                      borderLeft: `2px solid ${
                        n.visibility === "private"
                          ? "var(--line-strong)"
                          : "var(--accent)"
                      }`,
                    }}
                  >
                    {n.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
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
