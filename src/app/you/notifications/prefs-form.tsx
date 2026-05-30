"use client";

import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "../notifications-actions";

type Initial = {
  notif_nudges?: boolean | null;
  notif_checkins?: boolean | null;
  reminders_enabled?: boolean | null;
};

// Global per-type push toggles. Per-pact reminders live on the pact detail
// page (edit-pact dialog) so users can set different times for different
// routines, so this form only owns nudge / check-in opt-outs.
export function PrefsForm({ initial }: { initial: Initial }) {
  const [nudges, setNudges] = useState(initial.notif_nudges ?? true);
  const [checkins, setCheckins] = useState(initial.notif_checkins ?? true);
  const [reminders, setReminders] = useState(
    initial.reminders_enabled ?? true,
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = (patch: {
    notif_nudges?: boolean;
    notif_checkins?: boolean;
    reminders_enabled?: boolean;
  }) => {
    setError(null);
    startTransition(async () => {
      const result = await updateNotificationPrefs(patch);
      if (!result.ok) setError(result.error);
    });
  };

  const toggleNudges = () => {
    const next = !nudges;
    setNudges(next);
    save({ notif_nudges: next });
  };

  const toggleCheckins = () => {
    const next = !checkins;
    setCheckins(next);
    save({ notif_checkins: next });
  };

  const toggleReminders = () => {
    const next = !reminders;
    setReminders(next);
    save({ reminders_enabled: next });
  };

  return (
    <>
      <ul
        className="overflow-hidden"
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <Row label="nudges" hint="when someone nudges you" divider>
          <Switch on={nudges} onClick={toggleNudges} />
        </Row>
        <Row
          label="check-ins"
          hint="when someone in your pact checks in"
          divider
        >
          <Switch on={checkins} onClick={toggleCheckins} />
        </Row>
        <Row
          label="pact reminders"
          hint="master switch — per-pact times still configured on each pact"
        >
          <Switch on={reminders} onClick={toggleReminders} />
        </Row>
      </ul>
      {error && (
        <p
          className="mt-3 text-xs"
          style={{ color: "var(--accent)", textAlign: "center" }}
        >
          {error}
        </p>
      )}
    </>
  );
}

function Row({
  label,
  hint,
  divider,
  children,
}: {
  label: string;
  hint?: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className="flex items-center justify-between p-4 gap-3"
      style={{
        borderBottom: divider ? "1px solid var(--line)" : "none",
        color: "var(--ink)",
      }}
    >
      <div className="min-w-0">
        <div style={{ fontSize: 15 }}>{label}</div>
        {hint && (
          <div
            className="label mt-0.5"
            style={{ fontSize: 10, color: "var(--mute)" }}
          >
            {hint}
          </div>
        )}
      </div>
      {children}
    </li>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="press"
      style={{
        minHeight: 32,
        padding: "0 14px",
        borderRadius: 999,
        background: on ? "var(--accent)" : "transparent",
        color: on ? "var(--card)" : "var(--ink-soft)",
        border: on ? "1px solid var(--accent)" : "1.5px dashed var(--line-strong)",
        fontFamily: "var(--font-stat-mono)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {on ? "on" : "off"}
    </button>
  );
}
