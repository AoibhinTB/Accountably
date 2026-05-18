import { SubmitButton } from "@/components/submit-button";
import { toggleReaction } from "./actions";
import { CURATED_EMOJIS, type ReactionSummary } from "./constants";

export function ReactionBar({
  completionId,
  reactions,
  revalidatePath,
}: {
  completionId: string;
  reactions: ReactionSummary[];
  revalidatePath: string;
}) {
  const reactedEmojis = new Set(
    reactions.filter((r) => r.userHasReacted).map((r) => r.emoji),
  );

  return (
    <>
      {reactions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pr-12">
          {reactions.map((r) => (
            <form action={toggleReaction} key={r.emoji}>
              <input type="hidden" name="completion_id" value={completionId} />
              <input type="hidden" name="emoji" value={r.emoji} />
              <input type="hidden" name="revalidate_path" value={revalidatePath} />
              <SubmitButton
                aria-pressed={r.userHasReacted}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 999,
                  background: r.userHasReacted
                    ? "var(--accent-soft)"
                    : "var(--card-inset)",
                  border: `1px solid ${
                    r.userHasReacted ? "var(--accent)" : "var(--line)"
                  }`,
                  color: r.userHasReacted ? "var(--accent)" : "var(--ink-soft)",
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <span aria-hidden style={{ fontFamily: "var(--font-body)", fontSize: 14 }}>
                  {r.emoji}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
              </SubmitButton>
            </form>
          ))}
        </div>
      )}

      <details
        className="absolute right-3 bottom-0 z-10"
        style={{ transform: "translateY(50%)" }}
      >
        <summary
          aria-label="Add reaction"
          className="press flex cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--card)",
            border: "1px solid var(--line-strong)",
            color: "var(--mute)",
            fontSize: 18,
            lineHeight: 1,
            boxShadow: "0 2px 4px rgba(42, 31, 24, 0.08)",
          }}
        >
          <span aria-hidden>+</span>
        </summary>
        <div
          className="absolute right-0 top-full z-20 mt-2 flex gap-1"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            padding: 6,
            boxShadow: "0 8px 24px rgba(42, 31, 24, 0.15)",
          }}
        >
          {CURATED_EMOJIS.map((emoji) => {
            const hasReacted = reactedEmojis.has(emoji);
            return (
              <form action={toggleReaction} key={emoji}>
                <input type="hidden" name="completion_id" value={completionId} />
                <input type="hidden" name="emoji" value={emoji} />
                <input type="hidden" name="revalidate_path" value={revalidatePath} />
                <SubmitButton
                  aria-label={
                    hasReacted ? `Remove ${emoji} reaction` : `React with ${emoji}`
                  }
                  style={{
                    display: "flex",
                    width: 40,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 20,
                    background: hasReacted ? "var(--accent-soft)" : "transparent",
                    border: hasReacted
                      ? "1px solid var(--accent)"
                      : "1px solid transparent",
                  }}
                >
                  {emoji}
                </SubmitButton>
              </form>
            );
          })}
        </div>
      </details>
    </>
  );
}
