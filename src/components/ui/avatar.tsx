export const AVATAR_PALETTE = [
  { bg: "#F2C7A8", ink: "#5B3322" },
  { bg: "#C8D6BE", ink: "#2F3B25" },
  { bg: "#F2A09A", ink: "#4B201D" },
  { bg: "#F4D38A", ink: "#4D3A17" },
  { bg: "#C7D8E0", ink: "#22414D" },
  { bg: "#E2B8D9", ink: "#4B2B45" },
  { bg: "#D6CEE2", ink: "#3B2E58" },
  { bg: "#A8C9B7", ink: "#1E3A29" },
] as const;

const toneFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const isPaletteIndex = (i: number | null | undefined): i is number =>
  typeof i === "number" && i >= 0 && i < AVATAR_PALETTE.length;

export function Avatar({
  name,
  size = 40,
  ring = false,
  colorIndex = null,
}: {
  name: string;
  size?: number;
  ring?: boolean;
  // 0-7 palette index. null = auto from name hash (default).
  colorIndex?: number | null;
}) {
  const trimmed = name.trim();
  const initial = trimmed[0]?.toUpperCase() || "?";
  const tone = isPaletteIndex(colorIndex)
    ? AVATAR_PALETTE[colorIndex]
    : toneFor(trimmed.toLowerCase() || "?");
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: tone.bg,
        color: tone.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.5,
        fontWeight: 400,
        letterSpacing: "-0.02em",
        boxShadow: ring ? "0 0 0 2.5px var(--accent)" : undefined,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
