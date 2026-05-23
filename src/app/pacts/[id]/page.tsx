import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/confirm-form";
import { SubmitButton } from "@/components/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { Chevron } from "@/components/ui/chevron";
import { HowOftenPicker } from "@/components/ui/how-often-picker";
import { IconPicker } from "@/components/ui/icon-picker";
import { Squiggle } from "@/components/ui/squiggle";
import {
  currentGroupStreak,
  formatDate,
  startOfPeriodUTC,
  timeAgo,
} from "@/lib/period";
import { CheckInGrid } from "./check-in-grid";
import { IconEditTrigger } from "./icon-edit-trigger";
import { NudgeButton } from "./nudge-button";
import { PactCircle } from "./pact-circle";
import {
  deletePact,
  saveCompletionNote,
  updatePact,
} from "../actions";
import { InviteLink } from "./invite-link";

type Member = {
  user_id: string;
  joined_at: string;
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
        "id, name, icon, invite_code, created_by, created_at, challenges(id, title, description, frequency, start_date, end_date, archived, created_at, days_of_week)",
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
  };

  const membersPromise = supabase
    .from("group_members")
    .select("user_id, joined_at, profiles(display_name, avatar_url)")
    .eq("group_id", id)
    .order("joined_at", { ascending: true })
    .returns<Member[]>();

  const recentCompletionsPromise = challenge
    ? supabase
        .from("completions")
        .select("id, user_id, completed_at, note")
        .eq("challenge_id", challenge.id)
        .gte("completed_at", pactHistoryStart)
        .order("completed_at", { ascending: false })
        .returns<LightCompletion[]>()
    : Promise.resolve({ data: [] as LightCompletion[] });

  const periodStartKey = periodStart
    ? periodStart.toISOString().slice(0, 10)
    : null;

  type NudgeRow = {
    from_user_id: string;
    to_user_id: string;
    profiles: { display_name: string } | null;
  };

  const nudgesPromise =
    challenge && periodStartKey
      ? supabase
          .from("nudges")
          .select(
            "from_user_id, to_user_id, profiles!nudges_from_user_id_fkey(display_name)",
          )
          .eq("challenge_id", challenge.id)
          .eq("period_start", periodStartKey)
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

  const memberStatus = (members ?? []).map((m) => {
    const completion =
      (periodCompletions ?? []).find((c) => c.user_id === m.user_id) ?? null;
    return { member: m, completion };
  });
  const periodDoneCount = memberStatus.filter((s) => s.completion).length;

  // Who have I nudged this period? Who has nudged me?
  const currentUserId = userData.user?.id ?? null;
  const nudgesSentByMe = new Set<string>();
  const nudgersOfMe: string[] = [];
  for (const n of nudges ?? []) {
    if (n.from_user_id === currentUserId) nudgesSentByMe.add(n.to_user_id);
    if (n.to_user_id === currentUserId) {
      nudgersOfMe.push(n.profiles?.display_name ?? "Someone");
    }
  }

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
        className="mx-5 mt-3 px-6 pt-8 pb-7 text-center"
        style={{
          background: "var(--accent2-soft)",
          borderRadius: "var(--radius-lg)",
          position: "relative",
        }}
      >
        <div className="mb-3 flex justify-center">
          <IconEditTrigger targetId="edit-pact" ariaLabel="Change pact icon">
            <div
              className="-rotate-2"
              style={{
                width: 78,
                height: 78,
                borderRadius: 22,
                background: "var(--card)",
                color: "var(--accent)",
                fontFamily: pact.icon ? "inherit" : "var(--font-display)",
                fontSize: pact.icon ? 44 : 42,
                boxShadow: "0 4px 0 rgba(42,31,24,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden
            >
              {pact.icon ?? stickerForName(pact.name)}
            </div>
          </IconEditTrigger>
        </div>
        <h1 className="h-display m-0" style={{ fontSize: 32 }}>
          {pact.name}
        </h1>
        <Squiggle width={84} className="mx-auto" />
        {challenge && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="pill">
              {cadenceLabel(challenge.frequency, challenge.days_of_week)}
            </span>
            <span className="label">
              since {formatDate(challenge.start_date)}
              {challenge.end_date && ` · until ${formatDate(challenge.end_date)}`}
            </span>
          </div>
        )}
        {challenge?.description && (
          <p
            className="note mx-auto mt-4"
            style={{
              maxWidth: 360,
              paddingLeft: 12,
              borderLeft: "2px solid var(--accent)",
              textAlign: "left",
              fontSize: 16,
            }}
          >
            &ldquo;{challenge.description}&rdquo;
          </p>
        )}
        <div className="mt-4 flex items-center justify-center gap-2.5">
          {members && members.length > 0 && (
            <div className="avastack">
              {members.slice(0, 5).map((m) => (
                <Avatar
                  key={m.user_id}
                  name={m.profiles?.display_name ?? "?"}
                  size={28}
                />
              ))}
            </div>
          )}
          {members && members.length > 5 && (
            <span className="label">+{members.length - 5}</span>
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
        <section className="px-5 pt-6 flex justify-center">
          <PactCircle
            pactId={pact.id}
            icon={pact.icon}
            initialDone={!!myCurrentCompletion}
            periodLabel={periodLabel}
          />
        </section>
      )}

      {challenge && memberStatus.length > 0 && (
        <section className="px-5 pt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label">{periodLabel}</span>
            <span
              style={{
                fontFamily: "var(--font-stat-mono)",
                fontSize: 12,
                color: "var(--mute)",
              }}
            >
              {periodDoneCount}/{memberStatus.length} checked in
            </span>
          </div>
          <ul
            className="overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            {memberStatus.map(({ member: m, completion }, i, arr) => {
              const isYou = m.user_id === userData.user?.id;
              const name = m.profiles?.display_name ?? "unknown";
              return (
                <li
                  key={m.user_id}
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <div className="flex items-center gap-3 p-3">
                    <Avatar name={name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div style={{ fontWeight: 500, fontSize: 15 }}>
                        {name}
                        {isYou && (
                          <span style={{ color: "var(--mute)", fontWeight: 400 }}>
                            {" · you"}
                          </span>
                        )}
                      </div>
                      <div className="label mt-0.5">
                        {completion
                          ? `checked in · ${timeAgo(completion.completed_at)}`
                          : isYou && nudgersOfMe.length > 0
                            ? `nudged by ${nudgersOfMe[0]}${
                                nudgersOfMe.length > 1
                                  ? ` +${nudgersOfMe.length - 1}`
                                  : ""
                              }`
                            : "still pending"}
                      </div>
                    </div>
                    {!completion && !isYou && (
                      <NudgeButton
                        pactId={pact.id}
                        toUserId={m.user_id}
                        alreadyNudged={nudgesSentByMe.has(m.user_id)}
                      />
                    )}
                    {completion ? (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        style={{ color: "var(--accent)", flexShrink: 0 }}
                      >
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    ) : (
                      <div
                        aria-hidden
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: "1.5px dashed var(--line-strong)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>

                </li>
              );
            })}
          </ul>

          {myCurrentCompletion && (
            <details className="group mt-3">
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
                <span>
                  {myCurrentCompletion.note ? "edit note" : "add a note"}
                </span>
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
          )}
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

      <section className="px-5 pt-8">
        <details className="group">
          <summary
            className="press flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "0 18px",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            <span className="inline-flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="9" cy="9" r="3.4" />
                <circle cx="17" cy="11" r="2.6" />
                <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14 18c.4-1.8 1.8-3 3.2-3s2.6.8 3.3 2" />
              </svg>
              <span>
                members &amp; invite
                {members && members.length > 0 ? ` · ${members.length}` : ""}
              </span>
            </span>
            <Chevron
              direction="down"
              size={14}
              strokeWidth={2}
              className="transition-transform group-open:rotate-180"
              style={{ color: "var(--mute)" }}
            />
          </summary>
          <div
            className="mt-3 p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <div className="label mb-2">members ({members?.length ?? 0})</div>
            <ul
              className="overflow-hidden"
              style={{
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
              }}
            >
              {(members ?? []).map((m, i, arr) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 p-3"
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <Avatar name={m.profiles?.display_name ?? "?"} size={34} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontWeight: 500, fontSize: 15 }}>
                      {m.profiles?.display_name ?? "unknown"}
                      {m.user_id === pact.created_by && (
                        <span
                          className="ml-2"
                          style={{
                            fontFamily: "var(--font-stat-mono)",
                            fontSize: 10,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--accent)",
                          }}
                        >
                          creator
                        </span>
                      )}
                    </div>
                    <div className="label mt-0.5">
                      joined {formatDate(m.joined_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="label mt-5 mb-2">invite</div>
            <p className="mb-2 text-xs" style={{ color: "var(--mute)" }}>
              anyone with this link can join the pact.
            </p>
            <InviteLink url={inviteUrl} code={pact.invite_code} />
          </div>
        </details>
      </section>

      {challenge && (
        <section className="px-5 pt-5">
          <details className="group" id="edit-pact">
            <summary
              className="press inline-flex min-h-12 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "0 18px",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                color: "var(--ink)",
              }}
            >
              <span>edit pact</span>
              <Chevron
                direction="down"
                size={14}
                strokeWidth={2}
                className="transition-transform group-open:rotate-180"
                style={{ color: "var(--mute)" }}
              />
            </summary>
            <div
              className="mt-3 p-4"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
              }}
            >
              <form action={updatePact} className="mb-5 flex flex-col gap-3">
                <input type="hidden" name="pact_id" value={pact.id} />
                <label className="block">
                  <span className="label">Name</span>
                  <input
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    defaultValue={pact.name}
                    className="mt-1.5 w-full outline-none"
                    style={inputStyle}
                  />
                </label>
                <IconPicker defaultValue={pact.icon} />
                <label className="block">
                  <span className="label">Description (optional)</span>
                  <textarea
                    name="description"
                    rows={2}
                    maxLength={500}
                    defaultValue={challenge.description ?? ""}
                    className="mt-1.5 w-full resize-none outline-none"
                    style={{
                      ...inputStyle,
                      height: "auto",
                      paddingTop: 12,
                      paddingBottom: 12,
                      fontFamily: "var(--font-display)",
                      fontStyle: "italic",
                    }}
                  />
                </label>
                <HowOftenPicker
                  defaultFrequency={challenge.frequency}
                  defaultDays={
                    challenge.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]
                  }
                />

                <details className="group">
                  <summary
                    className="press flex min-h-11 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden"
                    style={{
                      padding: "0 14px",
                      background: "var(--card-inset)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      color: "var(--ink-soft)",
                      fontSize: 14,
                    }}
                  >
                    <span>custom dates</span>
                    <Chevron
                      direction="down"
                      size={14}
                      strokeWidth={2}
                      className="transition-transform group-open:rotate-180"
                      style={{ color: "var(--mute)" }}
                    />
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="label">start date</span>
                      <input
                        name="start_date"
                        type="date"
                        defaultValue={challenge.start_date}
                        className="mt-1.5 w-full outline-none"
                        style={dateInputStyle}
                      />
                    </label>
                    <label className="block">
                      <span className="label">end date</span>
                      <input
                        name="end_date"
                        type="date"
                        defaultValue={challenge.end_date ?? ""}
                        className="mt-1.5 w-full outline-none"
                        style={dateInputStyle}
                      />
                    </label>
                  </div>
                </details>
                <SubmitButton pendingLabel="saving…" style={primaryStyle}>
                  save changes
                </SubmitButton>
              </form>

              {isCreator && (
                <div
                  className="p-3"
                  style={{
                    borderRadius: "var(--radius)",
                    border: "1px solid rgba(156, 31, 31, 0.25)",
                    background: "rgba(216, 98, 58, 0.06)",
                  }}
                >
                  <p
                    className="mb-3 text-xs"
                    style={{ color: "#7A1F1F", lineHeight: 1.4 }}
                  >
                    deleting this pact permanently removes all completions and
                    reactions. this can&apos;t be undone. only the creator can
                    delete.
                  </p>
                  <ConfirmForm
                    action={deletePact}
                    message={`Delete "${pact.name}"? All completions and reactions in this pact will be permanently deleted. This cannot be undone.`}
                  >
                    <input type="hidden" name="pact_id" value={pact.id} />
                    <SubmitButton pendingLabel="deleting…" style={dangerStyle}>
                      delete pact
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              )}
            </div>
          </details>
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

const dateInputStyle: React.CSSProperties = {
  height: 44,
  background: "var(--card-inset)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  padding: "0 12px",
  fontSize: 14,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  textAlign: "left",
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

const dangerStyle: React.CSSProperties = {
  minHeight: 44,
  background: "var(--card)",
  color: "#9C1F1F",
  borderRadius: "var(--radius)",
  border: "1.5px solid rgba(156, 31, 31, 0.4)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  padding: "0 18px",
};
