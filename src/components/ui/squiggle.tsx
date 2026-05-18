export function Squiggle({
  width = 84,
  className,
}: {
  width?: number | string;
  className?: string;
}) {
  return (
    <svg
      className={`squiggle-line ${className ?? ""}`}
      viewBox="0 0 200 8"
      preserveAspectRatio="none"
      style={{ width, marginTop: 4 }}
      aria-hidden
    >
      <path
        d="M2 5 Q 14 1, 26 5 T 50 5 T 74 5 T 98 5 T 122 5 T 146 5 T 170 5 T 198 5"
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
