"use client";

import { useState } from "react";

// Three options for what a pact wants tracked. "none" emits empty hidden
// fields so the server stores null — i.e. the pact has no metric and the
// aggregator widget is hidden. "count" carries a user-defined label like
// "pages" or "reps". "minutes" stores duration as whole-minute integers,
// formatted on display.
type Kind = "none" | "count" | "minutes";

const kindFor = (
  defaultKind: string | null | undefined,
): Kind => {
  if (defaultKind === "count") return "count";
  if (defaultKind === "minutes") return "minutes";
  return "none";
};

export function MetricPicker({
  defaultKind = null,
  defaultName = null,
  defaultValue = null,
  kindFieldName = "metric_kind",
  nameFieldName = "metric_name",
  defaultValueFieldName = "default_metric_value",
}: {
  defaultKind?: string | null;
  defaultName?: string | null;
  defaultValue?: number | null;
  kindFieldName?: string;
  nameFieldName?: string;
  defaultValueFieldName?: string;
}) {
  const [kind, setKind] = useState<Kind>(kindFor(defaultKind));
  const [countName, setCountName] = useState(defaultName ?? "");
  const [defaultVal, setDefaultVal] = useState(
    defaultValue !== null && defaultValue !== undefined
      ? String(defaultValue)
      : "",
  );

  // Compute the hidden form values from current state. For count we send
  // the user-entered label; minutes always uses "minutes" so the server
  // has a non-null display name in case anything reads it directly.
  const submittedKind = kind === "none" ? "" : kind;
  const submittedName =
    kind === "count" ? countName : kind === "minutes" ? "minutes" : "";
  const submittedDefault = kind === "none" ? "" : defaultVal;

  return (
    <fieldset style={{ minWidth: 0 }}>
      <legend className="label">metric (optional)</legend>
      <input type="hidden" name={kindFieldName} value={submittedKind} />
      <input type="hidden" name={nameFieldName} value={submittedName} />
      <input
        type="hidden"
        name={defaultValueFieldName}
        value={submittedDefault}
      />

      <div className="mt-2 flex flex-col gap-2">
        <OptionCard
          selected={kind === "none"}
          onClick={() => setKind("none")}
          title="none"
          subtitle="just track whether you check in"
        />
        <OptionCard
          selected={kind === "count"}
          onClick={() => setKind("count")}
          title="count"
          subtitle="e.g. pages, reps, miles"
        />
        {kind === "count" && (
          <label className="block pl-3">
            <span className="label">unit name</span>
            <input
              type="text"
              value={countName}
              onChange={(e) => setCountName(e.target.value)}
              maxLength={30}
              placeholder="pages"
              required
              className="mt-1.5 w-full outline-none"
              style={{
                height: 44,
                background: "var(--card-inset)",
                border: "1.5px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "0 14px",
                fontSize: 15,
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
              }}
            />
          </label>
        )}
        <OptionCard
          selected={kind === "minutes"}
          onClick={() => setKind("minutes")}
          title="minutes"
          subtitle="time spent on the habit"
        />
      </div>

      {kind !== "none" && (
        <label className="mt-3 block">
          <span className="label">
            default value <span style={{ opacity: 0.6 }}>(optional)</span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={defaultVal}
            onChange={(e) => setDefaultVal(e.target.value)}
            placeholder="0"
            className="mt-1.5 w-full outline-none"
            style={{
              height: 44,
              background: "var(--card-inset)",
              border: "1.5px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "0 14px",
              fontSize: 15,
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
            }}
          />
          <span
            className="label mt-1.5 block"
            style={{ fontSize: 10, color: "var(--mute)" }}
          >
            applied to every check-in unless you enter a different value
          </span>
        </label>
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
        padding: "14px 16px",
        borderRadius: "var(--radius)",
        background: selected ? "var(--accent-soft)" : "var(--card-inset)",
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
            fontSize: 19,
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
          width: 22,
          height: 22,
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
            width="12"
            height="12"
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
