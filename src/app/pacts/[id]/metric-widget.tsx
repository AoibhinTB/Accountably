"use client";

import { useState } from "react";

type Period = "today" | "week" | "month" | "year" | "all";

type Completion = {
  user_id: string;
  metric_value: number | null;
  completed_at: string;
};

type MemberLite = {
  user_id: string;
  display_name: string;
};

const PERIOD_ORDER: Period[] = ["today", "week", "month", "year", "all"];
const PERIOD_LABEL: Record<Period, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  year: "this year",
  all: "all time",
};

function nextPeriod(p: Period): Period {
  const i = PERIOD_ORDER.indexOf(p);
  return PERIOD_ORDER[(i + 1) % PERIOD_ORDER.length];
}

// Period thresholds in UTC. "all" returns null which the filter treats as
// no threshold.
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
    return { number: `${h}h${m > 0 ? ` ${m}m` : ""}`, unit: "" };
  }
  return { number: total.toLocaleString(), unit: name ?? "units" };
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
  const [showBreakdown, setShowBreakdown] = useState(false);
  const multiMember = members.length > 1;

  const now = new Date();
  const threshold = periodStart(period, now);
  const inRange = completions.filter((c) => {
    if (!threshold) return true;
    return new Date(c.completed_at) >= threshold;
  });

  const total = inRange.reduce((acc, c) => acc + (c.metric_value ?? 0), 0);
  const formatted = formatMetric(total, metricKind, metricName);

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
      className="mx-5 mt-5 px-4 py-3"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
      }}
    >
      <button
        type="button"
        onClick={() => setPeriod(nextPeriod(period))}
        aria-label={`Period: ${PERIOD_LABEL[period]}. Tap to change.`}
        className="press w-full text-left"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "block",
        }}
      >
        <div className="flex items-baseline gap-1.5">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              lineHeight: 1,
              color: "var(--ink)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatted.number}
          </span>
          {formatted.unit && (
            <span
              className="label"
              style={{ fontSize: 11, color: "var(--ink-soft)" }}
            >
              {formatted.unit}
            </span>
          )}
        </div>
        <div
          className="label mt-1"
          style={{ fontSize: 10, color: "var(--mute)" }}
        >
          {PERIOD_LABEL[period]}
        </div>
      </button>

      {multiMember && (
        <>
          {showBreakdown && (
            <ul className="mt-3 flex flex-col">
              {perMember.map((m, i) => {
                const isYou = m.user_id === currentUserId;
                const f = formatMetric(m.total, metricKind, metricName);
                return (
                  <li
                    key={m.user_id}
                    className="flex items-baseline justify-between"
                    style={{
                      padding: "5px 0",
                      borderBottom:
                        i < perMember.length - 1
                          ? "1px solid var(--line)"
                          : "none",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--ink)" }}>
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
                        fontSize: 13,
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
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowBreakdown((v) => !v)}
              className="press"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "var(--mute)",
                fontFamily: "var(--font-stat-mono)",
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              {showBreakdown ? "hide" : "by member"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
