"use client";

import { useState } from "react";

// Pair of radios styled as a segmented toggle. Used inside the pact-detail
// add-a-note form so the user can choose between a public (group-shared)
// or private (logbook-only) note before they submit. A hidden input
// preserves the current value for FormData.
export function VisibilityToggle({
  name = "visibility",
  defaultValue = "public",
}: {
  name?: string;
  defaultValue?: "public" | "private";
}) {
  const [value, setValue] = useState<"public" | "private">(defaultValue);
  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <Chip
        active={value === "public"}
        onClick={() => setValue("public")}
        label="public"
        sublabel="group sees"
      />
      <Chip
        active={value === "private"}
        onClick={() => setValue("private")}
        label="private"
        sublabel="logbook"
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  sublabel,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="press flex-1"
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        background: active ? "var(--accent-soft)" : "var(--card)",
        border: active ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
        color: active ? "var(--accent)" : "var(--ink-soft)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-stat-mono)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-stat-mono)",
          fontSize: 9,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: active ? "var(--accent)" : "var(--mute)",
          marginTop: 2,
          opacity: 0.85,
        }}
      >
        {sublabel}
      </div>
    </button>
  );
}
