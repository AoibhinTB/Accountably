"use client";

import { useState } from "react";

type Metric = {
  pactId: string;
  pactName: string;
  metricKind: "count" | "minutes";
  metricName: string | null;
  total: number;
};

function formatMetric(
  value: number,
  kind: "count" | "minutes",
  name: string | null,
): { number: string; unit: string } {
  if (kind === "minutes") {
    if (value < 60) return { number: String(value), unit: "min" };
    const totalH = Math.floor(value / 60);
    const remM = value % 60;
    if (totalH < 24) {
      return { number: `${totalH}h${remM > 0 ? ` ${remM}m` : ""}`, unit: "" };
    }
    const d = Math.floor(totalH / 24);
    const remH = totalH % 24;
    return { number: `${d}d${remH > 0 ? ` ${remH}h` : ""}`, unit: "" };
  }
  return { number: value.toLocaleString(), unit: name ?? "" };
}

// Cycling per-pact metric tile, used as the middle slot in the /feed
// this-week stats row. Each tap advances to the next pact that has a
// metric configured; the body shows the current user's total for the week
// and the pact name underneath.
export function MyMetricTile({ metrics }: { metrics: Metric[] }) {
  const [index, setIndex] = useState(0);

  const tileStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 12,
    width: "100%",
    minHeight: 86,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  };

  const numberStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: 24,
    lineHeight: 1,
    color: "var(--ink)",
    fontVariantNumeric: "tabular-nums",
  };

  if (metrics.length === 0) {
    return (
      <div style={tileStyle}>
        <div style={{ ...numberStyle, color: "var(--mute)" }}>—</div>
        <div className="label">no metric</div>
      </div>
    );
  }

  const m = metrics[index % metrics.length];
  const f = formatMetric(m.total, m.metricKind, m.metricName);

  return (
    <button
      type="button"
      onClick={() => setIndex((i) => (i + 1) % metrics.length)}
      aria-label={`Your ${f.number}${f.unit ? ` ${f.unit}` : ""} for ${m.pactName} this week. Tap to switch pact.`}
      className="press"
      style={tileStyle}
    >
      <div className="flex items-baseline gap-1" style={{ lineHeight: 1 }}>
        <span style={numberStyle}>{f.number}</span>
        {f.unit && (
          <span
            className="label"
            style={{ fontSize: 9, color: "var(--ink-soft)" }}
          >
            {f.unit}
          </span>
        )}
      </div>
      <div
        className="label"
        style={{
          fontSize: 9,
          color: "var(--mute)",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={m.pactName}
      >
        {m.pactName}
      </div>
      {metrics.length > 1 && (
        <div
          className="label"
          style={{
            fontSize: 8,
            color: "var(--accent)",
            letterSpacing: "0.1em",
            marginTop: 2,
          }}
        >
          ↻ tap
        </div>
      )}
    </button>
  );
}
