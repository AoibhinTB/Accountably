"use client";

import {
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toggleDayCompletion, togglePeriodCompletion } from "../actions";
import { Avatar } from "@/components/ui/avatar";
import { NoteSheet, type NoteSheetPrompt } from "@/components/note-sheet";

type Frequency = "daily" | "weekly";

type Member = {
  user_id: string;
  joined_at: string;
  display_name: string;
  avatar_color_index: number | null;
};

type Completion = {
  user_id: string;
  completed_at: string;
  metric_value?: number | null;
};

type CellState = "done" | "partial" | "pending" | "rest" | "prePact" | "preJoin";

const DAY_MS = 86_400_000;
const MIN_DAILY_COLS = 14;
const MIN_WEEKLY_COLS = 8;

function startOfPeriod(date: Date, frequency: Frequency): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  if (frequency === "weekly") {
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
  }
  return d;
}

function periodKeyOf(date: Date, frequency: Frequency): string {
  return startOfPeriod(date, frequency).toISOString().slice(0, 10);
}

const FORMAT_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

function formatCellDate(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleDateString(undefined, FORMAT_OPTS);
}

// Today first, going right = older. Always at least minCount columns; if the
// pact is younger than that, pad with pre-pact-start columns to keep the row
// looking complete.
function generateColumns(
  startDate: Date,
  now: Date,
  frequency: Frequency,
  minCount: number,
): { key: string; isPrePact: boolean }[] {
  const stepMs = (frequency === "daily" ? 1 : 7) * DAY_MS;
  const todayPeriod = startOfPeriod(now, frequency);
  const startPeriod = startOfPeriod(startDate, frequency);

  // How many active pact columns (today back to pact-start inclusive)?
  const activeCount = Math.max(
    1,
    Math.round((todayPeriod.getTime() - startPeriod.getTime()) / stepMs) + 1,
  );
  const total = Math.max(minCount, activeCount);

  const cols: { key: string; isPrePact: boolean }[] = [];
  for (let i = 0; i < total; i++) {
    const cursorMs = todayPeriod.getTime() - i * stepMs;
    const key = new Date(cursorMs).toISOString().slice(0, 10);
    cols.push({ key, isPrePact: cursorMs < startPeriod.getTime() });
  }
  return cols;
}

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function dailyColLabels(key: string): { dow: string; dayNum: string } {
  const d = new Date(`${key}T00:00:00Z`);
  return {
    dow: DAY_INITIALS[d.getUTCDay()],
    dayNum: String(d.getUTCDate()),
  };
}

