"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

// Dynamically loaded so the ~200KB picker only ships in the bundle when a
// user actually opens it. ssr:false because the library touches the DOM.
const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export function EmojiPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick an emoji"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{
        background: "rgba(42, 31, 24, 0.32)",
        animation: "emoji-picker-backdrop 180ms ease-out",
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes emoji-picker-backdrop {
          from { background: rgba(42, 31, 24, 0); }
          to { background: rgba(42, 31, 24, 0.32); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "min(360px, 100%)",
          maxHeight: "80vh",
          overflow: "hidden",
          borderRadius: 18,
          boxShadow: "0 16px 40px rgba(42, 31, 24, 0.25)",
          marginBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <Picker
          onEmojiClick={(emoji) => {
            onSelect(emoji.emoji);
            onClose();
          }}
          width="100%"
          height={420}
          searchPlaceholder="search…"
          previewConfig={{ showPreview: false }}
          skinTonesDisabled
          lazyLoadEmojis
        />
      </div>
    </div>
  );
}
