"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AVATAR_PALETTE } from "@/components/ui/avatar";
import { updateProfile } from "./profile-actions";

type Props = {
  initialName: string;
  initialColorIndex: number | null;
};

// Slide-up sheet to edit display name and avatar color. Mounts a trigger
// (small pencil-icon button) and the sheet itself; the trigger toggles
// local open state. On save we revalidate the layout from the server
// action and refresh so all avatar instances pick up the change.
export function EditProfileSheet({ initialName, initialColorIndex }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [colorIndex, setColorIndex] = useState<number | null>(initialColorIndex);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

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

  // Reset draft when reopening so a previous cancelled session does not
  // bleed in.
  useEffect(() => {
    if (open) {
      setName(initialName);
      setColorIndex(initialColorIndex);
      setError(null);
    }
  }, [open, initialName, initialColorIndex]);

  const onSave = () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    startSaving(async () => {
      const result = await updateProfile({
        display_name: trimmed,
        avatar_color_index: colorIndex,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex items-center gap-1.5"
        aria-label="Edit profile"
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          background: "transparent",
          border: "1px solid var(--line-strong)",
          color: "var(--ink-soft)",
          fontFamily: "var(--font-stat-mono)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 500,
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
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
        edit profile
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{
            background: "rgba(42, 31, 24, 0.32)",
            animation: "edit-profile-backdrop 200ms ease-out",
          }}
          onClick={() => setOpen(false)}
        >
          <style>{`
            @keyframes edit-profile-backdrop {
              from { background: rgba(42, 31, 24, 0); }
              to { background: rgba(42, 31, 24, 0.32); }
            }
            @keyframes edit-profile-slide-up {
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
              animation: "edit-profile-slide-up 240ms cubic-bezier(.2,.7,.4,1)",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
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
              your profile
            </h2>

            <div className="mb-5 flex justify-center">
              <Avatar
                name={name || initialName || "?"}
                size={96}
                colorIndex={colorIndex}
                ring
              />
            </div>

            <label className="mb-4 block">
              <span className="label">display name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="how others see you"
                className="mt-1.5 w-full outline-none"
                style={{
                  height: 52,
                  background: "var(--card-inset)",
                  border: "1.5px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: "0 16px",
                  fontSize: 16,
                  color: "var(--ink)",
                  fontFamily: "var(--font-body)",
                }}
              />
            </label>

            <div className="mb-2">
              <span className="label">avatar color</span>
            </div>
            <div className="mb-4 flex flex-wrap gap-2.5">
              {AVATAR_PALETTE.map((tone, i) => {
                const selected = colorIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setColorIndex(i)}
                    aria-label={`Color ${i + 1}`}
                    aria-pressed={selected}
                    className="press"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: tone.bg,
                      border: selected
                        ? "2.5px solid var(--accent)"
                        : "1.5px solid var(--line)",
                      flexShrink: 0,
                    }}
                  />
                );
              })}
              <button
                type="button"
                onClick={() => setColorIndex(null)}
                aria-label="Auto color from name"
                aria-pressed={colorIndex === null}
                className="press"
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 999,
                  background: "transparent",
                  border:
                    colorIndex === null
                      ? "1.5px solid var(--accent)"
                      : "1.5px dashed var(--line-strong)",
                  color: "var(--ink-soft)",
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                auto
              </button>
            </div>

            {error && (
              <div
                className="mb-3 text-xs"
                style={{ color: "var(--accent)" }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="press w-full"
              style={{
                minHeight: 52,
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--radius)",
                border: "none",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 16,
                padding: "0 22px",
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {isSaving ? "saving…" : "save changes"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
