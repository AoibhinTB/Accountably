import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { Chevron } from "@/components/ui/chevron";
import {
  currentGroupStreak,
  formatDate,
  startOfPeriodUTC,
  timeAgo,
} from "@/lib/period";
import { CheckInGrid } from "./check-in-grid";
import { EditPactDialog } from "./edit-pact-dialog";
import { IconEditTrigger } from "./icon-edit-trigger";
import { MetricSideBySide } from "./metric-widget";
import { NotesHistory } from "./notes-history";
import { NudgeButton } from "./nudge-button";
import { PactCircle } from "./pact-circle";
import { saveCompletionNote } from "../actions";
import { summarizeReactions } from "@/components/reactions/constants";

type Member = {
  user_id: string;
  joined_at: string;
  reminder_time: string | null;
  reminder_timezone: string | null;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly";
  start_date: string;
  end_date: string | null;
  archived: boolean;
  created_at: string;
  days_of_week: number[] | null;
  metric_kind: string | null;
  metric_name: string | null;
};

const stickerForName = (name: string) =>
  name.trim()[0]?.toUpperCase() || "?";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const cadenceLabel = (
  frequency: "daily" | "weekly",
  daysOfWeek: number[] | null,
): string => {
  if (frequency === "weekly") return "once a week";
  if (!daysOfWeek || daysOfWeek.length === 0) return "every day";
  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  if (sorted.length === 7) return "every day";
  if (sorted.length === 5 && sorted.every((d, i) => d === i)) return "weekdays";
  if (sorted.length === 2 && sorted[0] === 5 && sorted[1] === 6)
    return "weekends";
  if (sorted.length === 1) return DAY_SHORT[sorted[0]];
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
};

