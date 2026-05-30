"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveNoteInline } from "@/app/pacts/actions";

export type NoteSheetPrompt = {
  pactName: string;
  completionId: string;
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
  // Optional human-readable date for the check-in this note belongs to.
  // When set, it sits as a prominent eyebrow so the user can tell the note
  // is attached to that specific day (the grid path opens this for a
  // backdated check-in).
  dateLabel?: string;
};

export function NoteSheet({
  prompt,
  onClose,
}: {
  prompt: NoteSheetPrompt;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [metric, setMetric] = useState("");
  const [isSaving, startSaving] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMetric = !!prompt.metricKind;
  const metricLabel =
    prompt.metricKind === "minutes" ? "minutes" : prompt.metricName ?? "units";

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onSave = () => {
    const trimmed = note.trim();
    const parsedMetric =
      metric.trim() === "" ? undefined : Math.max(0, parseInt(metric, 10));
    const validMetric =
      parsedMetric === undefined || Number.isFinite(parsedMetric)
        ? parsedMetric
        : undefined;
    if (!trimmed && validMetric === undefined) {
      onClose();
      return;
    }
    startSaving(async () => {
      const result = await saveNoteInline(
        prompt.completionId,
        trimmed || null,
        validMetric,
      );
      if (!result.ok) {
        console.error("saveNoteInline failed:", result.error);
      }
      onClose();
    });
  };

  const eyebrow = prompt.dateLabel
    ? `logged · ${prompt.dateLabel}`
    : "logged";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add a note for ${prompt.pactName}${
        prompt.dateLabel ? ` on ${prompt.dateLabel}` : ""
      }`}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: "rgba(42, 31, 24, 0.32)",
        animation: "sheet-backdrop 200ms ease-out",
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes sheet-backdrop {
          from { background: rgba(42, 31, 24, 0); }
          to { background: rgba(42, 31, 24, 0.32); }
        }
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: "12px 22px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          boxShadow: "0 -8px 30px rgba(42, 31, 24, 0.18)",
          animation: "sheet-slide-up 240ms cubic-bezier(.2,.7,.4,1)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            aria-hidden
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              background: "var(--line-strong)",
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              color: "var(--mute)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              lineHeight: 1,
              border: "none",
            }}
          >
            ×
          </button>
        </div>

        <div
          className="label"
          style={prompt.dateLabel ? { color: "var(--accent)" } : undefined}
        >
          {eyebrow}
        </div>
        <h2
          className="m-0 mt-1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            lineHeight: 1.05,
            color: "var(--ink)",
          }}
        >
          {prompt.pactName}
        </h2>
        <p
          className="mt-2"
          style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.4 }}
        >
          {prompt.dateLabel
            ? `note attached to your ${prompt.dateLabel} check-in`
            : "leave a note for the group? totally optional."}
        </p>

        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="how did it go?"
          className="mt-3 w-full resize-none outline-none"
          style={{
            background: "var(--card)",
            border: "1.5px solid var(--line)",
            borderRadius: "var(--radius)",
            padding: 14,
            fontSize: 16,
            color: "var(--ink)",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
          }}
        />

        {hasMetric && (
          <label className="mt-3 block">
            <span className="label">{metricLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="0"
              className="mt-1.5 w-full outline-none"
              style={{
                height: 48,
                background: "var(--card)",
                border: "1.5px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "0 14px",
                fontSize: 16,
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
              }}
            />
          </label>
        )}

        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="press flex-1"
            style={{
              minHeight: 48,
              background: "transparent",
              color: "var(--ink-soft)",
              borderRadius: "var(--radius)",
              border: "1.5px solid var(--line-strong)",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            skip
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || (!note.trim() && !metric.trim())}
            className="press flex-1 disabled:opacity-50"
            style={{
              minHeight: 48,
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius)",
              border: "none",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {isSaving ? "saving…" : "save note"}
          </button>
        </div>
      </div>
    </div>
  );
}
