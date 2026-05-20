export type Frequency = "daily" | "weekly";

// All period bounds in UTC. Stored timestamps are UTC; consistent comparisons
// matter more than any single client's local-day boundary for v1.

export function startOfPeriodUTC(frequency: Frequency, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  if (frequency === "weekly") {
    const day = d.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    d.setUTCDate(d.getUTCDate() + diff);
  }
  return d;
}

// Per-day state for the week-summary row. Day index 0 = Mon ... 6 = Sun.
// - "done" = every member who was in the pact by end of that day completed it
// - "pending" = a required day not yet (or not fully) completed
// - "rest" = the pact doesn't require this day (e.g. weekends on a weekdays pact)
export type WeekDay = "done" | "pending" | "rest";

export function buildWeekDots(
  completions: { completed_at: string; user_id: string }[],
  members: { user_id: string; joined_at: string }[],
  daysOfWeek: number[] | null,
  now: Date = new Date(),
): WeekDay[] {
  const required = (i: number) =>
    daysOfWeek === null || daysOfWeek.length === 0 || daysOfWeek.includes(i);

  if (members.length === 0) {
    return Array(7)
      .fill(0)
      .map((_, i) => (required(i) ? "pending" : "rest")) as WeekDay[];
  }

  const weekStart = startOfPeriodUTC("weekly", now);
  const dayMs = 24 * 60 * 60 * 1000;

  const usersByDay: Set<string>[] = Array.from({ length: 7 }, () => new Set());
  for (const c of completions) {
    const t = new Date(c.completed_at).getTime();
    const idx = Math.floor((t - weekStart.getTime()) / dayMs);
    if (idx >= 0 && idx < 7) usersByDay[idx].add(c.user_id);
  }

  const memberJoinTimes = members.map((m) => ({
    user_id: m.user_id,
    joinedAt: new Date(m.joined_at).getTime(),
  }));

  return usersByDay.map((doneSet, idx) => {
    if (!required(idx)) return "rest";
    const dayEnd = weekStart.getTime() + (idx + 1) * dayMs;
    const expected = memberJoinTimes.filter((m) => m.joinedAt < dayEnd);
    if (expected.length === 0) return "pending";
    return expected.every((m) => doneSet.has(m.user_id)) ? "done" : "pending";
  });
}

// The user's current consecutive completion streak for one challenge.
// Daily: consecutive required days. Weekly: consecutive weeks.
// When daysOfWeek is set, non-required days (e.g. weekends on a weekdays
// pact) are skipped — they don't count toward the streak and don't break
// it. A period the user hasn't completed yet doesn't break the streak —
// they might still complete today/this week.
export function currentStreak(
  completedAts: string[],
  frequency: Frequency,
  daysOfWeek: number[] | null = null,
  now: Date = new Date(),
): number {
  const stepMs = (frequency === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000;
  const keyOf = (d: Date) =>
    startOfPeriodUTC(frequency, d).toISOString().slice(0, 10);
  const completedKeys = new Set(completedAts.map((t) => keyOf(new Date(t))));

  // dayIdx: 0=Mon ... 6=Sun. UTC getDay returns 0=Sun ... 6=Sat.
  const dayIdxOf = (d: Date) => (d.getUTCDay() + 6) % 7;
  const dayRequired = (d: Date) =>
    frequency !== "daily" ||
    daysOfWeek === null ||
    daysOfWeek.length === 0 ||
    daysOfWeek.includes(dayIdxOf(d));

  // Walk back from the current period. Skip rest days; require completion
  // on required days.
  let cursor = startOfPeriodUTC(frequency, now);

  // If today is required but not completed, don't break the streak yet —
  // back up to the previous step and resume. (Tomorrow problem either way.)
  if (dayRequired(cursor) && !completedKeys.has(keyOf(cursor))) {
    cursor = new Date(cursor.getTime() - stepMs);
  }

  const MAX = frequency === "daily" ? 365 : 52;
  let streak = 0;
  let steps = 0;
  while (steps < MAX * 2) {
    if (!dayRequired(cursor)) {
      cursor = new Date(cursor.getTime() - stepMs);
      steps++;
      continue;
    }
    if (!completedKeys.has(keyOf(cursor))) break;
    streak++;
    cursor = new Date(cursor.getTime() - stepMs);
    steps++;
    if (streak >= MAX) break;
  }
  return streak;
}

// Consecutive periods where *every* expected member completed at least once.
// Same skip-rest-days / don't-break-on-current-period semantics as
// currentStreak, but evaluated for the whole group rather than one user.
export function currentGroupStreak(
  completions: { completed_at: string; user_id: string }[],
  members: { user_id: string; joined_at: string }[],
  frequency: Frequency,
  daysOfWeek: number[] | null = null,
  now: Date = new Date(),
): number {
  if (members.length === 0) return 0;
  const stepMs = (frequency === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000;

  const dayIdxOf = (d: Date) => (d.getUTCDay() + 6) % 7;
  const dayRequired = (d: Date) =>
    frequency !== "daily" ||
    daysOfWeek === null ||
    daysOfWeek.length === 0 ||
    daysOfWeek.includes(dayIdxOf(d));

  // Bucket completions by period-start ISO string for O(1) lookups.
  const usersByPeriod = new Map<string, Set<string>>();
  for (const c of completions) {
    const key = startOfPeriodUTC(frequency, new Date(c.completed_at))
      .toISOString();
    const s = usersByPeriod.get(key) ?? new Set<string>();
    s.add(c.user_id);
    usersByPeriod.set(key, s);
  }

  const memberJoinTimes = members.map((m) => ({
    user_id: m.user_id,
    joinedAt: new Date(m.joined_at).getTime(),
  }));

  const isPerfect = (periodStartDate: Date) => {
    const periodEndMs = periodStartDate.getTime() + stepMs;
    const expected = memberJoinTimes.filter((m) => m.joinedAt < periodEndMs);
    if (expected.length === 0) return false;
    const done = usersByPeriod.get(periodStartDate.toISOString()) ?? new Set();
    return expected.every((m) => done.has(m.user_id));
  };

  let cursor = startOfPeriodUTC(frequency, now);

  // Current period not perfect yet? Don't break the streak — back up.
  if (dayRequired(cursor) && !isPerfect(cursor)) {
    cursor = new Date(cursor.getTime() - stepMs);
  }

  const MAX = frequency === "daily" ? 365 : 52;
  let streak = 0;
  let steps = 0;
  while (steps < MAX * 2) {
    if (!dayRequired(cursor)) {
      cursor = new Date(cursor.getTime() - stepMs);
      steps++;
      continue;
    }
    if (!isPerfect(cursor)) break;
    streak++;
    cursor = new Date(cursor.getTime() - stepMs);
    steps++;
    if (streak >= MAX) break;
  }
  return streak;
}

// Date in dd/mm/yy. Accepts an ISO string or a date-only string (YYYY-MM-DD).
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < 60_000) return "just now";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
