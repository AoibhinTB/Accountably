"use client";

import { useEffect, useLayoutEffect, useOptimistic, useRef, useTransition } from "react";
import { backdateCompletion } from "../actions";
import { Avatar } from "@/components/ui/avatar";

type Frequency = "daily" | "weekly";

type Member = {
  user_id: string;
  joined_at: string;
  display_name: string;
};

type Completion = {
  user_id: string;
  completed_at: string;
};

type CellState = "done" | "pending" | "rest" | "blank";

const DAY_MS = 86_400_000;

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

// Generate columns from the pact's start period up to today's period.
function generateColumns(
  startDate: Date,
  now: Date,
  frequency: Frequency,
): string[] {
  const stepMs = (frequency === "daily" ? 1 : 7) * DAY_MS;
  const firstStart = startOfPeriod(startDate, frequency);
  const lastStart = startOfPeriod(now, frequency);
  const cols: string[] = [];
  let cursor = new Date(firstStart);
  // Safety cap so a stale start_date can't lock the page up.
  const MAX = frequency === "daily" ? 365 * 3 : 52 * 5;
  let n = 0;
  while (cursor.getTime() <= lastStart.getTime() && n < MAX) {
    cols.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + stepMs);
    n++;
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
  currentUserId,
  challenge,
  members,
  completions,
}: {
  pactId: string;
  currentUserId: string | null;
  challenge: {
    frequency: Frequency;
    days_of_week: number[] | null;
    start_date: string;
  };
  members: Member[];
  completions: Completion[];
}) {
  const now = new Date();
  const startDate = new Date(`${challenge.start_date}T00:00:00Z`);
  const columns = generateColumns(startDate, now, challenge.frequency);
  const todayKey = periodKeyOf(now, challenge.frequency);
  const stepMs = (challenge.frequency === "daily" ? 1 : 7) * DAY_MS;

  // Bucket completions by (period_key, user_id).
  const doneByPeriodUser = new Map<string, Set<string>>();
  for (const c of completions) {
    const key = periodKeyOf(new Date(c.completed_at), challenge.frequency);
    const set = doneByPeriodUser.get(key) ?? new Set<string>();
    set.add(c.user_id);
    doneByPeriodUser.set(key, set);
  }

  const dayIdxOfKey = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    return (d.getUTCDay() + 6) % 7;
  };
  const isRequired = (key: string) =>
    challenge.frequency !== "daily" ||
    challenge.days_of_week === null ||
    challenge.days_of_week.length === 0 ||
    challenge.days_of_week.includes(dayIdxOfKey(key));

  // Optimistic state for the current user's backdated taps.
  const [optimisticMyDates, addOptimisticMyDate] = useOptimistic<
    Set<string>,
    string
  >(new Set(), (state, key) => new Set([...state, key]));
  const [isPending, startTransition] = useTransition();

  const memberJoinTimes = members.map((m) => ({
    user_id: m.user_id,
    joinedAt: new Date(m.joined_at).getTime(),
  }));

  // A column is "perfect" if every member who was in the pact by the end of
  // that period has checked in for it. Includes my optimistic dates.
  const perfectColumns = new Set<string>();
  for (const key of columns) {
    if (!isRequired(key)) continue;
    const colEndMs = new Date(`${key}T00:00:00Z`).getTime() + stepMs;
    const expected = memberJoinTimes.filter((m) => m.joinedAt < colEndMs);
    if (expected.length === 0) continue;
    const doneSet = new Set(doneByPeriodUser.get(key) ?? []);
    if (currentUserId && optimisticMyDates.has(key)) doneSet.add(currentUserId);
    if (expected.every((m) => doneSet.has(m.user_id))) {
      perfectColumns.add(key);
    }
  }

  const computeCell = (member: Member, colKey: string): CellState => {
    const colEndMs = new Date(`${colKey}T00:00:00Z`).getTime() + stepMs;
    const memberJoinedMs = new Date(member.joined_at).getTime();
    if (colEndMs <= memberJoinedMs) return "blank";
    if (!isRequired(colKey)) return "rest";
    const set = doneByPeriodUser.get(colKey);
    if (set?.has(member.user_id)) return "done";
    if (
      member.user_id === currentUserId &&
      optimisticMyDates.has(colKey)
    ) {
      return "done";
    }
    return "pending";
  };

  const onCellTap = (colKey: string) => {
    if (isPending) return;
    startTransition(async () => {
      addOptimisticMyDate(colKey);
      const result = await backdateCompletion(pactId, colKey);
      if (!result.ok) {
        console.error("backdateCompletion failed:", result.error);
      }
    });
  };

  // Scroll to the right edge (today) on mount.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // After data refreshes (e.g. after backdate), re-snap to the right.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [completions.length]);

  const NAME_COL_W = 84;
  const CELL_W = 38;

  return (
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
          {columns.map((key) => {
            const isToday = key === todayKey;
            const isPerfect = perfectColumns.has(key);
            const labels =
              challenge.frequency === "daily" ? dailyColLabels(key) : null;
            const weeklyLabels =
              challenge.frequency === "weekly" ? weeklyColLabels(key) : null;
            return (
              <div
                key={key}
                style={{
                  width: CELL_W,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingBottom: 6,
                  fontFamily: "var(--font-stat-mono)",
                  background: isPerfect
                    ? "var(--perfect-soft)"
                    : isToday
                      ? "var(--accent-soft)"
                      : "transparent",
                  color: isPerfect
                    ? "var(--perfect)"
                    : isToday
                      ? "var(--accent)"
                      : "var(--mute)",
                }}
              >
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
              <div
                style={{
                  width: NAME_COL_W,
                  flexShrink: 0,
                  position: "sticky",
                  left: 0,
                  background: "var(--card)",
                  borderRight: "1px solid var(--line)",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 8px",
                  zIndex: 1,
                }}
              >
                <Avatar name={m.display_name} size={24} />
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
              </div>
              {columns.map((key) => {
                const state = computeCell(m, key);
                const isToday = key === todayKey;
                const isPerfect = perfectColumns.has(key);
                const canTap = isYou && state === "pending";
                return (
                  <div
                    key={key}
                    style={{
                      width: CELL_W,
                      flexShrink: 0,
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isPerfect
                        ? "rgba(156, 122, 184, 0.08)"
                        : isToday
                          ? "rgba(216, 98, 58, 0.06)"
                          : "transparent",
                    }}
                  >
                    {canTap ? (
                      <button
                        type="button"
                        onClick={() => onCellTap(key)}
                        disabled={isPending}
                        aria-label={`Log ${m.display_name} for ${key}`}
                        className="press"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "transparent",
                          border: "1.5px dashed var(--line-strong)",
                          color: "var(--mute)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          touchAction: "manipulation",
                        }}
                      />
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
    </div>
  );
}

function CellGlyph({
  state,
  perfect,
}: {
  state: CellState;
  perfect: boolean;
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
  return null;
}
