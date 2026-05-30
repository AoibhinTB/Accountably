"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addJournalEntry, deleteJournalEntry } from "../journal-actions";

export function JournalForm({ pactId }: { pactId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  const onSave = () => {
    setError(null);
    if (!body.trim()) return;
    startSaving(async () => {
      const result = await addJournalEntry(pactId, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  };

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="just for you. what went well, what to try tomorrow…"
        className="w-full resize-none outline-none"
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
      {error && (
        <div className="mt-2 text-xs" style={{ color: "var(--accent)" }}>
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || !body.trim()}
        className="press mt-2 disabled:opacity-50"
        style={{
          padding: "10px 18px",
          borderRadius: 999,
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {isSaving ? "saving…" : "save private entry"}
      </button>
    </div>
  );
}

export function JournalEntryActions({ entryId }: { entryId: string }) {
  const [isDeleting, startDeleting] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("Delete this entry?")) return;
        startDeleting(async () => {
          const result = await deleteJournalEntry(entryId);
          if (!result.ok) {
            console.error("deleteJournalEntry failed:", result.error);
            return;
          }
          router.refresh();
        });
      }}
      disabled={isDeleting}
      className="press"
      aria-label="Delete entry"
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "transparent",
        border: "1px solid rgba(156, 31, 31, 0.4)",
        color: "#9C1F1F",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    </button>
  );
}
