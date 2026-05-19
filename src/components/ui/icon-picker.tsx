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

const TILE_STYLE: React.CSSProperties = {
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

export function IconPicker({
  defaultValue,
  name = "icon",
  legend = "icon (optional)",
}: {
  defaultValue?: string | null;
  name?: string;
  legend?: string;
}) {
  const current = defaultValue ?? "";
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
        <label
          className="press has-[input:checked]:ring-2 has-[input:checked]:ring-[color:var(--accent)] has-[input:checked]:bg-[color:var(--accent-soft)]"
          style={TILE_STYLE}
        >
          <input
            type="radio"
            name={name}
            value=""
            defaultChecked={!current}
            className="sr-only"
          />
          <span aria-hidden style={{ color: "var(--mute)", fontSize: 20 }}>
            —
          </span>
          <span className="sr-only">No icon</span>
        </label>
        {PACT_ICON_OPTIONS.map((emoji) => (
          <label
            key={emoji}
            className="press has-[input:checked]:ring-2 has-[input:checked]:ring-[color:var(--accent)] has-[input:checked]:bg-[color:var(--accent-soft)]"
            style={TILE_STYLE}
          >
            <input
              type="radio"
              name={name}
              value={emoji}
              defaultChecked={current === emoji}
              className="sr-only"
            />
            <span aria-hidden>{emoji}</span>
            <span className="sr-only">{emoji}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
