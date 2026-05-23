"use client";

import { useState, type ReactNode } from "react";

type Mode = "recent" | "grid";

export function CheckInsViewToggle({
  initialMode = "recent",
  onChange,
}: {
  initialMode?: Mode;
  onChange: (mode: Mode) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const select = (next: Mode) => {
    setMode(next);
    onChange(next);
  };
  return (
    <div
      className="flex items-center gap-1 p-0.5"
      style={{
        background: "var(--card-inset)",
        border: "1px solid var(--line)",
        borderRadius: 999,
      }}
    >
      <ToggleButton on={mode === "recent"} onClick={() => select("recent")}>
        recent
      </ToggleButton>
      <ToggleButton on={mode === "grid"} onClick={() => select("grid")}>
        grid
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        background: on ? "var(--accent)" : "transparent",
        color: on ? "#fff" : "var(--ink-soft)",
        fontFamily: "var(--font-stat-mono)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        transition: "background 120ms, color 120ms",
      }}
    >
      {children}
    </button>
  );
}

// Wraps the section so toggling switches what's shown without re-rendering
// the heavy server-data. Both views are rendered into the DOM; we just flip
// visibility — keeps the swap instant and preserves any inner state.
export function CheckInsView({
  recentView,
  gridView,
}: {
  recentView: ReactNode;
  gridView: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("recent");
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <div className="label">check-ins</div>
        <CheckInsViewToggle initialMode={mode} onChange={setMode} />
      </div>
      <div style={{ display: mode === "recent" ? "block" : "none" }}>
        {recentView}
      </div>
      <div style={{ display: mode === "grid" ? "block" : "none" }}>
        {gridView}
      </div>
    </>
  );
}
