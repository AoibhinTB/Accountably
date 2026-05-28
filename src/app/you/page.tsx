import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/confirm-form";
import { SubmitButton } from "@/components/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { Chevron } from "@/components/ui/chevron";
import { Squiggle } from "@/components/ui/squiggle";
import { currentStreak, type Frequency } from "@/lib/period";
import { EditProfileSheet } from "./edit-profile-sheet";
import { deleteAccount } from "./profile-actions";

const COMMIT_SHA =
  process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? "dev";

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

const stickerForName = (name: string) =>
  name.trim()[0]?.toUpperCase() || "?";

export default async function YouPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/you");

  // Phase 1: profile + pact rows in parallel (both depend only on user id).
  const [{ data: profile }, { data: pactRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, created_at, avatar_color_index")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select(
        "groups(id, name, icon, challenges(id, frequency, archived, days_of_week))",
      )
      .eq("user_id", user.id)
      .returns<PactRow[]>(),
  ]);

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: "long",
      })
    : null;

  const pacts = (pactRows ?? [])
    .flatMap((r) => (r.groups ? [r.groups] : []))
    .map((g) => {
      const active = g.challenges?.find((c) => !c.archived);
      return active
        ? { id: g.id, name: g.name, icon: g.icon, challenge: active }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => !!p);

  const activeChallengeIds = pacts.map((p) => p.challenge.id);

  // My completions across all my active pacts. Used for per-pact streaks and
  // the top "streak" stat (max of all current streaks). 400-day lookback caps
  // the query size while comfortably covering any plausible daily streak.
  const lookback = new Date();
  lookback.setUTCDate(lookback.getUTCDate() - 400);

  // Phase 2: my completions for streak compute + this-month count, parallel.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: myCompletions }, { count: monthCount }] = await Promise.all([
    activeChallengeIds.length
      ? supabase
          .from("completions")
          .select("challenge_id, completed_at")
          .eq("user_id", user.id)
          .in("challenge_id", activeChallengeIds)
          .gte("completed_at", lookback.toISOString())
      : Promise.resolve({
          data: [] as { challenge_id: string; completed_at: string }[],
        }),
    supabase
      .from("completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("completed_at", monthStart.toISOString()),
  ]);

  const completionsByChallenge = new Map<string, string[]>();
  for (const c of myCompletions ?? []) {
    const list = completionsByChallenge.get(c.challenge_id) ?? [];
    list.push(c.completed_at);
    completionsByChallenge.set(c.challenge_id, list);
  }

  const pactsWithStreak = pacts.map((p) => {
    const ts = completionsByChallenge.get(p.challenge.id) ?? [];
    return {
      ...p,
      streak: currentStreak(
        ts,
        p.challenge.frequency,
        p.challenge.days_of_week,
      ),
    };
  });

  const topStreak = pactsWithStreak.reduce(
    (max, p) => Math.max(max, p.streak),
    0,
  );
  const topStreakFreq =
    pactsWithStreak.find((p) => p.streak === topStreak)?.challenge.frequency ??
    "daily";

  const stats = [
    { label: "pacts", value: pactsWithStreak.length },
    {
      label: topStreakFreq === "weekly" ? "streak (wks)" : "streak (days)",
      value: topStreak,
    },
    { label: "check-ins this month", value: monthCount ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="flex flex-col items-center pt-2 text-center">
        <Avatar
          name={profile?.display_name ?? "?"}
          size={96}
          colorIndex={profile?.avatar_color_index ?? null}
          ring
        />
        <h1
          className="h-display m-0"
          style={{ fontSize: 36, marginTop: 14, lineHeight: 1 }}
        >
          {profile?.display_name ?? "you"}
        </h1>
        <Squiggle width={70} />
        <div className="mt-2" style={{ color: "var(--mute)", fontSize: 14 }}>
          {user.email}
          {joined && <> · joined {joined}</>}
        </div>
        <div className="mt-3">
          <EditProfileSheet
            initialName={profile?.display_name ?? ""}
            initialColorIndex={profile?.avatar_color_index ?? null}
          />
        </div>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
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
                fontSize: 30,
                lineHeight: 1,
                color: "var(--ink)",
              }}
            >
              {s.value}
            </div>
            <div className="label mt-1.5">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="mt-7">
        <div className="label mb-2">your pacts</div>
        {pactsWithStreak.length === 0 ? (
          <div
            className="px-5 py-5 text-center"
            style={{
              borderRadius: "var(--radius)",
              border: "1.5px dashed var(--line-strong)",
              color: "var(--ink-soft)",
              fontSize: 14,
            }}
          >
            you&apos;re not in any pacts yet.{" "}
            <Link
              href="/pacts"
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                color: "var(--ink)",
                textDecoration: "underline",
                textDecorationColor: "var(--accent)",
                textUnderlineOffset: 3,
              }}
            >
              start one
            </Link>
            .
          </div>
        ) : (
          <ul
            className="overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            {pactsWithStreak.map((p, i, arr) => (
              <li
                key={p.id}
                style={{
                  borderBottom:
                    i < arr.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <Link
                  href={`/pacts/${p.id}`}
                  className="press flex items-center gap-3 p-3 active:bg-[color:var(--card-inset)]"
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: p.icon ? "inherit" : "var(--font-display)",
                      fontSize: p.icon ? 24 : 22,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    {p.icon ?? stickerForName(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{p.name}</div>
                    <div className="label mt-0.5">
                      {p.challenge.frequency === "weekly"
                        ? "once a week"
                        : p.challenge.days_of_week &&
                            p.challenge.days_of_week.length > 0 &&
                            p.challenge.days_of_week.length < 7
                          ? p.challenge.days_of_week.length === 5 &&
                            p.challenge.days_of_week.every((d, i) => d === i)
                            ? "weekdays"
                            : "custom"
                          : "every day"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-stat-mono)",
                      fontSize: 13,
                      color: "var(--accent)",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {p.streak}{" "}
                    <span style={{ color: "var(--mute)", fontWeight: 400 }}>
                      {p.challenge.frequency === "weekly" ? "wks" : "days"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="label mb-2">settings</div>
        <ul
          className="overflow-hidden"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          {[
            { label: "notifications", href: "/you/notifications" },
            { label: "privacy", href: "/privacy" },
            { label: "about accountably", href: "/about" },
          ].map((row, i, arr) => (
            <li
              key={row.href}
              style={{
                borderBottom:
                  i < arr.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <Link
                href={row.href}
                className="press flex items-center justify-between p-4"
                style={{ color: "var(--ink)" }}
              >
                <span style={{ fontSize: 15 }}>{row.label}</span>
                <Chevron
                  direction="right"
                  size={14}
                  strokeWidth={2}
                  style={{ color: "var(--mute)" }}
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form action="/auth/signout" method="post" className="mt-7">
        <SubmitButton
          pendingLabel="signing out…"
          className="w-full"
          style={{
            minHeight: 52,
            background: "transparent",
            color: "var(--mute)",
            borderRadius: "var(--radius)",
            border: "1.5px dashed var(--line-strong)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          sign out
        </SubmitButton>
      </form>

      <ConfirmForm
        action={deleteAccount}
        message="Delete your account? This permanently removes your data — completions, notes, reactions, nudges, push subscriptions — across every pact. This cannot be undone."
        className="mt-3"
      >
        <SubmitButton
          pendingLabel="deleting…"
          className="w-full"
          style={{
            minHeight: 44,
            background: "transparent",
            color: "#9C1F1F",
            borderRadius: "var(--radius)",
            border: "1.5px solid rgba(156, 31, 31, 0.4)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          delete account
        </SubmitButton>
      </ConfirmForm>

      <div
        className="label mt-8 text-center"
        style={{ fontSize: 10, color: "var(--mute)" }}
      >
        build · {COMMIT_SHA.slice(0, 7)}
      </div>
    </main>
  );
}
