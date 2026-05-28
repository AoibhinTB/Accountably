"use client";

import { useState } from "react";
import { EmojiPickerModal } from "./emoji-picker-modal";

export const PACT_ICON_OPTIONS = [
  "🧘",
  "💪",
  "📖",
  "🏃",
  "✍️",
  "💧",
  "🍎",
  "🌱",
  "☀️",
  "🎯",
  "💤",
  "🎨",
] as const;

const TILE_BASE: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "var(--radius-sm)",
  border: "1.5px solid var(--line)",
  background: "var(--card-inset)",
  color: "var(--ink)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  lineHeight: 1,
  cursor: "pointer",
  flexShrink: 0,
};

const TILE_SELECTED: React.CSSProperties = {
  background: "var(--accent-soft)",
  borderColor: "var(--accent)",
  boxShadow: "0 0 0 1px var(--accent)",
};

export function IconPicker({
  defaultValue,
  name = "icon",
  legend = "icon (optional)",
}: {
  defaultValue?: string | null;
  name?: string;
  legend?: string;
}) {
  const [selected, setSelected] = useState<string>(defaultValue ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const isCustom =
    selected !== "" && !PACT_ICON_OPTIONS.includes(selected as never);

  return (
    <fieldset style={{ minWidth: 0 }}>
      <legend className="label">{legend}</legend>
      <input type="hidden" name={name} value={selected} />
      <div
        className="mt-2 flex gap-2 overflow-x-auto px-1 py-2 no-scrollbar"
        style={{
          minWidth: 0,
          maxWidth: "100%",
          scrollPaddingLeft: 4,
          scrollPaddingRight: 4,
          touchAction: "pan-x",
          overscrollBehaviorX: "contain",
        }}
      >
        <Tile
          aria-label="No icon"
          ariaPressed={selected === ""}
          onClick={() => setSelected("")}
          selected={selected === ""}
        >
          <span aria-hidden style={{ color: "var(--mute)", fontSize: 20 }}>
            —
          </span>
        </Tile>
        {PACT_ICON_OPTIONS.map((emoji) => {
          const on = selected === emoji;
          return (
            <Tile
              key={emoji}
              aria-label={emoji}
              ariaPressed={on}
              onClick={() => setSelected(emoji)}
              selected={on}
            >
              <span aria-hidden>{emoji}</span>
            </Tile>
          );
        })}
        {isCustom && (
          <Tile
            aria-label={`Custom icon ${selected}`}
            ariaPressed
            onClick={() => setPickerOpen(true)}
            selected
          >
            <span aria-hidden>{selected}</span>
          </Tile>
        )}
        <Tile
          aria-label="Choose any emoji"
          ariaPressed={false}
          onClick={() => setPickerOpen(true)}
          selected={false}
        >
          <span aria-hidden style={{ color: "var(--mute)", fontSize: 22 }}>
            +
          </span>
        </Tile>
      </div>
      <EmojiPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(emoji) => setSelected(emoji)}
      />
    </fieldset>
  );
}

function Tile({
  children,
  onClick,
  selected,
  ariaPressed,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected: boolean;
  ariaPressed: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      aria-label={rest["aria-label"]}
      style={{
        ...TILE_BASE,
        ...(selected ? TILE_SELECTED : null),
      }}
    >
      {children}
    </button>
  );
}
