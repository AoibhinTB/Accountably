"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { saveNoteInline, toggleQuickLog } from "@/app/pacts/actions";

export type TodayPact = {
  id: string;
  name: string;
  icon: string | null;
  frequency: "daily" | "weekly";
  doneThisPeriod: boolean;
};

type NotePrompt = {
  pactId: string;
  pactName: string;
  completionId: string;
};

const PeriodPill = ({ frequency }: { frequency: "daily" | "weekly" }) => (
  <span className="label" style={{ fontSize: 9 }}>
    {frequency === "daily" ? "today" : "this week"}
  </span>
);

export function TodayBand({ pacts }: { pacts: TodayPact[] }) {
  const [optimistic, toggleOptimistic] = useOptimistic<TodayPact[], string>(
    pacts,
    (state, pactId) =>
      state.map((p) =>
        p.id === pactId ? { ...p, doneThisPeriod: !p.doneThisPeriod } : p,
      ),
  );
  const [, startTransition] = useTransition();
  const [prompt, setPrompt] = useState<NotePrompt | null>(null);

  if (optimistic.length === 0) return null;

  const onTap = (pact: TodayPact) => {
    startTransition(async () => {
      toggleOptimistic(pact.id);
      const result = await toggleQuickLog(pact.id);
      if (!result.ok) {
        console.error("toggleQuickLog failed:", result.error);
        return;
      }
      if (result.done) {
        setPrompt({
          pactId: pact.id,
          pactName: pact.name,
          completionId: result.completionId,
        });
      }
    });
  };

  return (
    <>
      <section className="mb-7">
        <div className="label mb-2">today</div>
        <ul
          className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
          style={{
            scrollPaddingLeft: 20,
            touchAction: "pan-x",
            overscrollBehaviorX: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {optimistic.map((p) => (
            <li key={p.id} className="snap-start" style={{ flex: "0 0 auto" }}>
              <button
                type="button"
                onClick={() => onTap(p)}
                aria-pressed={p.doneThisPeriod}
                aria-label={
                  p.doneThisPeriod
                    ? `Undo ${p.name} for ${p.frequency === "daily" ? "today" : "this week"}`
                    : `Log ${p.name} for ${p.frequency === "daily" ? "today" : "this week"}`
                }
                className="press flex flex-col items-center gap-1.5"
                style={{ width: 96, touchAction: "pan-x" }}
              >
                <CompletionDisk done={p.doneThisPeriod} icon={p.icon} />
                <div
                  className="w-full truncate text-center"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink)",
                    lineHeight: 1.2,
                  }}
                  title={p.name}
                >
                  {p.name}
                </div>
                <PeriodPill frequency={p.frequency} />
              </button>
            </li>
          ))}
          <li className="snap-start" style={{ flex: "0 0 auto" }}>
            <Link
              href="/pacts"
              className="press flex flex-col items-center gap-1.5"
              style={{ width: 96, touchAction: "pan-x" }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  border: "1.5px dashed var(--line-strong)",
                  background: "transparent",
                  color: "var(--mute)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  lineHeight: 1,
                }}
                aria-hidden
              >
                +
              </div>
              <div
                className="text-center"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink-soft)",
                  lineHeight: 1.2,
                }}
              >
                new pact
              </div>
              <span className="label" style={{ fontSize: 9, visibility: "hidden" }}>
                .
              </span>
            </Link>
          </li>
        </ul>
      </section>

      {prompt && (
        <NoteSheet
          prompt={prompt}
          onClose={() => setPrompt(null)}
        />
      )}
    </>
  );
}

function NoteSheet({
  prompt,
  onClose,
}: {
  prompt: NotePrompt;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [isSaving, startSaving] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Defer focus a tick so the slide-in animation has started.
    const t = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Close on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onSave = () => {
    const trimmed = note.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    startSaving(async () => {
      const result = await saveNoteInline(prompt.completionId, trimmed);
      if (!result.ok) {
        console.error("saveNoteInline failed:", result.error);
      }
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add a note for ${prompt.pactName}`}
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
            }}
          >
            ×
          </button>
        </div>

        <div className="label">logged</div>
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
          leave a note for the group? totally optional.
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
            disabled={isSaving || !note.trim()}
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

function CompletionDisk({
  done,
  icon,
}: {
  done: boolean;
  icon: string | null;
}) {
  return (
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: "50%",
        background: done ? "var(--accent)" : "var(--card)",
        border: done ? "none" : "1.5px solid var(--line-strong)",
        boxShadow: done
          ? "0 8px 20px rgba(216, 98, 58, 0.35)"
          : "0 1px 0 rgba(42, 31, 24, 0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: done ? "#fff" : "var(--mute)",
        position: "relative",
      }}
      aria-hidden
    >
      {done ? (
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      ) : icon ? (
        <span style={{ fontSize: 32, lineHeight: 1 }}>{icon}</span>
      ) : (
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8.5" strokeDasharray="2 4" />
        </svg>
      )}
    </div>
  );
}
