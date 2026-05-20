// Right-angle chevron arrow used throughout the app. The path lays down a
// 45° / 45° vee whose vertex is 90°; combined with `stroke-linejoin: miter`
// the corner stays sharp (not rounded like the other icons in the design).
// Direction is determined by which path is drawn.

const PATHS = {
  right: "M9 5l7 7-7 7",
  left: "M15 5l-7 7 7 7",
  up: "M5 15l7-7 7 7",
  down: "M5 9l7 7 7-7",
} as const;

export function Chevron({
  direction,
  size = 16,
  strokeWidth = 2,
  className,
  style,
}: {
  direction: keyof typeof PATHS;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      style={style}
      aria-hidden
    >
      <path d={PATHS[direction]} />
    </svg>
  );
}
