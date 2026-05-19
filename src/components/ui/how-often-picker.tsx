"use client";

import { useState } from "react";

// Day indices: 0 = Mon ... 6 = Sun, matching what we store in the DB.
const EVERY_DAY: number[] = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS: number[] = [0, 1, 2, 3, 4];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type Mode = "every" | "weekdays" | "custom" | "weekly";

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

// Pick the matching mode from an existing pact's data.
const modeFor = (
  frequency: "daily" | "weekly",
  days: number[] | null,
): Mode => {
  if (frequency === "weekly") return "weekly";
  if (!days || days.length === 0) return "every";
  if (sameSet(days, EVERY_DAY)) return "every";
  if (sameSet(days, WEEKDAYS)) return "weekdays";
  return "custom";
};

export function HowOftenPicker({
  defaultFrequency = "daily",
  defaultDays = EVERY_DAY,
  daysName = "days_of_week",
  frequencyName = "frequency",
}: {
  defaultFrequency?: "daily" | "weekly";
  defaultDays?: number[] | null;
  daysName?: string;
  frequencyName?: string;
}) {
  const initial = modeFor(defaultFrequency, defaultDays ?? null);
  const [mode, setMode] = useState<Mode>(initial);
  const [customDays, setCustomDays] = useState<number[]>(
    initial === "custom"
      ? [...(defaultDays ?? [0, 2, 4])].sort((a, b) => a - b)
      : [0, 2, 4],
  );

  // Compute the form's hidden values from the current mode + customDays.
  const { frequency, days } =
    mode === "every"
      ? { frequency: "daily" as const, days: EVERY_DAY }
      : mode === "weekdays"
        ? { frequency: "daily" as const, days: WEEKDAYS }
        : mode === "custom"
          ? { frequency: "daily" as const, days: customDays }
          : { frequency: "weekly" as const, days: [] as number[] };

  const toggleDay = (d: number) => {
    setCustomDays((prev) => {
      const has = prev.includes(d);
      const next = has ? prev.filter((x) => x !== d) : [...prev, d];
      // At least one day must be picked; if user tries to clear the last
      // one we keep the previous selection.
      return next.length === 0 ? prev : next.sort((a, b) => a - b);
    });
  };

  return (
    <fieldset style={{ minWidth: 0 }}>
      <legend className="label">how often</legend>
      <input type="hidden" name={frequencyName} value={frequency} />
      <input type="hidden" name={daysName} value={days.join(",")} />

      <div className="mt-2 flex flex-col gap-2">
        <OptionCard
          selected={mode === "every"}
          onClick={() => setMode("every")}
          title="every day"
          subtitle="7 days a week"
        />
        <OptionCard
          selected={mode === "weekdays"}
          onClick={() => setMode("weekdays")}
          title="weekdays"
          subtitle="mon — fri"
        />
        <OptionCard
          selected={mode === "weekly"}
          onClick={() => setMode("weekly")}
          title="once a week"
          subtitle="any day counts"
        />
        <OptionCard
          selected={mode === "custom"}
          onClick={() => setMode("custom")}
          title="custom"
          subtitle="pick your days"
        />
      </div>

      {mode === "custom" && (
        <div className="mt-3 flex gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const on = customDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={on}
                aria-label={`${on ? "Remove" : "Add"} ${DAY_FULL[i]}`}
                className="press"
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: "var(--radius-sm)",
                  background: on ? "var(--accent)" : "var(--card-inset)",
                  color: on ? "#fff" : "var(--ink)",
                  border: on
                    ? "1.5px solid var(--accent)"
                    : "1.5px solid var(--line)",
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="press flex items-center justify-between"
      style={{
        padding: "16px 18px",
        borderRadius: "var(--radius)",
        background: selected ? "var(--accent-soft)" : "var(--card)",
        border: selected
          ? "1.5px solid var(--accent)"
          : "1px solid var(--line)",
        textAlign: "left",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            lineHeight: 1.05,
            color: "var(--ink)",
          }}
        >
          {title}
        </div>
        <div className="label mt-1">{subtitle}</div>
      </div>
      <div
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: selected ? "var(--accent)" : "transparent",
          border: selected ? "none" : "1.5px dashed var(--line-strong)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {selected && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}