function weeklyColLabels(key: string): { line1: string; line2: string } {
  const d = new Date(`${key}T00:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return { line1: dd, line2: `/${mm}` };
}

export function CheckInGrid({
  pactId,
  pactName,
  currentUserId,
  challenge,
  members,
  completions,
}: {
  pactId: string;
  pactName: string;
  currentUserId: string | null;
  challenge: {
    frequency: Frequency;
    days_of_week: number[] | null;
    start_date: string;
    target_per_period: number;
    metric_kind: "count" | "minutes" | null;
    metric_name: string | null;
  };
  members: Member[];
  completions: Completion[];
}) {
  const now = new Date();
  const startDate = new Date(`${challenge.start_date}T00:00:00Z`);
  const target = Math.max(1, challenge.target_per_period ?? 1);
  // Weekly-flex pacts (e.g. 3× a week, any day) render daily columns so the
  // user can see individual log days instead of a single weekly cell. The
  // perfect-week tint still spans the whole week so the visual rhythm reads
  // like a daily grid.
  const isWeeklyFlex = challenge.frequency === "weekly" && target > 1;
  const colFrequency: Frequency =
    challenge.frequency === "weekly" && !isWeeklyFlex ? "weekly" : "daily";
  const minCount =
    colFrequency === "daily" ? MIN_DAILY_COLS : MIN_WEEKLY_COLS;
  const columns = generateColumns(startDate, now, colFrequency, minCount);
  const todayKey = periodKeyOf(now, colFrequency);
  const stepMs = (colFrequency === "daily" ? 1 : 7) * DAY_MS;

  // Bucket completions by (column_key, user_id) — for daily and weekly-flex
  // grids the column key is the specific day; for plain weekly grids it's the
  // week-start. This drives "is this cell at-target" for daily/weekly and the
  // 0-or-1 per-day fill for weekly-flex.
  const countByPeriodUser = new Map<string, Map<string, number>>();
  for (const c of completions) {
    const key = periodKeyOf(new Date(c.completed_at), colFrequency);
    const inner = countByPeriodUser.get(key) ?? new Map<string, number>();
    inner.set(c.user_id, (inner.get(c.user_id) ?? 0) + 1);
    countByPeriodUser.set(key, inner);
  }
  const serverCountFor = (key: string, userId: string): number =>
    countByPeriodUser.get(key)?.get(userId) ?? 0;
  // For weekly-flex the per-day cell is binary (done if any check that day),
  // so "isDoneServer" only compares against 1. The weekly target is tracked
  // separately for perfect-week detection.
  const cellTarget = isWeeklyFlex ? 1 : target;
  const isDoneServer = (key: string, userId: string): boolean =>
    serverCountFor(key, userId) >= cellTarget;

  // For weekly-flex: separately bucket completions per week, so we can decide
  // whether a week is "perfect" (every expected member hit weekly target).
  const weeklyCountByUser = new Map<string, Map<string, number>>();
  if (isWeeklyFlex) {
    for (const c of completions) {
      const wKey = periodKeyOf(new Date(c.completed_at), "weekly");
      const inner = weeklyCountByUser.get(wKey) ?? new Map<string, number>();
      inner.set(c.user_id, (inner.get(c.user_id) ?? 0) + 1);
      weeklyCountByUser.set(wKey, inner);
    }
  }
  const weekKeyOfCol = (colKey: string): string =>
    periodKeyOf(new Date(`${colKey}T00:00:00Z`), "weekly");

  const dayIdxOfKey = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    return (d.getUTCDay() + 6) % 7;
  };
  const isRequired = (key: string) =>
    challenge.frequency !== "daily" ||
    challenge.days_of_week === null ||
    challenge.days_of_week.length === 0 ||
    challenge.days_of_week.includes(dayIdxOfKey(key));

  // Optimistic toggle state. Set members reflect *flipped* state vs the
  // server data — tapping a pending cell adds it (locally → done), tapping
  // a done cell adds it too (locally → un-done). Resolves back to server
  // state on revalidate.
  const [toggled, toggleOptimistic] = useOptimistic<Set<string>, string>(
    new Set(),
    (state, key) => {
      const next = new Set(state);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    },
  );
  const [isPending, startTransition] = useTransition();
  const [memberModal, setMemberModal] = useState<Member | null>(null);
  const [notePrompt, setNotePrompt] = useState<NoteSheetPrompt | null>(null);

  const memberJoinTimes = members.map((m) => ({
    user_id: m.user_id,
    joinedAt: new Date(m.joined_at).getTime(),
  }));

  // Helper: count for the current user including optimistic state.
  // - daily / weekly: at target → wraps to 0 on tap; otherwise +1 (cycle)
  // - weekly-flex daily cell: pure toggle 0 ↔ 1 for that day
  const myCountOptimistic = (key: string): number => {
    if (!currentUserId) return 0;
    const serverCount = serverCountFor(key, currentUserId);
    if (!toggled.has(key)) return serverCount;
    if (isWeeklyFlex) return serverCount > 0 ? 0 : 1;
    return serverCount >= target ? 0 : serverCount + 1;
  };
  const isMyDone = (key: string): boolean =>
    myCountOptimistic(key) >= cellTarget;

  const perfectColumns = new Set<string>();
  for (const col of columns) {
    if (col.isPrePact) continue;
    if (!isRequired(col.key)) continue;
    if (isWeeklyFlex) {
      // For weekly-flex: a day cell counts as perfect when its WEEK is perfect
      // (every expected member hit weekly target). The whole perfect week
      // therefore shows the lavender tint across all 7 of its day columns.
      const wKey = weekKeyOfCol(col.key);
      const weekEndMs =
        new Date(`${wKey}T00:00:00Z`).getTime() + 7 * DAY_MS;
      const expected = memberJoinTimes.filter((m) => m.joinedAt < weekEndMs);
      if (expected.length === 0) continue;
      const inner = weeklyCountByUser.get(wKey);
      const allMet = expected.every(
        (m) => (inner?.get(m.user_id) ?? 0) >= target,
      );
      if (allMet) perfectColumns.add(col.key);
      continue;
    }
    const colEndMs = new Date(`${col.key}T00:00:00Z`).getTime() + stepMs;
    const expected = memberJoinTimes.filter((m) => m.joinedAt < colEndMs);
    if (expected.length === 0) continue;
    const doneSet = new Set<string>();
    for (const m of expected) {
      if (isDoneServer(col.key, m.user_id)) doneSet.add(m.user_id);
    }
    if (currentUserId) {
      const meDone = isMyDone(col.key);
      if (meDone) doneSet.add(currentUserId);
      else doneSet.delete(currentUserId);
    }
    if (expected.every((m) => doneSet.has(m.user_id))) {
      perfectColumns.add(col.key);
    }
  }

  // Streak length per column — counts the run of consecutive perfect columns
  // ending at (and including) this one, walking oldest → newest. Used for the
  // gradient deepening and for the milestone medals at 5 / 10 / 30.
  const streakLengthByKey = new Map<string, number>();
  {
    const oldestFirst = [...columns].reverse();
    let streak = 0;
    for (const col of oldestFirst) {
      if (col.isPrePact) {
        streak = 0;
        continue;
      }
      if (perfectColumns.has(col.key)) {
        streak += 1;
        streakLengthByKey.set(col.key, streak);
      } else if (!isRequired(col.key)) {
        // rest days don't reset the streak in daily pacts (you can't fail a
        // day that isn't required), they just don't extend it either.
        continue;
      } else {
        streak = 0;
      }
    }
  }

  const perfectFill = (streak: number, base: number, span: number): string => {
    // Lavender (R 156 G 122 B 184). Ramp opacity with streak length so a long
    // run reads deeper. base is the floor alpha, span is the additional alpha
    // gained as the streak grows toward 14.
    const t = Math.min(1, Math.max(0, streak) / 14);
    const a = base + span * t;
    return `rgba(156, 122, 184, ${a.toFixed(3)})`;
  };

  // Medal milestones — show on the column where the streak first hits the
  // threshold so you can see "this is where I hit 5/10/30".
  const medalFor = (streak: number): "bronze" | "silver" | "gold" | null => {
    if (streak === 5) return "bronze";
    if (streak === 10) return "silver";
    if (streak === 30) return "gold";
    return null;
  };
  // Highest medal earned by an ongoing streak — gold for 30+, silver for 10+,
  // bronze for 5+. If the streak resets, this returns null so the medal
  // disappears from the chip strip and the column header.
  const bestMedalFor = (
    max: number,
  ): "bronze" | "silver" | "gold" | null => {
    if (max >= 30) return "gold";
    if (max >= 10) return "silver";
    if (max >= 5) return "bronze";
    return null;
  };

  // Current group streak: walk newest → oldest from today. Skip today if it
  // isn't perfect (in-progress), skip rest days, stop at the first past
  // required column that isn't perfect. The set of columns that participate
  // in this run is what we use to decide where medals are still alive — once
  // the streak breaks every column from the prior run drops its medal.
  const groupCurrentStreakKeys = new Set<string>();
  let groupCurrentStreak = 0;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col.isPrePact) break;
    const isToday = col.key === todayKey;
    if (!isRequired(col.key)) continue;
    if (perfectColumns.has(col.key)) {
      groupCurrentStreak += 1;
      groupCurrentStreakKeys.add(col.key);
    } else if (isToday) {
      // today is in progress — neither extends nor breaks the streak
      continue;
    } else {
      break;
    }
  }
  const groupBestMedal = bestMedalFor(groupCurrentStreak);

  // Per-member streak — separate from the group streak above. Walks oldest →
  // newest, counts consecutive done columns for that member, and records the
  // streak length at each milestone column. Rest days and pre-join columns
  // don't break the streak (you can't fail a day you weren't expected on),
  // pre-pact resets cleanly.
  const memberStreakByCol = new Map<string, Map<string, number>>();
  for (const m of members) {
    const memberMap = new Map<string, number>();
    const oldestFirst = [...columns].reverse();
    let streak = 0;
    const memberJoinedMs = new Date(m.joined_at).getTime();
    for (const col of oldestFirst) {
      if (col.isPrePact) {
        streak = 0;
        continue;
      }
      const colEndMs =
        new Date(`${col.key}T00:00:00Z`).getTime() + stepMs;
      if (colEndMs <= memberJoinedMs) continue; // not joined yet
      if (!isRequired(col.key)) continue; // rest day
      const count =
        m.user_id === currentUserId
          ? myCountOptimistic(col.key)
          : serverCountFor(col.key, m.user_id);
      if (count >= cellTarget) {
        streak += 1;
        memberMap.set(col.key, streak);
      } else {
        streak = 0;
      }
    }
    memberStreakByCol.set(m.user_id, memberMap);
  }

  // Same idea as the group: per-member current streak set, walking from today
  // backward. A member's medal lives only as long as the unbroken run that
  // contains it.
  const memberCurrentStreakKeys = new Map<string, Set<string>>();
  const memberCurrentStreak = new Map<string, number>();
  for (const m of members) {
    const set = new Set<string>();
    let streak = 0;
    const memberJoinedMs = new Date(m.joined_at).getTime();
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col.isPrePact) break;
      const colEndMs =
        new Date(`${col.key}T00:00:00Z`).getTime() + stepMs;
      if (colEndMs <= memberJoinedMs) break; // hit join boundary
      if (!isRequired(col.key)) continue;
      const isToday = col.key === todayKey;
      const count =
        m.user_id === currentUserId
          ? myCountOptimistic(col.key)
          : serverCountFor(col.key, m.user_id);
      if (count >= cellTarget) {
        streak += 1;
        set.add(col.key);
      } else if (isToday) {
        continue;
      } else {
        break;
      }
    }
    memberCurrentStreakKeys.set(m.user_id, set);
    memberCurrentStreak.set(m.user_id, streak);
  }
  const myCurrentStreak = currentUserId
    ? (memberCurrentStreak.get(currentUserId) ?? 0)
    : 0;
  const myBestMedal = bestMedalFor(myCurrentStreak);
  const periodWord =
    colFrequency === "weekly" && !isWeeklyFlex
      ? myCurrentStreak === 1
        ? "week"
        : "weeks"
      : myCurrentStreak === 1
        ? "day"
        : "days";
  const groupPeriodWord =
    colFrequency === "weekly" && !isWeeklyFlex
      ? groupCurrentStreak === 1
        ? "week"
        : "weeks"
      : groupCurrentStreak === 1
        ? "day"
        : "days";

  const cellCount = (memberId: string, key: string): number =>
    memberId === currentUserId
      ? myCountOptimistic(key)
      : serverCountFor(key, memberId);

  const computeCell = (
    member: Member,
    col: { key: string; isPrePact: boolean },
  ): CellState => {
    if (col.isPrePact) return "prePact";
    const colEndMs = new Date(`${col.key}T00:00:00Z`).getTime() + stepMs;
    const memberJoinedMs = new Date(member.joined_at).getTime();
    if (colEndMs <= memberJoinedMs) return "preJoin";
    if (!isRequired(col.key)) return "rest";

    const count = cellCount(member.user_id, col.key);
    if (count >= cellTarget) return "done";
    if (count > 0) return "partial";
    return "pending";
  };

  const onCellTap = (colKey: string) => {
    if (isPending) return;
    startTransition(async () => {
      toggleOptimistic(colKey);
      const result = isWeeklyFlex
        ? await toggleDayCompletion(pactId, colKey)
        : await togglePeriodCompletion(pactId, colKey);
      if (!result.ok) {
        console.error("toggle failed:", result.error);
        return;
      }
      if (result.done && colKey !== todayKey) {
        setNotePrompt({
          pactName,
          completionId: result.completionId,
          metricKind: challenge.metric_kind,
          metricName: challenge.metric_name,
          dateLabel: formatCellDate(colKey),
        });
      }
    });
  };

  // Scroll to the LEFT edge (today) on mount, and re-snap after a backdate.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, []);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [completions.length]);

  // Find the boundary: index of the FIRST pre-pact column. The line goes on
  // that column's left edge (separating active pact days from padding).
  const firstPrePactIndex = columns.findIndex((c) => c.isPrePact);

  const NAME_COL_W = 84;
  const CELL_W = 38;

  return (
    <>
      {(groupBestMedal || myBestMedal) && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {groupBestMedal && (
            <MedalChip
              medal={groupBestMedal}
              streak={groupCurrentStreak}
              periodWord={groupPeriodWord}
              kind="group"
            />
          )}
          {myBestMedal && (
            <MedalChip
              medal={myBestMedal}
              streak={myCurrentStreak}
              periodWord={periodWord}
              kind="personal"
            />
          )}
        </div>
      )}
    <div
      ref={scrollerRef}
      className="overflow-x-auto no-scrollbar"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        touchAction: "pan-x",
        overscrollBehaviorX: "contain",
      }}
    >
      <div style={{ minWidth: NAME_COL_W + columns.length * CELL_W }}>
        {/* Header row */}
        <div
          className="flex items-end"
          style={{
            height: 44,
            borderBottom: "1px solid var(--line)",
            background: "var(--card)",
          }}
        >
          <div
            style={{
              width: NAME_COL_W,
              flexShrink: 0,
              position: "sticky",
              left: 0,
              background: "var(--card)",
              borderRight: "1px solid var(--line)",
              height: "100%",
              zIndex: 1,
            }}
          />
          {columns.map((col, idx) => {
            const isToday = col.key === todayKey;
            const isPerfect = perfectColumns.has(col.key);
            const showStartLine = idx === firstPrePactIndex;
            const streak = streakLengthByKey.get(col.key) ?? 0;
            // Only show the medal if this column is still part of the live
            // streak — once the streak resets, the marker disappears.
            const medal =
              isPerfect && groupCurrentStreakKeys.has(col.key)
                ? medalFor(streak)
                : null;
            const colRequired = isRequired(col.key);
            // A "missed" column is a required, non-perfect column in the past
            // (today is exempt — you haven't missed it yet). For weekly-flex,
            // a day in a partial week is also "missed" if the week is over.
            const isPastMissed =
              !col.isPrePact &&
              !isToday &&
              colRequired &&
              !isPerfect &&
              col.key < todayKey;
            const labels =
              colFrequency === "daily" ? dailyColLabels(col.key) : null;
            const weeklyLabels =
              colFrequency === "weekly" ? weeklyColLabels(col.key) : null;
            const headerBg = col.isPrePact
              ? "transparent"
              : isPerfect
                ? perfectFill(streak, 0.18, 0.4)
                : isToday
                  ? "var(--card)"
                  : isPastMissed
                    ? "rgba(216, 98, 58, 0.12)"
                    : "transparent";
            const headerColor = col.isPrePact
              ? "var(--mute)"
              : isPerfect
                ? "var(--perfect)"
                : isPastMissed
                  ? "var(--accent)"
                  : "var(--mute)";
            return (
              <div
                key={col.key}
                style={{
                  width: CELL_W,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingBottom: 6,
                  fontFamily: "var(--font-stat-mono)",
                  background: headerBg,
                  color: headerColor,
                  opacity: col.isPrePact ? 0.5 : 1,
                  borderLeft: showStartLine
                    ? "1px solid rgba(216, 98, 58, 0.5)"
                    : "none",
                  position: "relative",
                }}
              >
                {medal && (
                  <span
                    aria-hidden
                    title={`${streak}-${
                      colFrequency === "weekly" ? "week" : "day"
                    } group streak`}
                    style={{
                      position: "absolute",
                      top: 1,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 16,
                      lineHeight: 1,
                      filter:
                        "drop-shadow(0 1px 1px rgba(42,31,24,0.25)) " +
                        (medal === "bronze"
                          ? "hue-rotate(-10deg) saturate(1.1)"
                          : medal === "silver"
                            ? "grayscale(0.4) brightness(1.05)"
                            : "saturate(1.3)"),
                    }}
                  >
                    {medal === "gold" ? "🥇" : medal === "silver" ? "🥈" : "🥉"}
                  </span>
                )}
                {labels && (
                  <>
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        opacity: 0.7,
                      }}
                    >
                      {labels.dow}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {labels.dayNum}
                    </span>
                  </>
                )}
                {weeklyLabels && (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      {weeklyLabels.line1}
                    </span>
                    <span style={{ fontSize: 9, opacity: 0.7 }}>
                      {weeklyLabels.line2}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Member rows */}
        {members.map((m, i) => {
          const isYou = m.user_id === currentUserId;
          return (
            <div
              key={m.user_id}
              className="flex items-center"
              style={{
                height: 44,
                borderBottom:
                  i < members.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <button
                type="button"
                onClick={() => setMemberModal(m)}
                aria-label={`See ${m.display_name}'s metric breakdown`}
                className="press"
                style={{
                  width: NAME_COL_W,
                  flexShrink: 0,
                  position: "sticky",
                  left: 0,
                  background: "var(--card)",
                  borderRight: "1px solid var(--line)",
                  border: "none",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 8px",
                  zIndex: 1,
                  cursor: challenge.metric_kind ? "pointer" : "default",
                  textAlign: "left",
                }}
                disabled={!challenge.metric_kind}
              >
                <Avatar
                  name={m.display_name}
                  colorIndex={m.avatar_color_index}
                  size={24}
                />
                <span
                  className="truncate"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ink)",
                    minWidth: 0,
                  }}
                >
                  {m.display_name}
                  {isYou && (
                    <span style={{ color: "var(--mute)" }}> · you</span>
                  )}
                </span>
              </button>
              {columns.map((col, idx) => {
                const state = computeCell(m, col);
                const isToday = col.key === todayKey;
                const isPerfect = perfectColumns.has(col.key);
                const streak = streakLengthByKey.get(col.key) ?? 0;
                const colRequired = isRequired(col.key);
                const isPastMissed =
                  !col.isPrePact &&
                  !isToday &&
                  colRequired &&
                  !isPerfect &&
                  col.key < todayKey;
                // I can tap any of my cells; the server action toggles in
                // single-target mode and appends in multi-target mode.
                const canTap =
                  isYou && state !== "prePact" && state !== "preJoin" && state !== "rest";
                const cellCountValue = cellCount(m.user_id, col.key);
                const showStartLine = idx === firstPrePactIndex;
                const memberStreak =
                  memberStreakByCol.get(m.user_id)?.get(col.key) ?? 0;
                const memberLiveSet = memberCurrentStreakKeys.get(m.user_id);
                const memberMedal =
                  memberLiveSet?.has(col.key) ? medalFor(memberStreak) : null;
                return (
                  <div
                    key={col.key}
                    style={{
                      width: CELL_W,
                      flexShrink: 0,
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: col.isPrePact
                        ? "transparent"
                        : isPerfect
                          ? perfectFill(streak, 0.06, 0.18)
                          : isPastMissed
                            ? "rgba(216, 98, 58, 0.05)"
                            : "transparent",
                      borderLeft: showStartLine
                        ? "1px solid rgba(216, 98, 58, 0.5)"
                        : "none",
                      position: "relative",
                    }}
                  >
                    {memberMedal && (
                      <span
                        aria-hidden
                        title={`${memberStreak}-${
                          isWeeklyFlex
                            ? "day"
                            : colFrequency === "weekly"
                              ? "week"
                              : "day"
                        } personal streak`}
                        style={{
                          position: "absolute",
                          top: 1,
                          right: 2,
                          fontSize: 13,
                          lineHeight: 1,
                          pointerEvents: "none",
                          filter:
                            "drop-shadow(0 1px 1px rgba(42,31,24,0.25)) " +
                            (memberMedal === "bronze"
                              ? "hue-rotate(-10deg) saturate(1.1)"
                              : memberMedal === "silver"
                                ? "grayscale(0.4) brightness(1.05)"
                                : "saturate(1.3)"),
                        }}
                      >
                        {memberMedal === "gold"
                          ? "🥇"
                          : memberMedal === "silver"
                            ? "🥈"
                            : "🥉"}
                      </span>
                    )}
                    {canTap ? (
                      <button
                        type="button"
                        onClick={() => onCellTap(col.key)}
                        disabled={isPending}
                        aria-label={
                          state === "done"
                            ? `Un-log ${m.display_name} for ${col.key}`
                            : `Log ${m.display_name} for ${col.key}`
                        }
                        aria-pressed={state === "done"}
                        className="press"
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CellGlyph
                          state={state}
                          perfect={isPerfect}
                          count={cellCountValue}
                          target={target}
                        />
                      </button>
                    ) : (
                      <CellGlyph state={state} perfect={isPerfect} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {memberModal && challenge.metric_kind && (
        <MemberMetricModal
          member={memberModal}
          completions={completions.filter(
            (c) => c.user_id === memberModal.user_id,
          )}
          metricKind={challenge.metric_kind}
          metricName={challenge.metric_name}
          onClose={() => setMemberModal(null)}
        />
      )}
      {notePrompt && (
        <NoteSheet
          prompt={notePrompt}
          onClose={() => setNotePrompt(null)}
        />
      )}
    </div>
    </>
  );
}

function MedalChip({
  medal,
  streak,
  periodWord,
  kind,
}: {
  medal: "bronze" | "silver" | "gold";
  streak: number;
  periodWord: string;
  kind: "group" | "personal";
}) {
  const glyph = medal === "gold" ? "🥇" : medal === "silver" ? "🥈" : "🥉";
  const tint =
    medal === "gold"
      ? "rgba(242, 169, 59, 0.18)"
      : medal === "silver"
        ? "rgba(170, 170, 180, 0.18)"
        : "rgba(196, 132, 80, 0.18)";
  const border =
    medal === "gold"
      ? "rgba(242, 169, 59, 0.45)"
      : medal === "silver"
        ? "rgba(170, 170, 180, 0.55)"
        : "rgba(196, 132, 80, 0.5)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 8px",
        borderRadius: 999,
        background: tint,
        border: `1px solid ${border}`,
        fontFamily: "var(--font-stat-mono)",
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--ink)",
        fontWeight: 600,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
        {glyph}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {streak} {periodWord} {kind === "group" ? "group" : "you"}
      </span>
    </span>
  );
}

function CellGlyph({
  state,
  perfect,
  count = 0,
  target = 1,
}: {
  state: CellState;
  perfect: boolean;
  count?: number;
  target?: number;
}) {
  if (state === "done") {
    return (
      <div
        aria-label={perfect ? "perfect day check-in" : "checked in"}
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: perfect ? "var(--perfect)" : "var(--accent)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: perfect ? "0 0 0 2px var(--perfect-soft)" : "none",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </div>
    );
  }
  if (state === "partial") {
    const safeTarget = Math.max(1, target);
    const progress = Math.min(count, safeTarget) / safeTarget;
    const SIZE = 26;
    const STROKE = 3.5;
    const R = (SIZE - STROKE) / 2;
    const C = 2 * Math.PI * R;
    return (
      <div
        aria-label={`${count} of ${safeTarget} done`}
        style={{
          width: SIZE,
          height: SIZE,
          position: "relative",
        }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1.5"
            strokeDasharray="2 3"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={STROKE}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
      </div>
    );
  }
  if (state === "pending") {
    return (
      <div
        aria-label="not checked in"
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: "1.5px dashed var(--line-strong)",
          background: "transparent",
        }}
      />
    );
  }
  if (state === "prePact") {
    return (
      <div
        aria-label="before pact started"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "1px solid var(--line)",
          background: "transparent",
        }}
      />
    );
  }
  if (state === "rest") {
    return (
      <div
        aria-label="rest day"
        style={{
          width: 14,
          height: 1.5,
          background: "var(--line-strong)",
          borderRadius: 1,
          opacity: 0.6,
        }}
      />
    );
  }
  return null; // preJoin → blank cell
}

