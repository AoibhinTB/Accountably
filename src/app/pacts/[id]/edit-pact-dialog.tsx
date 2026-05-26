"use client";

import { useEffect, useState } from "react";
import { Chevron } from "@/components/ui/chevron";
import { ConfirmForm } from "@/components/confirm-form";
import { HowOftenPicker } from "@/components/ui/how-often-picker";
import { IconPicker } from "@/components/ui/icon-picker";
import { SubmitButton } from "@/components/submit-button";
import { deletePact, updatePact } from "../actions";

// Other components on the pact-detail page (the hero-icon button) dispatch
// this event on window to open the dialog. Keeps the trigger sites
// decoupled from the dialog state.
export const OPEN_EDIT_PACT_EVENT = "open-edit-pact";

type Props = {
  pactId: string;
  pactName: string;
  pactIcon: string | null;
  challenge: {
    description: string | null;
    frequency: "daily" | "weekly";
    days_of_week: number[] | null;
    start_date: string;
    end_date: string | null;
  };
  isCreator: boolean;
};

export function EditPactDialog({
  pactId,
  pactName,
  pactIcon,
  challenge,
  isCreator,
}: Props) {
  const [open, setOpen] = useState(false);

  // Listen for the "open-edit-pact" event so any trigger on the page (icon,
  // explicit button) can open the dialog without prop-drilling state.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EDIT_PACT_EVENT, handler);
    return () => window.removeEventListener(OPEN_EDIT_PACT_EVENT, handler);
  }, []);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press"
        aria-label="Edit pact"
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--line-strong)",
          color: "var(--ink-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
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

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit pact"
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{
            background: "rgba(42, 31, 24, 0.32)",
            animation: "edit-pact-backdrop 200ms ease-out",
          }}
          onClick={() => setOpen(false)}
        >
          <style>{`
            @keyframes edit-pact-backdrop {
              from { background: rgba(42, 31, 24, 0); }
              to { background: rgba(42, 31, 24, 0.32); }
            }
            @keyframes edit-pact-slide-up {
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
              animation: "edit-pact-slide-up 240ms cubic-bezier(.2,.7,.4,1)",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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
                onClick={() => setOpen(false)}
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

            <div className="label">edit</div>
            <h2
              className="m-0 mt-1 mb-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                lineHeight: 1.05,
                color: "var(--ink)",
              }}
            >
              {pactName}
            </h2>

            <form action={updatePact} className="flex flex-col gap-3">
              <input type="hidden" name="pact_id" value={pactId} />
              <label className="block">
                <span className="label">Name</span>
                <input
                  name="name"
                  type="text"
                  required
                  maxLength={80}
                  defaultValue={pactName}
                  className="mt-1.5 w-full outline-none"
                  style={inputStyle}
                />
              </label>
              <IconPicker defaultValue={pactIcon} />
              <label className="block">
                <span className="label">Description (optional)</span>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={500}
                  defaultValue={challenge.description ?? ""}
                  className="mt-1.5 w-full resize-none outline-none"
                  style={{
                    ...inputStyle,
                    height: "auto",
                    paddingTop: 12,
                    paddingBottom: 12,
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                  }}
                />
              </label>
              <HowOftenPicker
                defaultFrequency={challenge.frequency}
                defaultDays={challenge.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]}
              />

              <details className="group">
                <summary
                  className="press flex min-h-11 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden"
                  style={{
                    padding: "0 14px",
                    background: "var(--card-inset)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    color: "var(--ink-soft)",
                    fontSize: 14,
                  }}
                >
                  <span>custom dates</span>
                  <Chevron
                    direction="down"
                    size={14}
                    strokeWidth={2}
                    className="transition-transform group-open:rotate-180"
                    style={{ color: "var(--mute)" }}
                  />
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="flex flex-col">
                    <span className="label block">start date</span>
                    <input
                      name="start_date"
                      type="date"
                      defaultValue={challenge.start_date}
                      className="mt-1.5 w-full outline-none"
                      style={dateInputStyle}
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="label block">end date</span>
                    <input
                      name="end_date"
                      type="date"
                      defaultValue={challenge.end_date ?? ""}
                      className="mt-1.5 w-full outline-none"
                      style={dateInputStyle}
                    />
                  </label>
                </div>
              </details>
              <SubmitButton pendingLabel="saving…" style={primaryStyle}>
                save changes
              </SubmitButton>
            </form>

            {isCreator && (
              <div
                className="mt-5 p-3"
                style={{
                  borderRadius: "var(--radius)",
                  border: "1px solid rgba(156, 31, 31, 0.25)",
                  background: "rgba(216, 98, 58, 0.06)",
                }}
              >
                <p
                  className="mb-3 text-xs"
                  style={{ color: "#7A1F1F", lineHeight: 1.4 }}
                >
                  deleting this pact permanently removes all completions and
                  reactions. this can&apos;t be undone. only the creator can
                  delete.
                </p>
                <ConfirmForm
                  action={deletePact}
                  message={`Delete "${pactName}"? All completions and reactions in this pact will be permanently deleted. This cannot be undone.`}
                >
                  <input type="hidden" name="pact_id" value={pactId} />
                  <SubmitButton pendingLabel="deleting…" style={dangerStyle}>
                    delete pact
                  </SubmitButton>
                </ConfirmForm>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  height: 52,
  background: "var(--card-inset)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 16px",
  fontSize: 16,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
};

const dateInputStyle: React.CSSProperties = {
  height: 44,
  background: "var(--card-inset)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  padding: "0 12px",
  fontSize: 14,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  textAlign: "left",
};

const primaryStyle: React.CSSProperties = {
  minHeight: 52,
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "var(--radius)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 16,
  padding: "0 22px",
};

const dangerStyle: React.CSSProperties = {
  minHeight: 44,
  background: "var(--card)",
  color: "#9C1F1F",
  borderRadius: "var(--radius)",
  border: "1.5px solid rgba(156, 31, 31, 0.4)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  padding: "0 18px",
};
