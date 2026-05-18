import Link from "next/link";
import { ReactionBar } from "./reactions/reaction-bar";
import type { ReactionSummary } from "./reactions/constants";

export type CompletionItemData = {
  id: string;
  userName: string;
  completedAt: string;
  note: string | null;
  groupName?: string;
  groupHref?: string;
  challengeName?: string;
  challengeHref?: string;
  reactions: ReactionSummary[];
};

const formatCompletedAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

export function CompletionItem({
  item,
  revalidatePath,
}: {
  item: CompletionItemData;
  revalidatePath: string;
}) {
  return (
    <li className="relative px-4 py-4">
      <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="font-medium text-zinc-900">{item.userName}</span>
        {item.challengeName && (
          <>
            <span className="text-zinc-400">·</span>
            {item.challengeHref ? (
              <Link
                href={item.challengeHref}
                className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2"
              >
                {item.challengeName}
              </Link>
            ) : (
              <span className="font-medium text-zinc-700">{item.challengeName}</span>
            )}
          </>
        )}
        {item.groupName && (
          <>
            <span className="text-zinc-400">in</span>
            {item.groupHref ? (
              <Link
                href={item.groupHref}
                className="text-zinc-600 underline decoration-zinc-300 underline-offset-2"
              >
                {item.groupName}
              </Link>
            ) : (
              <span className="text-zinc-600">{item.groupName}</span>
            )}
          </>
        )}
      </div>
      <div className="mt-0.5 text-xs text-zinc-500">
        {formatCompletedAt(item.completedAt)}
      </div>
      {item.note && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{item.note}</p>
      )}
      <ReactionBar
        completionId={item.id}
        reactions={item.reactions}
        revalidatePath={revalidatePath}
      />
    </li>
  );
}

export function CompletionFeed({
  items,
  emptyMessage,
  revalidatePath,
}: {
  items: CompletionItemData[];
  emptyMessage: string;
  revalidatePath: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center">
        <p className="text-sm text-zinc-600">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
      {items.map((item) => (
        <CompletionItem
          key={item.id}
          item={item}
          revalidatePath={revalidatePath}
        />
      ))}
    </ul>
  );
}