function MemberMetricModal({
  member,
  completions,
  metricKind,
  metricName,
  onClose,
}: {
  member: Member;
  completions: Completion[];
  metricKind: 'count' | 'minutes';
  metricName: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const now = new Date();
  const periods: { label: string; start: Date | null }[] = [
    { label: 'today', start: startOfDayUTC(now) },
    { label: 'this week', start: startOfWeekUTC(now) },
    { label: 'this month', start: startOfMonthUTC(now) },
    { label: 'this year', start: startOfYearUTC(now) },
    { label: 'all time', start: null },
  ];

  const totalIn = (start: Date | null): number =>
    completions
      .filter((c) => !start || new Date(c.completed_at) >= start)
      .reduce((acc, c) => acc + (c.metric_value ?? 0), 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${member.display_name}'s metrics`}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(42, 31, 24, 0.32)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: '12px 22px calc(env(safe-area-inset-bottom, 0px) + 24px)',
          boxShadow: '0 -8px 30px rgba(42, 31, 24, 0.18)',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            aria-hidden
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              background: 'var(--line-strong)',
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'transparent',
              color: 'var(--mute)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              lineHeight: 1,
              border: 'none',
            }}
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Avatar
            name={member.display_name}
            colorIndex={member.avatar_color_index}
            size={48}
          />
          <div>
            <div className="label">metrics</div>
            <h2
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                lineHeight: 1.05,
                color: 'var(--ink)',
              }}
            >
              {member.display_name}
            </h2>
          </div>
        </div>

        <ul
          className="overflow-hidden"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
          }}
        >
          {periods.map((p, i, arr) => {
            const total = totalIn(p.start);
            const f = formatMetric(total, metricKind, metricName);
            return (
              <li
                key={p.label}
                className="flex items-baseline justify-between p-3"
                style={{
                  borderBottom:
                    i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                <span className="label">{p.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-stat-mono)',
                    fontSize: 14,
                    color: total > 0 ? 'var(--ink)' : 'var(--mute)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {f.number}
                  {f.unit ? ` ${f.unit}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function startOfDayUTC(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}
function startOfWeekUTC(d: Date): Date {
  const r = startOfDayUTC(d);
  const offset = (r.getUTCDay() + 6) % 7;
  r.setUTCDate(r.getUTCDate() - offset);
  return r;
}
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function startOfYearUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function formatMetric(
  total: number,
  kind: 'count' | 'minutes',
  name: string | null,
): { number: string; unit: string } {
  if (kind === 'minutes') {
    if (total < 60) return { number: String(total), unit: 'min' };
    const totalH = Math.floor(total / 60);
    const remM = total % 60;
    if (totalH < 24) {
      return { number: `${totalH}h${remM > 0 ? ` ${remM}m` : ''}`, unit: '' };
    }
    const d = Math.floor(totalH / 24);
    const remH = totalH % 24;
    return { number: `${d}d${remH > 0 ? ` ${remH}h` : ''}`, unit: '' };
  }
  return { number: total.toLocaleString(), unit: name ?? 'units' };
}

