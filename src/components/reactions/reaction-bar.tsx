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
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pr-10">
          {reactions.map((r) => (
            <form action={toggleReaction} key={r.emoji}>
              <input type="hidden" name="completion_id" value={completionId} />
              <input type="hidden" name="emoji" value={r.emoji} />
              <input type="hidden" name="revalidate_path" value={revalidatePath} />
              <SubmitButton
                aria-pressed={r.userHasReacted}
                className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-sm leading-none ${
                  r.userHasReacted
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                <span aria-hidden>{r.emoji}</span>
                <span className="text-xs font-medium tabular-nums">{r.count}</span>
              </SubmitButton>
            </form>
          ))}
        </div>
      )}

      <details className="absolute right-3 bottom-0 z-10 translate-y-1/2">
        <summary
          aria-label="Add reaction"
          className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-zinc-300 bg-white text-lg leading-none text-zinc-500 shadow-sm [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden>+</span>
        </summary>
        <div className="absolute right-0 top-full z-20 mt-2 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-md">
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
                  className={`flex h-10 w-10 items-center justify-center rounded-md text-xl active:bg-zinc-100 ${
                    hasReacted ? "bg-zinc-100 ring-1 ring-zinc-300" : ""
                  }`}
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
