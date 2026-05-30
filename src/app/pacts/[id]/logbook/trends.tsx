"use client";

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
): Day[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const series: Day[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today.getTime() - i * DAY_MS);
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
  const series = buildDailySeries(completions, days, mode);
  const max = Math.max(1, ...series.map((d) => d.value));
  const todayValue = series[series.length - 1]?.value ?? 0;

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
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">last 30 days</span>
      </div>
      <div
        className="px-3 pt-3 pb-3"
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
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
            const isToday = i === series.length - 1;
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
          className="mt-1.5 flex justify-between"
          style={{
            fontSize: 9,
            color: "var(--mute)",
            fontFamily: "var(--font-stat-mono)",
            letterSpacing: "0.04em",
          }}
        >
          <span>
            {series[0].date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span>today</span>
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
