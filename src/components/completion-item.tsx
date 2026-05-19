import Link from "next/link";
import { ReactionBar } from "./reactions/reaction-bar";
import type { ReactionSummary } from "./reactions/constants";
import { Avatar } from "./ui/avatar";

export type CompletionItemData = {
  id: string;
  userName: string;
  completedAt: string;
  note: string | null;
  // Single pact reference — group and challenge share a name in the
  // post-merge model. We keep the props named `challengeName`/`challengeHref`
  // so callers from before the merge work without churn; semantically these
  // are pact name + pact href.
  groupName?: string;
  groupHref?: string;
  challengeName?: string;
  challengeHref?: string;
  reactions: ReactionSummary[];
};

const formatCompletedAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {
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
  // Prefer the explicit challenge label if present (post-merge: it's the pact
  // name). Fall back to groupName so legacy callers still render something.
  const pactName = item.challengeName ?? item.groupName;
  const pactHref = item.challengeHref ?? item.groupHref;

  return (
    <li className="relative">
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: "var(--density-pad)",
          boxShadow: "0 1px 0 rgba(42, 31, 24, 0.04)",
          position: "relative",
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar name={item.userName} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span style={{ fontWeight: 600 }}>{item.userName}</span>
              {pactName && (
                <>
                  <span style={{ color: "var(--mute)", fontSize: 13 }}>·</span>
                  {pactHref ? (
                    <Link
                      href={pactHref}
                      style={{
                        fontFamily: "var(--font-display)",
                        fontStyle: "italic",
                        fontSize: 17,
                        color: "var(--ink)",
                        textDecoration: "underline",
                        textDecorationColor: "var(--accent)",
                        textDecorationThickness: 1.5,
                        textUnderlineOffset: 3,
                      }}
                    >
                      {pactName}
                    </Link>
                  ) : (
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontStyle: "italic",
                        fontSize: 17,
                        color: "var(--ink)",
                      }}
                    >
                      {pactName}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="label mt-0.5">{formatCompletedAt(item.completedAt)}</div>
          </div>
        </div>

        {item.note && (
          <div
            className="note mt-3"
            style={{ paddingLeft: 12, borderLeft: "2px solid var(--accent)" }}
          >
            &ldquo;{item.note}&rdquo;
          </div>
        )}

        <ReactionBar
          completionId={item.id}
          reactions={item.reactions}
          revalidatePath={revalidatePath}
        />
      </div>
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
      <div
        className="px-6 py-8 text-center"
        style={{
          borderRadius: "var(--radius)",
          border: "1.5px dashed var(--line-strong)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          {emptyMessage}
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
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
