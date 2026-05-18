export const CURATED_EMOJIS = ["👏", "🔥", "💪", "❤️", "😂", "🙌"] as const;

export type ReactionRow = { emoji: string; user_id: string };

export type ReactionSummary = {
  emoji: string;
  count: number;
  userHasReacted: boolean;
};

export function summarizeReactions(
  reactions: ReactionRow[] | null | undefined,
  currentUserId: string | null,
): ReactionSummary[] {
  const map = new Map<string, { count: number; userHasReacted: boolean }>();
  for (const r of reactions ?? []) {
    const existing = map.get(r.emoji) ?? { count: 0, userHasReacted: false };
    existing.count += 1;
    if (currentUserId && r.user_id === currentUserId) {
      existing.userHasReacted = true;
    }
    map.set(r.emoji, existing);
  }
  const curatedIndex = (emoji: string) => {
    const i = (CURATED_EMOJIS as readonly string[]).indexOf(emoji);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...map.entries()]
    .map(([emoji, d]) => ({ emoji, ...d }))
    .sort((a, b) => curatedIndex(a.emoji) - curatedIndex(b.emoji));
}
