import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompletionFeed, type CompletionItemData } from "@/components/completion-item";
import { summarizeReactions, type ReactionRow } from "@/components/reactions/constants";
import { Squiggle } from "@/components/ui/squiggle";
import { Avatar } from "@/components/ui/avatar";

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

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "still up,";
  if (h < 12) return "morning,";
  if (h < 18) return "afternoon,";
  return "evening,";
};

export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/feed");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = (profile?.display_name ?? "").split(" ")[0] || "friend";

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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="label mb-1">{today}</div>
          <h1
            className="h-display m-0"
            style={{ fontSize: 40, lineHeight: 1 }}
          >
            <span style={{ fontStyle: "italic" }}>{greeting()}</span>{" "}
            {firstName}
          </h1>
          <Squiggle width={84} />
        </div>
        <Avatar name={profile?.display_name ?? "?"} size={44} ring />
      </header>

      <div className="mt-7 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="h-display m-0" style={{ fontSize: 24, whiteSpace: "nowrap" }}>
          the feed
        </h2>
        <span className="label whitespace-nowrap">latest first</span>
      </div>

      <CompletionFeed
        items={items}
        revalidatePath="/feed"
        emptyMessage="quiet for now. once anyone in your groups logs a completion, it shows up here."
      />

      {items.length > 0 && (
        <div
          className="mt-5 text-center"
          style={{
            color: "var(--mute)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          — caught up —
        </div>
      )}
    </main>
  );
}
