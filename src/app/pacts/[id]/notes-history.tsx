"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Chevron } from "@/components/ui/chevron";
import { ReactionBar } from "@/components/reactions/reaction-bar";
import type { ReactionSummary } from "@/components/reactions/constants";
import { saveNoteInline } from "../actions";
import { noteTimestamp } from "@/lib/period";

type Note = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_color_index: number | null;
  completed_at: string;
  note: string | null;
  metric_value: number | null;
  reactions: ReactionSummary[];
};

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
  pactId,
}: {
  notes: Note[];
  currentUserId: string | null;
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
  pactId: string;
}) {
  if (notes.length === 0) return null;

  return (
    <section className="px-5 pt-6">
      <details open className="group">
        <summary
          className="press flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden"
          style={{ minHeight: 28 }}
        >
          <span className="label inline-flex items-center gap-1.5">
            notes
            <span style={{ color: "var(--mute)" }}>· {notes.length}</span>
          </span>
          <Chevron
            direction="down"
            size={12}
            strokeWidth={2}
            className="transition-transform group-open:rotate-180"
            style={{ color: "var(--mute)" }}
          />
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              currentUserId={currentUserId}
              metricKind={metricKind}
              metricName={metricName}
              revalidatePath={`/pacts/${pactId}`}
            />
          ))}
        </ul>
      </details>
    </section>
  );
}

function NoteRow({
  note,
  currentUserId,
  metricKind,
  metricName,
  revalidatePath,
}: {
  note: Note;
  currentUserId: string | null;
  metricKind: "count" | "minutes" | null;
  metricName: string | null;
  revalidatePath: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState(note.note ?? "");
  const [draftMetric, setDraftMetric] = useState(
    note.metric_value !== null ? String(note.metric_value) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [showEditPill, setShowEditPill] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const holdRef = useRef({ startTime: 0, fired: false, timerId: 0 });

  const isAuthor = note.user_id === currentUserId;
  const editable = isAuthor;

  // Hide the pill on any click outside this row.
  useEffect(() => {
    if (!showEditPill) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!rowRef.current) return;
      if (!rowRef.current.contains(e.target as Node)) {
        setShowEditPill(false);
      }
    };
    window.addEventListener("pointerdown", onDocPointer);
    return () => window.removeEventListener("pointerdown", onDocPointer);
  }, [showEditPill]);

  // Long-press detection. We use a setTimeout so the threshold is easy to
  // tune and we avoid running an animation loop for every note row.
  const HOLD_MS = 450;
  const onPointerDown = () => {
    if (!editable) return;
    holdRef.current.startTime = performance.now();
    holdRef.current.fired = false;
    holdRef.current.timerId = window.setTimeout(() => {
      holdRef.current.fired = true;
      setShowEditPill(true);
    }, HOLD_MS);
  };
  const cancelHold = () => {
    if (holdRef.current.timerId) {
      window.clearTimeout(holdRef.current.timerId);
      holdRef.current.timerId = 0;
    }
  };
  const onPointerUpOrCancel = () => cancelHold();

  const onSave = () => {
    setError(null);
    const trimmed = draftNote.trim();
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
          <Avatar
            name={note.display_name}
            colorIndex={note.avatar_color_index}
            size={28}
          />
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
              setDraftNote(note.note ?? "");
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
      ref={rowRef}
      className="p-3 relative"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        userSelect: showEditPill ? "none" : "auto",
        WebkitUserSelect: showEditPill ? "none" : "auto",
        WebkitTouchCallout: editable ? "none" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUpOrCancel}
      onPointerLeave={onPointerUpOrCancel}
      onPointerCancel={onPointerUpOrCancel}
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
        {editable && showEditPill && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowEditPill(false);
              setEditing(true);
            }}
            className="press"
            aria-label="Edit note"
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: "var(--accent)",
              border: "none",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              fontFamily: "var(--font-stat-mono)",
              fontSize: 10.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            edit
          </button>
        )}
      </div>
      {note.note && (
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
      )}
      <ReactionBar
        completionId={note.id}
        reactions={note.reactions}
        revalidatePath={revalidatePath}
      />
    </li>
  );
}
