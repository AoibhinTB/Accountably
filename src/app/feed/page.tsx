import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompletionFeed, type CompletionItemData } from "@/components/completion-item";
import { summarizeReactions, type ReactionRow } from "@/components/reactions/constants";

type GlobalFeedRow = {
  id: string;
  completed_at: string;
  note: string | null;
  profiles: { display_name: string } | null;
  challenges: {
    id: string;
    title: string;
    group_id: string;
    groups: { id: string; name: string } | null;
  } | null;
  reactions: ReactionRow[] | null;
};

export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/feed");

  const { data } = await supabase
    .from("completions")
    .select(
      "id, completed_at, note, profiles(display_name), challenges(id, title, group_id, groups(id, name)), reactions(emoji, user_id)",
    )
    .order("completed_at", { ascending: false })
    .limit(20)
    .returns<GlobalFeedRow[]>();

  const items: CompletionItemData[] = (data ?? []).map((row) => ({
    id: row.id,
    userName: row.profiles?.display_name ?? "Unknown",
    completedAt: row.completed_at,
    note: row.note,
    challengeName: row.challenges?.title,
    challengeHref:
      row.challenges && row.challenges.groups
        ? `/groups/${row.challenges.groups.id}/challenges/${row.challenges.id}`
        : undefined,
    groupName: row.challenges?.groups?.name,
    groupHref: row.challenges?.groups
      ? `/groups/${row.challenges.groups.id}`
      : undefined,
    reactions: summarizeReactions(row.reactions, user.id),
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Feed</h1>
        <p className="text-sm text-zinc-600">
          Recent completions across all your groups.
        </p>
      </header>

      <CompletionFeed
        items={items}
        revalidatePath="/feed"
        emptyMessage="No completions yet. Once anyone in your groups logs one, it'll show up here."
      />
    </main>
  );
}
