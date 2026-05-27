"use client";

import { useState } from "react";

type Period = "today" | "week" | "month" | "year" | "all";
type View = "group" | "individuals";

type Completion = {
  user_id: string;
  metric_value: number | null;
  completed_at: string;
};

type MemberLite = {
  user_id: string;
  display_name: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "today" },
  { value: "week", label: "week" },
  { value: "month", label: "month" },
  { value: "year", label: "year" },
  { value: "all", label: "all" },
];

const VIEWS: { value: View; label: string }[] = [
  { value: "group", label: "group" },
  { value: "individuals", label: "individuals" },
];

// Period thresholds in UTC. "all" returns null which the filter treats as
// "no threshold".
function periodStart(period: Period, now: Date): Date | null {
  if (period === "all") return null;
  if (period === "today") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    // Monday-based week: 0=Sun → 6, 1=Mon → 0
    const offset = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - offset);
    return d;
  }
  if (period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function formatMetric(
  total: number,
  kind: "count" | "minutes",
  name: string | null,
): { number: string; unit: string } {
  if (kind === "minutes") {
    if (total < 60) return { number: String(total), unit: "min" };
    const h = Math.floor(total / 60);
    const m = total % 60;
    return {
      number: `${h}h${m > 0 ? ` ${m}m` : ""}`,
      unit: "",
    };
  }
  return {
    number: total.toLocaleString(),
    unit: name ?? "units",
  };
}

export function MetricWidget({
  metricKind,
  metricName,
  completions,
  members,
  currentUserId,
}: {
  metricKind: "count" | "minutes";
  metricName: string | null;
  completions: Completion[];
  members: MemberLite[];
  currentUserId: string | null;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [view, setView] = useState<View>("group");

  const now = new Date();
  const threshold = periodStart(period, now);
  const inRange = completions.filter((c) => {
    if (!threshold) return true;
    return new Date(c.completed_at) >= threshold;
  });

  const total = inRange.reduce((acc, c) => acc + (c.metric_value ?? 0), 0);
  const formatted = formatMetric(total, metricKind, metricName);

  // Per-member totals for the individuals view. Members with zero are still
  // listed so people can see who has not contributed yet this period.
  const perMember = members
    .map((m) => ({
      ...m,
      total: inRange
        .filter((c) => c.user_id === m.user_id)
        .reduce((acc, c) => acc + (c.metric_value ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <section
      className="mx-5 mt-5 p-4"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ChipGroup
          options={PERIODS}
          value={period}
          onChange={setPeriod}
        />
        {members.length > 1 && (
          <ChipGroup options={VIEWS} value={view} onChange={setView} />
        )}
      </div>

      {view === "group" ? (
        <div className="flex items-baseline gap-2">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 44,
              lineHeight: 1,
              color: "var(--ink)",
            }}
          >
            {formatted.number}
          </span>
          {formatted.unit && (
            <span
              className="label"
              style={{ fontSize: 12, color: "var(--ink-soft)" }}
            >
              {formatted.unit}
            </span>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {perMember.map((m) => {
            const isYou = m.user_id === currentUserId;
            const f = formatMetric(m.total, metricKind, metricName);
            return (
              <li
                key={m.user_id}
                className="flex items-baseline justify-between"
                style={{
                  padding: "6px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--ink)" }}>
                  {m.display_name}
                  {isYou && (
                    <span style={{ color: "var(--mute)", marginLeft: 4 }}>
                      · you
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-stat-mono)",
                    fontSize: 14,
                    color: m.total > 0 ? "var(--ink)" : "var(--mute)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {f.number}
                  {f.unit ? ` ${f.unit}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex items-center"
      style={{
        background: "var(--card-inset)",
        border: "1px solid var(--line)",
        borderRadius: 999,
        padding: 2,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className="press"
            style={{
              minHeight: 26,
              padding: "0 10px",
              borderRadius: 999,
              background: on ? "var(--accent)" : "transparent",
              color: on ? "#fff" : "var(--ink-soft)",
              border: "none",
              fontFamily: "var(--font-stat-mono)",
              fontSize: 10.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