export default async function PactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  // Phase 1: pact + auth in parallel — neither depends on the other.
  const [pactResult, userResult] = await Promise.all([
    supabase
      .from("groups")
      .select(
        "id, name, icon, invite_code, created_by, created_at, challenges(id, title, description, frequency, start_date, end_date, archived, created_at, days_of_week, metric_kind, metric_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const pact = pactResult.data;
  if (!pact) notFound();
  const userData = userResult.data;

  const challenge: Challenge | null =
    (pact.challenges as Challenge[] | null)?.find((c) => !c.archived) ?? null;

  const isCreator = userData.user?.id === pact.created_by;

  const periodStart = challenge ? startOfPeriodUTC(challenge.frequency) : null;
  const periodLabel = challenge?.frequency === "weekly" ? "this week" : "today";

  // Phase 2: members + feed completions + all-pact-history completions in
  // parallel. We fetch the full pact history so the grid can render every
  // column from pact-start to today (instead of only the last 60 days).
  // Falls back to "epoch-ish" if there's no challenge — the recentCompletions
  // promise is short-circuited in that case anyway.
  const pactHistoryStart = challenge?.start_date
    ? `${challenge.start_date}T00:00:00Z`
    : "1970-01-01T00:00:00Z";

  type LightCompletion = {
    id: string;
    user_id: string;
    completed_at: string;
    note: string | null;
    metric_value: number | null;
    reactions: { emoji: string; user_id: string }[] | null;
  };

  const membersPromise = supabase
    .from("group_members")
    .select(
      "user_id, joined_at, reminder_time, reminder_timezone, profiles(display_name, avatar_url)",
    )
    .eq("group_id", id)
    .order("joined_at", { ascending: true })
    .returns<Member[]>();

  const recentCompletionsPromise = challenge
    ? supabase
        .from("completions")
        .select(
          "id, user_id, completed_at, note, metric_value, reactions(emoji, user_id)",
        )
        .eq("challenge_id", challenge.id)
        .gte("completed_at", pactHistoryStart)
        .order("completed_at", { ascending: false })
        .returns<LightCompletion[]>()
    : Promise.resolve({ data: [] as LightCompletion[] });

  const periodStartKey = periodStart
    ? periodStart.toISOString().slice(0, 10)
    : null;

  type NudgeRow = {
    to_user_id: string;
    created_at: string;
  };

  const nudgesPromise =
    challenge && periodStartKey
      ? supabase
          .from("nudges")
          .select("to_user_id, created_at")
          .eq("challenge_id", challenge.id)
          .eq("period_start", periodStartKey)
          .order("created_at", { ascending: false })
          .returns<NudgeRow[]>()
      : Promise.resolve({ data: [] as NudgeRow[] });

  const [
    { data: members },
    { data: recentCompletions },
    { data: nudges },
  ] = await Promise.all([
    membersPromise,
    recentCompletionsPromise,
    nudgesPromise,
  ]);

  // Derive period subset for the per-member today list.
  const periodCompletions = periodStart
    ? (recentCompletions ?? []).filter(
        (c) => new Date(c.completed_at) >= periodStart,
      )
    : [];
  // My current-period completion is the most recent one I've logged within
  // the period. The "add a note" disclosure binds to its id.
  const myCurrentCompletion =
    challenge && userData.user
      ? (periodCompletions ?? []).find(
          (c) => c.user_id === userData.user!.id,
        ) ?? null
      : null;

  // Latest nudge per recipient (anyone → recipient) for this period. The
  // nudges query is sorted desc, so the first row we see for a recipient is
  // their most-recent.
  const currentUserId = userData.user?.id ?? null;
  const latestNudgeByRecipient = new Map<string, string>();
  for (const n of nudges ?? []) {
    if (!latestNudgeByRecipient.has(n.to_user_id)) {
      latestNudgeByRecipient.set(n.to_user_id, n.created_at);
    }
  }

  // Members who haven't checked in this period, excluding the current user.
  // Drives the "still pending" nudge list under the grid.
  const pendingToNudge = (members ?? [])
    .filter((m) => {
      if (m.user_id === currentUserId) return false;
      return !(periodCompletions ?? []).some((c) => c.user_id === m.user_id);
    })
    .map((m) => ({
      user_id: m.user_id,
      name: m.profiles?.display_name ?? "unknown",
      latestNudge: latestNudgeByRecipient.get(m.user_id) ?? null,
    }));

  // Notes history below the grid: every completion in this pact that has a
  // non-empty note, newest first. Display names come from the members list
  // so we do not have to refetch profiles per row.
  const nameByUserId = new Map(
    (members ?? []).map((m) => [
      m.user_id,
      m.profiles?.display_name ?? "unknown",
    ]),
  );
  const notesForHistory = (recentCompletions ?? [])
    .filter((c) => c.note && c.note.trim().length > 0)
    .map((c) => ({
      id: c.id,
      user_id: c.user_id,
      display_name: nameByUserId.get(c.user_id) ?? "unknown",
      completed_at: c.completed_at,
      note: c.note as string,
      metric_value: c.metric_value,
      reactions: summarizeReactions(c.reactions ?? [], currentUserId),
    }));

  // Group streak — consecutive periods where every expected member checked in.
  const groupStreak = challenge
    ? currentGroupStreak(
        recentCompletions ?? [],
        (members ?? []).map((m) => ({
          user_id: m.user_id,
          joined_at: m.joined_at,
        })),
        challenge.frequency,
        challenge.days_of_week,
      )
    : 0;
  const groupStreakUnit =
    challenge?.frequency === "weekly"
      ? groupStreak === 1
        ? "week"
        : "weeks"
      : groupStreak === 1
        ? "day"
        : "days";

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/join/${pact.invite_code}`;

  return (
    <main className="mx-auto w-full max-w-2xl pt-6 pb-28">
      <div className="px-5">
        <Link
          href="/pacts"
          className="press inline-flex min-h-10 items-center gap-1.5 text-sm"
          style={{ color: "var(--ink-soft)" }}
        >
          <Chevron direction="left" size={14} strokeWidth={2} />
          <span>your pacts</span>
        </Link>
      </div>

      <section
        className="mx-5 mt-3 p-4 flex items-start gap-3"
        style={{
          background: "var(--accent2-soft)",
          borderRadius: "var(--radius)",
          position: "relative",
        }}
      >
        {challenge &&
          (() => {
            const me = (members ?? []).find(
              (m) => m.user_id === userData.user?.id,
            );
            return (
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <EditPactDialog
                  pactId={pact.id}
                  pactName={pact.name}
                  pactIcon={pact.icon}
                  challenge={{
                    description: challenge.description,
                    frequency: challenge.frequency,
                    days_of_week: challenge.days_of_week,
                    start_date: challenge.start_date,
                    end_date: challenge.end_date,
                    metric_kind: challenge.metric_kind,
                    metric_name: challenge.metric_name,
                  }}
                  isCreator={isCreator}
                  reminder={{
                    time: me?.reminder_time ?? null,
                    timezone: me?.reminder_timezone ?? null,
                  }}
                  members={(members ?? []).map((m) => ({
                    user_id: m.user_id,
                    joined_at: m.joined_at,
                    display_name: m.profiles?.display_name ?? "unknown",
                  }))}
                  createdById={pact.created_by}
                  inviteUrl={inviteUrl}
                  inviteCode={pact.invite_code}
                />
              </div>
            );
          })()}
        <IconEditTrigger ariaLabel="Change pact icon">
          <div
            className="-rotate-2"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "var(--card)",
              color: "var(--accent)",
              fontFamily: pact.icon ? "inherit" : "var(--font-display)",
              fontSize: pact.icon ? 28 : 26,
              boxShadow: "0 2px 0 rgba(42,31,24,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-hidden
          >
            {pact.icon ?? stickerForName(pact.name)}
          </div>
        </IconEditTrigger>
        <div className="min-w-0 flex-1">
          <h1
            className="h-display m-0"
            style={{ fontSize: 22, lineHeight: 1.1 }}
          >
            {pact.name}
          </h1>
          {challenge && (
            <div className="label mt-1">
              {cadenceLabel(challenge.frequency, challenge.days_of_week)}
              {" · since "}
              {formatDate(challenge.start_date)}
              {challenge.end_date && ` · until ${formatDate(challenge.end_date)}`}
            </div>
          )}
          {members && members.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="avastack">
                {members.slice(0, 4).map((m) => (
                  <Avatar
                    key={m.user_id}
                    name={m.profiles?.display_name ?? "?"}
                    size={22}
                  />
                ))}
              </div>
              <span className="label">
                {members.length} friend{members.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
          {challenge?.description && (
            <p
              className="note mt-2"
              style={{
                paddingLeft: 10,
                borderLeft: "2px solid var(--accent)",
                textAlign: "left",
                fontSize: 14,
                lineHeight: 1.35,
              }}
            >
              &ldquo;{challenge.description}&rdquo;
            </p>
          )}
        </div>
      </section>

      {error && (
        <div
          className="mx-5 mt-5 px-4 py-3 text-sm"
          style={{
            borderRadius: "var(--radius)",
            border: "1px solid rgba(156, 31, 31, 0.3)",
            background: "rgba(216, 98, 58, 0.1)",
            color: "#7A1F1F",
          }}
        >
          {error}
        </div>
      )}

      {challenge && (
        <section className="pt-6">
          {challenge.metric_kind ? (
            <MetricSideBySide
              metricKind={challenge.metric_kind as "count" | "minutes"}
              metricName={challenge.metric_name}
              completions={(recentCompletions ?? []).map((c) => ({
                user_id: c.user_id,
                metric_value: c.metric_value,
                completed_at: c.completed_at,
              }))}
              members={(members ?? []).map((m) => ({
                user_id: m.user_id,
                display_name: m.profiles?.display_name ?? "unknown",
              }))}
              currentUserId={currentUserId}
              circle={
                <PactCircle
                  pactId={pact.id}
                  icon={pact.icon}
                  initialDone={!!myCurrentCompletion}
                  periodLabel={periodLabel}
                />
              }
            />
          ) : (
            <div className="px-5 flex justify-center">
              <PactCircle
                pactId={pact.id}
                icon={pact.icon}
                initialDone={!!myCurrentCompletion}
                periodLabel={periodLabel}
              />
            </div>
          )}
        </section>
      )}

      {challenge && myCurrentCompletion && !myCurrentCompletion.note && (
        <section className="px-5 pt-3 flex justify-center">
          <details className="group">
            <summary
              className="press inline-flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden"
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: "transparent",
                border: "1px solid var(--line-strong)",
                color: "var(--ink-soft)",
                fontFamily: "var(--font-stat-mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>add a note</span>
            </summary>
            <form
              action={saveCompletionNote}
              className="mt-2.5 flex flex-col gap-2.5"
            >
              <input type="hidden" name="pact_id" value={pact.id} />
              <input
                type="hidden"
                name="completion_id"
                value={myCurrentCompletion.id}
              />
              <textarea
                name="note"
                rows={2}
                maxLength={500}
                defaultValue={myCurrentCompletion.note ?? ""}
                placeholder="how did it go?"
                className="w-full resize-none outline-none"
                style={{
                  ...inputStyle,
                  height: "auto",
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontSize: 16,
                }}
              />
              {challenge.metric_kind && (
                <label className="block">
                  <span className="label">
                    {challenge.metric_kind === "minutes"
                      ? "minutes"
                      : challenge.metric_name ?? "units"}
                  </span>
                  <input
                    name="metric_value"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    defaultValue={myCurrentCompletion.metric_value ?? ""}
                    placeholder="0"
                    className="mt-1.5 w-full outline-none"
                    style={{
                      ...inputStyle,
                      height: 44,
                      paddingTop: 0,
                      paddingBottom: 0,
                      fontSize: 15,
                    }}
                  />
                </label>
              )}
              <SubmitButton
                pendingLabel="saving…"
                style={{
                  ...primaryStyle,
                  minHeight: 40,
                  fontSize: 14,
                  alignSelf: "flex-start",
                  padding: "0 16px",
                }}
              >
                {myCurrentCompletion.note ? "update note" : "save note"}
              </SubmitButton>
            </form>
          </details>
        </section>
      )}

      {challenge && (
        <section className="px-5 pt-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="label">check-ins</span>
            {groupStreak > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {groupStreak}
                </span>{" "}
                {groupStreakUnit} group streak
              </span>
            )}
          </div>
          <CheckInGrid
            pactId={pact.id}
            currentUserId={currentUserId}
            challenge={{
              frequency: challenge.frequency,
              days_of_week: challenge.days_of_week,
              start_date: challenge.start_date,
            }}
            members={(members ?? []).map((m) => ({
              user_id: m.user_id,
              joined_at: m.joined_at,
              display_name: m.profiles?.display_name ?? "unknown",
            }))}
            completions={(recentCompletions ?? []).map((c) => ({
              user_id: c.user_id,
              completed_at: c.completed_at,
            }))}
          />
        </section>
      )}

      {challenge && notesForHistory.length > 0 && (
        <NotesHistory
          notes={notesForHistory}
          currentUserId={currentUserId}
          metricKind={
            (challenge.metric_kind as "count" | "minutes" | null) ?? null
          }
          metricName={challenge.metric_name}
          pactId={pact.id}
        />
      )}

      {challenge && pendingToNudge.length > 0 && (
        <section className="px-5 pt-6">
          <div className="label mb-2">still pending</div>
          <ul
            className="overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            {pendingToNudge.map((m, i, arr) => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 p-3"
                style={{
                  borderBottom:
                    i < arr.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{m.name}</div>
                  {m.latestNudge && (
                    <div className="label mt-0.5">
                      just nudged · {timeAgo(m.latestNudge)}
                    </div>
                  )}
                </div>
                <NudgeButton pactId={pact.id} toUserId={m.user_id} />
              </li>
            ))}
          </ul>
        </section>
      )}

    </main>
  );
}

const inputStyle: React.CSSProperties = {
  height: 52,
  background: "var(--card-inset)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 16px",
  fontSize: 16,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
};

const primaryStyle: React.CSSProperties = {
  minHeight: 52,
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "var(--radius)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 16,
  padding: "0 22px",
};
