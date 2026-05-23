"use client";

import { useOptimistic, useTransition } from "react";
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

// Period key = YYYY-MM-DD of the period's start (day for daily, Monday for
// weekly). Mirrors the same scheme used elsewhere in the app.
function periodKeyOf(date: Date, frequency: Frequency): string {
  if (frequency === "daily") {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function generateColumns(
  now: Date,
  frequency: Frequency,
  count: number,
): string[] {
  const stepMs = (frequency === "daily" ? 1 : 7) * DAY_MS;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  let cursor = frequency === "daily" ? today : new Date(today);
  if (frequency === "weekly") {
    const day = cursor.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    cursor.setUTCDate(cursor.getUTCDate() + diff);
  }

  const cols: string[] = [];
  for (let i = 0; i < count; i++) {
    cols.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() - stepMs);
  }
  return cols.reverse(); // oldest first → today/this-week last
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
  const columnCount = challenge.frequency === "daily" ? 14 : 8;
  const columns = generateColumns(now, challenge.frequency, columnCount);
  const todayKey = periodKeyOf(now, challenge.frequency);
  const pactStartMs = new Date(`${challenge.start_date}T00:00:00Z`).getTime();
  const stepMs = (challenge.frequency === "daily" ? 1 : 7) * DAY_MS;

  // Bucket completions by (period_key, user_id).
  const doneByPeriodUser = new Map<string, Set<string>>();
  for (const c of completions) {
    const key = periodKeyOf(new Date(c.completed_at), challenge.frequency);
    const set = doneByPeriodUser.get(key) ?? new Set<string>();
    set.add(c.user_id);
    doneByPeriodUser.set(key, set);
  }

  // dayIdx: 0=Mon ... 6=Sun (matches our days_of_week column convention)
  const dayIdxOfKey = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    return (d.getUTCDay() + 6) % 7;
  };
  const isRequired = (key: string) =>
    challenge.frequency !== "daily" ||
    challenge.days_of_week === null ||
    challenge.days_of_week.length === 0 ||
    challenge.days_of_week.includes(dayIdxOfKey(key));

  // ── Optimistic state for my own backdated taps ──────────────────────
  const [optimisticMyDates, addOptimisticMyDate] = useOptimistic<
    Set<string>,
    string
  >(new Set(), (state, key) => new Set([...state, key]));
  const [isPending, startTransition] = useTransition();

  const computeCell = (member: Member, colKey: string): CellState => {
    const colStartMs = new Date(`${colKey}T00:00:00Z`).getTime();
    const colEndMs = colStartMs + stepMs;
    const memberJoinedMs = new Date(member.joined_at).getTime();

    // Pre-pact-start or pre-member-join: blank cell.
    if (colEndMs <= pactStartMs) return "blank";
    if (colEndMs <= memberJoinedMs) return "blank";
    if (!isRequired(colKey)) return "rest";

    const set = doneByPeriodUser.get(colKey);
    if (set?.has(member.user_id)) return "done";

    // Optimistic flag for my own row.
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

  const NAME_COL_W = 84;
  const CELL_W = 38;

  return (
    <div
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
            }}
          />
          {columns.map((key) => {
            const isToday = key === todayKey;
            const labels =
              challenge.frequency === "daily"
                ? dailyColLabels(key)
                : null;
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
                  background: isToday ? "var(--accent-soft)" : "transparent",
                  color: isToday ? "var(--accent)" : "var(--mute)",
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
                const canTap =
                  isYou && (state === "pending" || state === "rest" && false);
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
                      background: isToday
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
                      <CellGlyph state={state} />
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

function CellGlyph({ state }: { state: CellState }) {
  if (state === "done") {
    return (
      <div
        aria-label="checked in"
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
  return null; // blank
}
