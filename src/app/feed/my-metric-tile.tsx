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
    if (value < 60) return { number: `${value}m`, unit: "" };
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

// Cycling per-pact metric tile, used as the right-hand slot in the /feed
// your-week stats row. Each tap advances to the next pact that has a metric
// configured. Structured to match its sibling tiles so the number baseline
// and the label line up across all three boxes.
export function MyMetricTile({ metrics }: { metrics: Metric[] }) {
  const [index, setIndex] = useState(0);

  const baseStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 12,
    width: "100%",
    textAlign: "center",
  };

  const numberStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: 28,
    lineHeight: 1,
    color: "var(--ink)",
    fontVariantNumeric: "tabular-nums",
  };

  if (metrics.length === 0) {
    return (
      <div style={baseStyle}>
        <div style={{ ...numberStyle, color: "var(--mute)" }}>—</div>
        <div className="label mt-1.5">no metric</div>
      </div>
    );
  }

  const m = metrics[index % metrics.length];
  const f = formatMetric(m.total, m.metricKind, m.metricName);
  const subtitle = f.unit ? `${m.pactName} · ${f.unit}` : m.pactName;

  return (
    <button
      type="button"
      onClick={() => setIndex((i) => (i + 1) % metrics.length)}
      aria-label={`Your ${f.number}${f.unit ? ` ${f.unit}` : ""} for ${m.pactName} this week. Tap to switch pact.`}
      className="press"
      style={baseStyle}
    >
      <div style={numberStyle}>{f.number}</div>
      <div
        className="label mt-1.5"
        style={{
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={subtitle}
      >
        {subtitle}
      </div>
    </button>
  );
}
