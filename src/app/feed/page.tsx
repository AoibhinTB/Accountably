import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Squiggle } from "@/components/ui/squiggle";
import {
  buildWeekDots,
  currentStreak,
  startOfPeriodUTC,
  timeAgo,
} from "@/lib/period";
import { TodayBand, type TodayPact } from "./today-band";

type Frequency = "daily" | "weekly";

type PactRow = {
  groups: {
    id: string;
    name: string;
    icon: string | null;
    challenges: {
      id: string;
      frequency: Frequency;
      archived: boolean;
      days_of_week: number[] | null;
    }[];
  } | null;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  joined_at: string;
  profiles: { display_name: string } | null;
};

type CompletionRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  completed_at: string;
  note: string | null;
  profiles: { display_name: string } | null;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "still up,";
  if (h < 12) return "morning,";
  if (h < 18) return "afternoon,";
  return "evening,";
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

  // Phase 1: profile + my pacts in parallel — both only need the user id.
  const [{ data: profile }, { data: pactRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select(
        "groups(id, name, icon, created_at, challenges(id, frequency, archived, days_of_week))",
      )
      .eq("user_id", user.id)
      .returns<(PactRow & { groups: { created_at: string } | null })[]>(),
  ]);

  const firstName = (profile?.display_name ?? "").split(" ")[0] || "friend";

  const myPacts = (pactRows ?? [])
    .map((r) => r.groups)
    .filter((g): g is NonNullable<typeof g> => !!g)
    .map((g) => {
      const ch = g.challenges?.find((c) => !c.archived);
      return ch
        ? {
            id: g.id,
            name: g.name,
            icon: g.icon,
            createdAt: g.created_at,
            challenge: ch,
          }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => !!p);

  const myPactIds = myPacts.map((p) => p.id);
  const challengeIds = myPacts.map((p) => p.challenge.id);
  const challengeToPact = new Map(myPacts.map((p) => [p.challenge.id, p]));
  const pactById = new Map(myPacts.map((p) => [p.id, p]));

  // Phase 2: members + completions for my pacts, in parallel. Both depend on
  // myPactIds / challengeIds but not on each other.
  const now = new Date();
  const lookback30 = new Date(now);
  lookback30.setUTCDate(lookback30.getUTCDate() - 30);

  type NudgeRow = { challenge_id: string };

  // Nudges I've received that are still in their period (i.e. for any pact
  // where I'm a member and the period_start key matches today's daily or
  // this-week's start). We just check >= today and >= weekStart respectively,
  // so a single >= today-2-weeks lookback covers both.
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

  const [
    { data: allMembers },
    { data: allCompletions },
    { data: myNudges },
  ] = await Promise.all([
    myPactIds.length
      ? supabase
          .from("group_members")
          .select("group_id, user_id, joined_at, profiles(display_name)")
          .in("group_id", myPactIds)
          .returns<MemberRow[]>()
      : Promise.resolve({ data: [] as MemberRow[] }),
    challengeIds.length
      ? supabase
          .from("completions")
          .select(
            "id, challenge_id, user_id, completed_at, note, profiles(display_name)",
          )
          .in("challenge_id", challengeIds)
          .gte("completed_at", lookback30.toISOString())
          .order("completed_at", { ascending: false })
          .returns<CompletionRow[]>()
      : Promise.resolve({ data: [] as CompletionRow[] }),
    challengeIds.length
      ? supabase
          .from("nudges")
          .select("challenge_id")
          .eq("to_user_id", user.id)
          .in("challenge_id", challengeIds)
          .gte("period_start", twoWeeksAgo.toISOString().slice(0, 10))
          .returns<NudgeRow[]>()
      : Promise.resolve({ data: [] as NudgeRow[] }),
  ]);

  const nudgedChallengeIds = new Set(
    (myNudges ?? []).map((n) => n.challenge_id),
  );

  const membersByGroup = new Map<string, MemberRow[]>();
  for (const m of allMembers ?? []) {
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push(m);
    membersByGroup.set(m.group_id, list);
  }

  const completions = allCompletions ?? [];

  // ─────────────────────────────────────────────────────────────────────
  // Today band (one-tap circles, one per pact that requires today)
  // ─────────────────────────────────────────────────────────────────────
  const todayDayIdx = (now.getUTCDay() + 6) % 7;
  const dayStart = startOfDay(now);
  const weekStart = startOfPeriodUTC("weekly", now);

  const todayPacts: TodayPact[] = myPacts
    .filter((p) => {
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
      const threshold =
        p.challenge.frequency === "daily" ? dayStart : weekStart;
      const done = completions.some(
        (c) =>
          c.challenge_id === p.challenge.id &&
          c.user_id === user.id &&
          new Date(c.completed_at) >= threshold,
      );
      return {
        id: p.id,
        name: p.name,
        icon: p.icon,
        frequency: p.challenge.frequency,
        doneThisPeriod: done,
        nudged: !done && nudgedChallengeIds.has(p.challenge.id),
      };
    });

  // ─────────────────────────────────────────────────────────────────────
  // Today's notes (cross-pact, with notes only)
  // ─────────────────────────────────────────────────────────────────────
  const todaysNotes = completions
    .filter((c) => c.note && new Date(c.completed_at) >= dayStart)
    .map((c) => {
      const pact = challengeToPact.get(c.challenge_id);
      return {
        id: c.id,
        userName: c.profiles?.display_name ?? "Unknown",
        completedAt: c.completed_at,
        note: c.note as string,
        pactId: pact?.id,
        pactName: pact?.name,
      };
    });

  // ─────────────────────────────────────────────────────────────────────
  // This-week stats: total check-ins, with-notes, perfect days
  // ─────────────────────────────────────────────────────────────────────
  const weekCompletions = completions.filter(
    (c) => new Date(c.completed_at) >= weekStart,
  );
  const weekCheckIns = weekCompletions.length;
  const weekNotes = weekCompletions.filter((c) => c.note).length;

  // Perfect days = (pact, day) where every member required that day checked
  // in. Sum across pacts. Daily pacts only.
  let perfectDays = 0;
  for (const p of myPacts) {
    if (p.challenge.frequency !== "daily") continue;
    const pactCompletions = weekCompletions.filter(
      (c) => c.challenge_id === p.challenge.id,
    );
    const members = membersByGroup.get(p.id) ?? [];
    const dots = buildWeekDots(
      pactCompletions.map((c) => ({
        completed_at: c.completed_at,
        user_id: c.user_id,
      })),
      members.map((m) => ({ user_id: m.user_id, joined_at: m.joined_at })),
      p.challenge.days_of_week,
      now,
    );
    perfectDays += dots.filter((s) => s === "done").length;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Moments: friend streaks (≥ 5), new pacts (≤7d), new joiners (≤7d)
  // ─────────────────────────────────────────────────────────────────────
  type Moment =
    | {
        kind: "streak";
        userName: string;
        pactName: string;
        pactId: string;
        days: number;
        sortAt: number;
      }
    | {
        kind: "newPact";
        pactName: string;
        pactId: string;
        createdAt: string;
        sortAt: number;
      }
    | {
        kind: "newMember";
        userName: string;
        pactName: string;
        pactId: string;
        joinedAt: string;
        sortAt: number;
      };

  const moments: Moment[] = [];
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  // Streaks per (user, pact) where streak ≥ 5 for daily / ≥ 3 for weekly.
  const completionsByUserChallenge = new Map<string, string[]>();
  for (const c of completions) {
    const key = `${c.user_id}:${c.challenge_id}`;
    const list = completionsByUserChallenge.get(key) ?? [];
    list.push(c.completed_at);
    completionsByUserChallenge.set(key, list);
  }

  for (const [key, times] of completionsByUserChallenge) {
    const [uid, cid] = key.split(":");
    const pact = challengeToPact.get(cid);
    if (!pact) continue;
    const streak = currentStreak(
      times,
      pact.challenge.frequency,
      pact.challenge.days_of_week,
      now,
    );
    const threshold = pact.challenge.frequency === "weekly" ? 3 : 5;
    if (streak < threshold) continue;
    if (uid === user.id) continue; // Surface friends' streaks, not your own
    const member = (membersByGroup.get(pact.id) ?? []).find(
      (m) => m.user_id === uid,
    );
    moments.push({
      kind: "streak",
      userName: member?.profiles?.display_name ?? "Someone",
      pactName: pact.name,
      pactId: pact.id,
      days: streak,
      // Streaks sort above the date-based moments. Bigger streak wins.
      sortAt: now.getTime() + streak * 1000,
    });
  }

  // New pacts (created in last 7 days).
  for (const p of myPacts) {
    if (new Date(p.createdAt) >= sevenDaysAgo) {
      moments.push({
        kind: "newPact",
        pactName: p.name,
        pactId: p.id,
        createdAt: p.createdAt,
        sortAt: new Date(p.createdAt).getTime(),
      });
    }
  }

  // New members (joined in last 7 days). Excludes me.
  for (const m of allMembers ?? []) {
    if (m.user_id === user.id) continue;
    if (new Date(m.joined_at) < sevenDaysAgo) continue;
    const pact = pactById.get(m.group_id);
    if (!pact) continue;
    moments.push({
      kind: "newMember",
      userName: m.profiles?.display_name ?? "Someone",
      pactName: pact.name,
      pactId: pact.id,
      joinedAt: m.joined_at,
      sortAt: new Date(m.joined_at).getTime(),
    });
  }

  moments.sort((a, b) => b.sortAt - a.sortAt);
  const topMoments = moments.slice(0, 6);

  const todayLabel = now.toLocaleDateString(undefined, { weekday: "long" });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="mb-5">
        <div className="label mb-1">{todayLabel}</div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="h-display m-0" style={{ fontSize: 40, lineHeight: 1 }}>
            <span style={{ fontStyle: "italic" }}>{greeting()}</span> {firstName}
          </h1>
          <Avatar name={profile?.display_name ?? "?"} size={34} ring />
        </div>
        <Squiggle width={84} className="mt-1" />
      </header>

      <TodayBand pacts={todayPacts} />

      {/* TODAY'S NOTES */}
      <section className="mb-7">
        <div className="label mb-2">today&apos;s notes</div>
        {todaysNotes.length === 0 ? (
          <div
            className="px-5 py-5 text-center"
            style={{
              borderRadius: "var(--radius)",
              border: "1.5px dashed var(--line-strong)",
              color: "var(--ink-soft)",
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 17,
              lineHeight: 1.3,
            }}
          >
            no notes from today
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {todaysNotes.map((n) => (
              <li
                key={n.id}
                className="p-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={n.userName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {n.userName}
                      </span>
                      {n.pactName && n.pactId && (
                        <>
                          <span style={{ color: "var(--mute)", fontSize: 13 }}>
                            in
                          </span>
                          <Link
                            href={`/pacts/${n.pactId}`}
                            style={{
                              fontFamily: "var(--font-display)",
                              fontStyle: "italic",
                              fontSize: 15,
                              color: "var(--ink)",
                              textDecoration: "underline",
                              textDecorationColor: "var(--accent)",
                              textDecorationThickness: 1.5,
                              textUnderlineOffset: 3,
                            }}
                          >
                            {n.pactName}
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="label mt-0.5">
                      {timeAgo(n.completedAt, now)}
                    </div>
                  </div>
                </div>
                <p
                  className="mt-2 whitespace-pre-wrap"
                  style={{
                    fontSize: 15,
                    color: "var(--ink)",
                    lineHeight: 1.4,
                    paddingLeft: 12,
                    borderLeft: "2px solid var(--accent)",
                  }}
                >
                  {n.note}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* THIS WEEK */}
      <section className="mb-7">
        <div className="label mb-2">this week</div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "check-ins", value: weekCheckIns },
            { label: "notes", value: weekNotes },
            { label: "perfect days", value: perfectDays },
          ].map((s) => (
            <div
              key={s.label}
              className="p-3 text-center"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  lineHeight: 1,
                  color: "var(--ink)",
                }}
              >
                {s.value}
              </div>
              <div className="label mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MOMENTS */}
      {topMoments.length > 0 && (
        <section className="mb-4">
          <div className="label mb-2">moments</div>
          <ul className="flex flex-col gap-2">
            {topMoments.map((m, i) => (
              <li
                key={`${m.kind}-${i}`}
                className="flex items-center gap-3 p-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                }}
              >
                <MomentGlyph kind={m.kind} />
                <div className="min-w-0 flex-1">
                  <MomentLine moment={m} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function MomentGlyph({ kind }: { kind: "streak" | "newPact" | "newMember" }) {
  const common: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "var(--font-display)",
    fontSize: 18,
    lineHeight: 1,
  };
  if (kind === "streak")
    return (
      <span
        aria-hidden
        style={{ ...common, background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        ✦
      </span>
    );
  if (kind === "newPact")
    return (
      <span
        aria-hidden
        style={{ ...common, background: "var(--accent2-soft)", color: "#7A4E0F" }}
      >
        +
      </span>
    );
  return (
    <span
      aria-hidden
      style={{ ...common, background: "var(--card-inset)", color: "var(--ink-soft)" }}
    >
      ◐
    </span>
  );
}

function MomentLine({
  moment,
}: {
  moment:
    | { kind: "streak"; userName: string; pactName: string; pactId: string; days: number }
    | { kind: "newPact"; pactName: string; pactId: string; createdAt: string }
    | { kind: "newMember"; userName: string; pactName: string; pactId: string; joinedAt: string };
}) {
  const italic: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontStyle: "italic",
    color: "var(--ink)",
    textDecoration: "underline",
    textDecorationColor: "var(--accent)",
    textDecorationThickness: 1.5,
    textUnderlineOffset: 3,
  };
  if (moment.kind === "streak") {
    return (
      <div style={{ fontSize: 15, lineHeight: 1.35 }}>
        <span style={{ fontWeight: 600 }}>{moment.userName}</span>{" "}
        <span style={{ color: "var(--ink-soft)" }}>is on a</span>{" "}
        <span style={{ fontWeight: 600, color: "var(--accent)" }}>
          {moment.days}-day streak
        </span>{" "}
        <span style={{ color: "var(--ink-soft)" }}>in</span>{" "}
        <Link href={`/pacts/${moment.pactId}`} style={italic}>
          {moment.pactName}
        </Link>
      </div>
    );
  }
  if (moment.kind === "newPact") {
    return (
      <div style={{ fontSize: 15, lineHeight: 1.35 }}>
        <span style={{ color: "var(--ink-soft)" }}>new pact:</span>{" "}
        <Link href={`/pacts/${moment.pactId}`} style={italic}>
          {moment.pactName}
        </Link>
      </div>
    );
  }
  return (
    <div style={{ fontSize: 15, lineHeight: 1.35 }}>
      <span style={{ fontWeight: 600 }}>{moment.userName}</span>{" "}
      <span style={{ color: "var(--ink-soft)" }}>joined</span>{" "}
      <Link href={`/pacts/${moment.pactId}`} style={italic}>
        {moment.pactName}
      </Link>
    </div>
  );
}
