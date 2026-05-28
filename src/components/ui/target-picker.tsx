"use client";

import { useState } from "react";

const MIN = 1;
const MAX = 24;

// Stepper for "how many check-ins count as done per period". Default 1 (the
// existing single-tap behaviour). When the value is > 1 the pact switches to
// append-only check-ins and the circles / grid fill proportionally.
export function TargetPicker({
  defaultValue = 1,
  name = "target_per_period",
}: {
  defaultValue?: number;
  name?: string;
}) {
  const [value, setValue] = useState(
    Math.min(MAX, Math.max(MIN, defaultValue || 1)),
  );

  const dec = () => setValue((v) => Math.max(MIN, v - 1));
  const inc = () => setValue((v) => Math.min(MAX, v + 1));

  return (
    <fieldset style={{ minWidth: 0 }}>
      <legend className="label">times per period</legend>
      <input type="hidden" name={name} value={value} />
      <div className="mt-2 flex items-center gap-3">
        <StepperButton onClick={dec} disabled={value <= MIN} ariaLabel="Decrease">
          −
        </StepperButton>
        <div
          className="flex-1 text-center"
          style={{
            background: "var(--card)",
            border: "1.5px solid var(--line)",
            borderRadius: "var(--radius)",
            padding: "10px 0",
            fontFamily: "var(--font-display)",
            fontSize: 26,
            lineHeight: 1.1,
            color: "var(--ink)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
          <span
            className="label ml-1"
            style={{ fontSize: 11, color: "var(--ink-soft)" }}
          >
            ×
          </span>
        </div>
        <StepperButton onClick={inc} disabled={value >= MAX} ariaLabel="Increase">
          +
        </StepperButton>
      </div>
      <p
        className="label mt-2"
        style={{ fontSize: 10, color: "var(--mute)" }}
      >
        {value === 1
          ? "single check-in per period"
          : `${value} check-ins count as done; the disc fills 1/${value} each time`}
      </p>
    </fieldset>
  );
}

function StepperButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="press"
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "var(--card)",
        border: "1.5px solid var(--line-strong)",
        color: "var(--ink)",
        fontFamily: "var(--font-display)",
        fontSize: 22,
        lineHeight: 1,
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
