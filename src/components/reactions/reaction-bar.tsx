"use client";

import { useOptimistic, useTransition } from "react";
import { toggleReactionFor } from "./actions";
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
  const [optimistic, applyOptimistic] = useOptimistic<
    ReactionSummary[],
    string
  >(reactions, (state, emoji) => {
    const existing = state.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.userHasReacted) {
        // Removing my reaction.
        const newCount = existing.count - 1;
        return newCount <= 0
          ? state.filter((r) => r.emoji !== emoji)
          : state.map((r) =>
              r.emoji === emoji
                ? { ...r, count: newCount, userHasReacted: false }
                : r,
            );
      }
      // Adding my reaction to an existing chip.
      return state.map((r) =>
        r.emoji === emoji
          ? { ...r, count: r.count + 1, userHasReacted: true }
          : r,
      );
    }
    // Brand new chip.
    return [...state, { emoji, count: 1, userHasReacted: true }];
  });

  const [, startTransition] = useTransition();
  const reactedEmojis = new Set(
    optimistic.filter((r) => r.userHasReacted).map((r) => r.emoji),
  );

  const onTap = (emoji: string) => {
    startTransition(async () => {
      applyOptimistic(emoji);
      await toggleReactionFor(completionId, emoji, revalidatePath);
    });
  };

  return (
    <>
      {optimistic.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pr-12">
          {optimistic.map((r) => (
            <button
              type="button"
              key={r.emoji}
              onClick={() => onTap(r.emoji)}
              aria-pressed={r.userHasReacted}
              className="press"
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
            </button>
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
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--card)",
            border: "1px solid var(--line-strong)",
            color: "var(--mute)",
            fontSize: 14,
            lineHeight: 1,
            boxShadow: "0 1px 3px rgba(42, 31, 24, 0.08)",
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
              <button
                type="button"
                key={emoji}
                onClick={() => onTap(emoji)}
                aria-label={
                  hasReacted ? `Remove ${emoji} reaction` : `React with ${emoji}`
                }
                className="press"
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
              </button>
            );
          })}
        </div>
      </details>
    </>
  );
}
