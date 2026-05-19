export function Skeleton({
  className,
  style,
  rounded = "var(--radius)",
  height,
  width,
}: {
  className?: string;
  style?: React.CSSProperties;
  rounded?: string;
  height?: number | string;
  width?: number | string;
}) {
  return (
    <div
      className={className}
      style={{
        height,
        width,
        borderRadius: rounded,
        background:
          "linear-gradient(90deg, var(--card-inset) 0%, var(--card) 50%, var(--card-inset) 100%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
