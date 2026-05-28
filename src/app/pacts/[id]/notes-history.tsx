"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { saveNoteInline } from "../actions";
import { noteTimestamp } from "@/lib/period";

type Note = {
  id: string;
  user_id: string;
  display_name: string;
  completed_at: string;
  note: string;
  metric_value: number | null;
};

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatMetric(
  value: number,
  kind: "count" | "minutes",
  name: string | null,
): string {
  if (kind === "minutes") {
    if (value < 60) return `${value} min`;
    const totalH = Math.floor(value / 60);
    const remM = value % 60;
    if (totalH < 24) {
      return `${totalH}h${remM > 0 ? ` ${remM}m` : ""}`;
    }
    const d = Math.floor(totalH / 24);
    const remH = totalH % 24;
    return `${d}d${remH > 0 ? ` ${remH}h` : ""}`;
  }
  return `${value} ${name ?? "units"}`;
}

export function NotesHistory({
  notes,
  currentUserId,
  metricKind,
  metricName,
}: {
  notes: Note[];
  currentUserId: string | null;
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
}) {
  if (notes.length === 0) return null;

  return (
    <section className="px-5 pt-6">
      <div className="label mb-2">notes</div>
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <NoteRow
            key={n.id}
            note={n}
            currentUserId={currentUserId}
            metricKind={metricKind}
            metricName={metricName}
          />
        ))}
      </ul>
    </section>
  );
}

function NoteRow({
  note,
  currentUserId,
  metricKind,
  metricName,
}: {
  note: Note;
  currentUserId: string | null;
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState(note.note);
  const [draftMetric, setDraftMetric] = useState(
    note.metric_value !== null ? String(note.metric_value) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const isAuthor = note.user_id === currentUserId;
  const ageMs = Date.now() - new Date(note.completed_at).getTime();
  const editable = isAuthor && ageMs < EDIT_WINDOW_MS;

  const onSave = () => {
    setError(null);
    const trimmed = draftNote.trim();
    if (!trimmed && metricKind === null) {
      setError("Note cannot be empty");
      return;
    }
    const parsed =
      draftMetric.trim() === ""
        ? null
        : Math.max(0, parseInt(draftMetric, 10));
    const metricToSave =
      parsed === null || Number.isFinite(parsed) ? parsed : null;

    startSaving(async () => {
      const result = await saveNoteInline(
        note.id,
        trimmed || null,
        metricKind ? metricToSave : undefined,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <li
        className="p-3"
        style={{
          background: "var(--card)",
          border: "1px solid var(--accent-soft)",
          borderRadius: "var(--radius)",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Avatar name={note.display_name} size={28} />
          <div className="flex-1 min-w-0">
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {note.display_name}
              {isAuthor && (
                <span style={{ color: "var(--mute)", fontWeight: 400 }}>
                  {" · you"}
                </span>
              )}
            </div>
            <div className="label" style={{ fontSize: 10 }}>
              {noteTimestamp(note.completed_at)}
            </div>
          </div>
        </div>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="how did it go?"
          className="w-full resize-none outline-none"
          style={{
            background: "var(--card-inset)",
            border: "1.5px solid var(--line)",
            borderRadius: "var(--radius)",
            padding: 10,
            fontSize: 15,
            color: "var(--ink)",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
          }}
        />
        {metricKind && (
          <label className="mt-2 block">
            <span className="label">
              {metricKind === "minutes" ? "minutes" : metricName ?? "units"}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={draftMetric}
              onChange={(e) => setDraftMetric(e.target.value)}
              placeholder="0"
              className="mt-1 w-full outline-none"
              style={{
                height: 38,
                background: "var(--card-inset)",
                border: "1.5px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                padding: "0 12px",
                fontSize: 14,
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
              }}
            />
          </label>
        )}
        {error && (
          <div className="mt-2 text-xs" style={{ color: "var(--accent)" }}>
            {error}
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraftNote(note.note);
              setDraftMetric(
                note.metric_value !== null ? String(note.metric_value) : "",
              );
              setError(null);
            }}
            disabled={isSaving}
            className="press"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "transparent",
              color: "var(--ink-soft)",
              border: "1px solid var(--line-strong)",
              fontFamily: "var(--font-stat-mono)",
              fontSize: 10.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="press"
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              fontFamily: "var(--font-stat-mono)",
              fontSize: 10.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {isSaving ? "saving…" : "save"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className="p-3"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={note.display_name} size={28} />
        <div className="flex-1 min-w-0">
          <div style={{ fontWeight: 500, fontSize: 14 }}>
            {note.display_name}
            {isAuthor && (
              <span style={{ color: "var(--mute)", fontWeight: 400 }}>
                {" · you"}
              </span>
            )}
          </div>
          <div className="label mt-0.5" style={{ fontSize: 10 }}>
            {noteTimestamp(note.completed_at)}
            {note.metric_value !== null && metricKind && (
              <>
                {" · "}
                {formatMetric(note.metric_value, metricKind, metricName)}
              </>
            )}
          </div>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="press"
            aria-label="Edit note"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "transparent",
              border: "1px solid var(--line-strong)",
              color: "var(--ink-soft)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
        )}
      </div>
      <p
        className="mt-2 whitespace-pre-wrap"
        style={{
          fontSize: 14,
          color: "var(--ink)",
          lineHeight: 1.4,
          paddingLeft: 10,
          borderLeft: "2px solid var(--accent)",
        }}
      >
        {note.note}
      </p>
    </li>
  );
}
