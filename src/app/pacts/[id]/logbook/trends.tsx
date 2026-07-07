"use client";

import { useRef, useState } from "react";
import { Chevron } from "@/components/ui/chevron";

type Completion = {
  completed_at: string;
  metric_value: number | null;
};

type Day = { date: Date; value: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function buildDailySeries(
  completions: Completion[],
  days: number,
  mode: "metric" | "count",
  windowOffset: number,
): Day[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Slide the window back by whole periods of `days`. Offset 0 = the window
  // that ends today; offset 1 = the window ending `days` days before today.
  const windowEnd = new Date(today.getTime() - windowOffset * days * DAY_MS);
  const series: Day[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(windowEnd.getTime() - i * DAY_MS);
    const next = new Date(dayStart.getTime() + DAY_MS);
    const dayCompletions = completions.filter((c) => {
      const t = new Date(c.completed_at);
      return t >= dayStart && t < next;
    });
    const value =
      mode === "metric"
        ? dayCompletions.reduce((acc, c) => acc + (c.metric_value ?? 0), 0)
        : dayCompletions.length;
    series.push({ date: dayStart, value });
  }
  return series;
}

function formatValue(
  v: number,
  kind: "count" | "minutes" | null,
  name: string | null,
): string {
  if (!kind) return String(v);
  if (kind === "minutes") {
    if (v < 60) return `${v}m`;
    const h = Math.floor(v / 60);
    const m = v % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  }
  return `${v.toLocaleString()} ${name ?? ""}`.trim();
}

function startOfDayUTC(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}
function startOfWeekUTC(d: Date): Date {
  const r = startOfDayUTC(d);
  const offset = (r.getUTCDay() + 6) % 7;
  r.setUTCDate(r.getUTCDate() - offset);
  return r;
}
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function startOfYearUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function sumIn(
  completions: Completion[],
  start: Date | null,
  mode: "metric" | "count",
): number {
  return completions
    .filter((c) => !start || new Date(c.completed_at) >= start)
    .reduce(
      (acc, c) => acc + (mode === "metric" ? c.metric_value ?? 0 : 1),
      0,
    );
}

export function Trends({
  completions,
  metricKind,
  metricName,
}: {
  completions: Completion[];
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
}) {
  const days = 30;
  const mode = metricKind ? "metric" : "count";
  const [windowOffset, setWindowOffset] = useState(0);

  // Cap how far back we let the user swipe: no point paginating past the
  // earliest completion. When there is no data we still allow offset 0.
  const earliestMs = completions.reduce<number | null>((acc, c) => {
    const t = new Date(c.completed_at).getTime();
    return acc === null || t < acc ? t : acc;
  }, null);
  const todayMs = (() => {
    const t = new Date();
    t.setUTCHours(0, 0, 0, 0);
    return t.getTime();
  })();
  const maxOffset =
    earliestMs === null
      ? 0
      : Math.max(0, Math.floor((todayMs - earliestMs) / (days * DAY_MS)));

  const series = buildDailySeries(completions, days, mode, windowOffset);
  const max = Math.max(1, ...series.map((d) => d.value));
  const isCurrentWindow = windowOffset === 0;
  const todayValue = isCurrentWindow ? series[series.length - 1]?.value ?? 0 : 0;

  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipeRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Ignore vertical scroll-ish motions so page scrolling still wins.
    if (Math.abs(dy) > Math.abs(dx)) return;
    const THRESHOLD = 40;
    if (dx > THRESHOLD && windowOffset < maxOffset) {
      setWindowOffset((o) => Math.min(maxOffset, o + 1));
    } else if (dx < -THRESHOLD && windowOffset > 0) {
      setWindowOffset((o) => Math.max(0, o - 1));
    }
  };

  const firstDay = series[0].date;
  const lastDay = series[series.length - 1].date;
  const rangeLabel = isCurrentWindow
    ? "last 30 days"
    : `${firstDay.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })} – ${lastDay.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year:
          lastDay.getUTCFullYear() !== new Date().getUTCFullYear()
            ? "numeric"
            : undefined,
      })}`;
  const canGoBack = windowOffset < maxOffset;
  const canGoForward = windowOffset > 0;

  const now = new Date();
  const periodTotals: { label: string; value: string }[] = [
    {
      label: "today",
      value: formatValue(todayValue, metricKind, metricName),
    },
    {
      label: "week",
      value: formatValue(
        sumIn(completions, startOfWeekUTC(now), mode),
        metricKind,
        metricName,
      ),
    },
    {
      label: "month",
      value: formatValue(
        sumIn(completions, startOfMonthUTC(now), mode),
        metricKind,
        metricName,
      ),
    },
    {
      label: "year",
      value: formatValue(
        sumIn(completions, startOfYearUTC(now), mode),
        metricKind,
        metricName,
      ),
    },
    {
      label: "all",
      value: formatValue(
        sumIn(completions, null, mode),
        metricKind,
        metricName,
      ),
    },
  ];

  const HEIGHT = 96;
  const BAR_GAP = 2;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label">{rangeLabel}</span>
        {!isCurrentWindow && (
          <button
            type="button"
            onClick={() => setWindowOffset(0)}
            className="press"
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "none",
              fontFamily: "var(--font-stat-mono)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            back to today
          </button>
        )}
      </div>
      <div
        className="px-3 pt-3 pb-3"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          className="flex items-end justify-between"
          style={{
            height: HEIGHT,
            gap: BAR_GAP,
          }}
        >
          {series.map((d, i) => {
            const h = d.value === 0 ? 2 : (d.value / max) * HEIGHT;
            const isToday = isCurrentWindow && i === series.length - 1;
            return (
              <div
                key={d.date.toISOString()}
                title={`${d.date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}: ${formatValue(d.value, metricKind, metricName)}`}
                style={{
                  flex: 1,
                  height: h,
                  borderRadius: 2,
                  background:
                    d.value === 0
                      ? "var(--line)"
                      : isToday
                        ? "var(--accent)"
                        : "var(--perfect-soft)",
                  border:
                    d.value > 0 && !isToday
                      ? "1px solid var(--perfect)"
                      : "none",
                }}
              />
            );
          })}
        </div>
        <div
          className="mt-1.5 flex items-center justify-between"
          style={{
            fontSize: 9,
            color: "var(--mute)",
            fontFamily: "var(--font-stat-mono)",
            letterSpacing: "0.04em",
          }}
        >
          <button
            type="button"
            onClick={() =>
              canGoBack && setWindowOffset((o) => Math.min(maxOffset, o + 1))
            }
            disabled={!canGoBack}
            aria-label="previous 30 days"
            className="press inline-flex items-center gap-1"
            style={{
              background: "transparent",
              border: "none",
              color: canGoBack ? "var(--ink-soft)" : "var(--mute)",
              opacity: canGoBack ? 1 : 0.35,
              padding: "2px 4px",
              cursor: canGoBack ? "pointer" : "default",
              fontFamily: "inherit",
              fontSize: "inherit",
              letterSpacing: "inherit",
            }}
          >
            <Chevron direction="left" size={10} strokeWidth={2} />
            <span>
              {firstDay.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </button>
          <span>
            {isCurrentWindow
              ? "today"
              : lastDay.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
          </span>
          <button
            type="button"
            onClick={() =>
              canGoForward && setWindowOffset((o) => Math.max(0, o - 1))
            }
            disabled={!canGoForward}
            aria-label="next 30 days"
            className="press inline-flex items-center gap-1"
            style={{
              background: "transparent",
              border: "none",
              color: canGoForward ? "var(--ink-soft)" : "var(--mute)",
              opacity: canGoForward ? 1 : 0.35,
              padding: "2px 4px",
              cursor: canGoForward ? "pointer" : "default",
              fontFamily: "inherit",
              fontSize: "inherit",
              letterSpacing: "inherit",
            }}
          >
            <Chevron direction="right" size={10} strokeWidth={2} />
          </button>
        </div>
        <div
          className="mt-3 grid grid-cols-5 gap-2 pt-3"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          {periodTotals.map((t) => (
            <div key={t.label} className="text-center">
              <div
                className="label"
                style={{ fontSize: 9, color: "var(--mute)" }}
              >
                {t.label}
              </div>
              <div
                className="mt-0.5"
                style={{
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 12,
                  color: "var(--ink)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                }}
                title={t.value}
              >
                {t.value || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
