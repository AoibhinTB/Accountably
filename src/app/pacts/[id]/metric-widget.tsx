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
    const totalH = Math.floor(total / 60);
    const remM = total % 60;
    if (totalH < 24) {
      return { number: `${totalH}h${remM > 0 ? ` ${remM}m` : ""}`, unit: "" };
    }
    const d = Math.floor(totalH / 24);
    const remH = totalH % 24;
    return { number: `${d}d${remH > 0 ? ` ${remH}h` : ""}`, unit: "" };
  }
  return { number: total.toLocaleString(), unit: name ?? "units" };
}

// Compact inline metric, designed to sit beside the pact circle. The big
// number itself is the tap-to-cycle period control; period reads as a small
// caption underneath. The by-member breakdown is hosted by a sibling node
// below the circle row — see MetricBreakdown.
export function MetricInline({
  metricKind,
  metricName,
  completions,
  period,
  onCyclePeriod,
}: {
  metricKind: "count" | "minutes";
  metricName: string | null;
  completions: Completion[];
  period: Period;
  onCyclePeriod: () => void;
}) {
  const now = new Date();
  const threshold = periodStart(period, now);
  const inRange = completions.filter((c) => {
    if (!threshold) return true;
    return new Date(c.completed_at) >= threshold;
  });
  const total = inRange.reduce((acc, c) => acc + (c.metric_value ?? 0), 0);
  const formatted = formatMetric(total, metricKind, metricName);

  return (
    <button
      type="button"
      onClick={onCyclePeriod}
      aria-label={`Group total for ${PERIOD_LABEL[period]}. Tap to change period.`}
      className="press text-left"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        display: "block",
        minWidth: 0,
      }}
    >
      <div
        className="label"
        style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.12em" }}
      >
        group total
      </div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 30,
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
  );
}

// Optional per-member breakdown that lives below the circle/metric row when
// expanded. Compact list; only meaningful for multi-member pacts (the parent
// already gates rendering).
export function MetricBreakdown({
  metricKind,
  metricName,
  completions,
  members,
  period,
  currentUserId,
  show,
  onToggle,
}: {
  metricKind: "count" | "minutes";
  metricName: string | null;
  completions: Completion[];
  members: MemberLite[];
  period: Period;
  currentUserId: string | null;
  show: boolean;
  onToggle: () => void;
}) {
  const now = new Date();
  const threshold = periodStart(period, now);
  const inRange = completions.filter((c) => {
    if (!threshold) return true;
    return new Date(c.completed_at) >= threshold;
  });
  const perMember = members
    .map((m) => ({
      ...m,
      total: inRange
        .filter((c) => c.user_id === m.user_id)
        .reduce((acc, c) => acc + (c.metric_value ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="mt-2 px-5 flex flex-col items-end">
      <button
        type="button"
        onClick={onToggle}
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
        {show ? "hide" : "by member"}
      </button>
      {show && (
        <ul className="mt-2 w-full flex flex-col">
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
                    i < perMember.length - 1 ? "1px solid var(--line)" : "none",
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
    </div>
  );
}

// Drives the circle-row pair: inline metric sits alongside the circle (via
// the `circle` prop), and the breakdown expands below in a sibling node.
// The metric is wrapped in a soft-tinted box that lines up next to the
// circle and visually balances the row.
export function MetricSideBySide({
  metricKind,
  metricName,
  completions,
  members,
  currentUserId,
  circle,
}: {
  metricKind: "count" | "minutes";
  metricName: string | null;
  completions: Completion[];
  members: MemberLite[];
  currentUserId: string | null;
  circle: React.ReactNode;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [showBreakdown, setShowBreakdown] = useState(false);
  return (
    <>
      <div className="flex items-stretch justify-evenly">
        {circle}
        <div
          className="flex items-center px-4"
          style={{
            background: "var(--card)",
            border: "1.5px solid var(--accent-soft)",
            borderRadius: "var(--radius)",
          }}
        >
          <MetricInline
            metricKind={metricKind}
            metricName={metricName}
            completions={completions}
            period={period}
            onCyclePeriod={() => setPeriod(nextPeriod(period))}
          />
        </div>
      </div>
      {members.length > 1 && (
        <MetricBreakdown
          metricKind={metricKind}
          metricName={metricName}
          completions={completions}
          members={members}
          period={period}
          currentUserId={currentUserId}
          show={showBreakdown}
          onToggle={() => setShowBreakdown((v) => !v)}
        />
      )}
    </>
  );
}

