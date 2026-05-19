import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CompletionFeed,
  type CompletionItemData,
} from "@/components/completion-item";
import {
  summarizeReactions,
  type ReactionRow,
} from "@/components/reactions/constants";
import { Squiggle } from "@/components/ui/squiggle";
import { Avatar } from "@/components/ui/avatar";
import { TodayBand, type TodayPact } from "./today-band";

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

type PactRow = {
  groups: {
    id: string;
    name: string;
    icon: string | null;
    challenges: {
      id: string;
      frequency: "daily" | "weekly";
      archived: boolean;
      days_of_week: number[] | null;
    }[];
  } | null;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "still up,";
  if (h < 12) return "morning,";
  if (h < 18) return "afternoon,";
  return "evening,";
};

const startOfWeek = (d: Date) => {
  // Monday-start week, local time
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
};

const startOfDay = (d: Date) => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
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

  // Today section data: my memberships → their active challenges → my recent
  // completions. Pulls all challenges per group (active + archived) and the
  // active one is picked in JS — simpler and avoids relying on PostgREST's
  // doubly-nested filter syntax.
  const { data: pactRows, error: pactRowsError } = await supabase
    .from("group_members")
    .select(
      "groups(id, name, icon, challenges(id, frequency, archived, days_of_week))",
    )
    .eq("user_id", user.id)
    .returns<PactRow[]>();

  if (pactRowsError) {
    console.error("[feed] pact rows query failed:", pactRowsError);
  }

  const pactsWithChallenge = (pactRows ?? [])
    .map((r) => r.groups)
    .filter((g): g is NonNullable<PactRow["groups"]> => !!g)
    .map((g) => {
      const ch = g.challenges?.find((c) => !c.archived);
      return ch
        ? { groupId: g.id, name: g.name, icon: g.icon, challenge: ch }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => !!p);

  const challengeIds = pactsWithChallenge.map((p) => p.challenge.id);
  const now = new Date();
  const weekStart = startOfWeek(now);
  const dayStart = startOfDay(now);

  // Earliest cutoff we might care about: start of this week
  const { data: myCompletions } = challengeIds.length
    ? await supabase
        .from("completions")
        .select("challenge_id, completed_at")
        .eq("user_id", user.id)
        .in("challenge_id", challengeIds)
        .gte("completed_at", weekStart.toISOString())
    : { data: [] as { challenge_id: string; completed_at: string }[] };

  const completionsByChallenge = new Map<string, string[]>();
  for (const c of myCompletions ?? []) {
    const list = completionsByChallenge.get(c.challenge_id) ?? [];
    list.push(c.completed_at);
    completionsByChallenge.set(c.challenge_id, list);
  }

  // dayIdx: 0=Mon ... 6=Sun. UTC getDay returns 0=Sun ... 6=Sat.
  const todayDayIdx = (now.getUTCDay() + 6) % 7;

  const todayPacts: TodayPact[] = pactsWithChallenge
    .filter((p) => {
      // Skip pacts that don't require today (e.g. weekdays-only on a Sat).
      const dow = p.challenge.days_of_week;
      if (
        p.challenge.frequency === "daily" &&
        dow &&
        dow.length > 0 &&
        !dow.includes(todayDayIdx)
      ) {
        return false;
      }
      return true;
    })
    .map((p) => {
      const ts = completionsByChallenge.get(p.challenge.id) ?? [];
      const threshold = p.challenge.frequency === "daily" ? dayStart : weekStart;
      const done = ts.some((t) => new Date(t) >= threshold);
      return {
        id: p.groupId,
        name: p.name,
        icon: p.icon,
        frequency: p.challenge.frequency,
        doneThisPeriod: done,
      };
    });

  // Global feed (recent completions across all my groups)
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
    challengeName: row.challenges?.groups?.name ?? row.challenges?.title,
    challengeHref: row.challenges?.groups
      ? `/pacts/${row.challenges.groups.id}`
      : undefined,
    reactions: summarizeReactions(row.reactions, user.id),
  }));

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="label mb-1">{todayLabel}</div>
          <h1 className="h-display m-0" style={{ fontSize: 40, lineHeight: 1 }}>
            <span style={{ fontStyle: "italic" }}>{greeting()}</span> {firstName}
          </h1>
          <Squiggle width={84} />
        </div>
        <Avatar name={profile?.display_name ?? "?"} size={34} ring />
      </header>

      <TodayBand pacts={todayPacts} />

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          className="h-display m-0"
          style={{ fontSize: 24, whiteSpace: "nowrap" }}
        >
          the feed
        </h2>
        <span className="label whitespace-nowrap">latest first</span>
      </div>

      <CompletionFeed
        items={items}
        revalidatePath="/feed"
        emptyMessage="quiet for now. once anyone in your pacts logs a completion, it shows up here."
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
