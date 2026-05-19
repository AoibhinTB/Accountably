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

// Day index 0 = Monday, 6 = Sunday. A day's dot fills only when *every
// member who was a member by the end of that day* has at least one
// completion that day. New joiners are exempt for days before they joined
// — they can't retroactively complete what they weren't part of.
export function buildWeekDots(
  completions: { completed_at: string; user_id: string }[],
  members: { user_id: string; joined_at: string }[],
  now: Date = new Date(),
): boolean[] {
  if (members.length === 0) return Array(7).fill(false) as boolean[];
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
    const dayEnd = weekStart.getTime() + (idx + 1) * dayMs;
    const expected = memberJoinTimes.filter((m) => m.joinedAt < dayEnd);
    if (expected.length === 0) return false;
    return expected.every((m) => doneSet.has(m.user_id));
  });
}

// The user's current consecutive completion streak for one challenge.
// Daily: consecutive days. Weekly: consecutive weeks. A period the user
// hasn't completed yet doesn't break the streak — they might still complete
// today/this week. The streak is the length of the run preceding that.
export function currentStreak(
  completedAts: string[],
  frequency: Frequency,
  now: Date = new Date(),
): number {
  const stepMs = (frequency === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000;
  const keyOf = (d: Date) =>
    startOfPeriodUTC(frequency, d).toISOString().slice(0, 10);
  const completedKeys = new Set(
    completedAts.map((t) => keyOf(new Date(t))),
  );

  let cursor = startOfPeriodUTC(frequency, now);
  if (!completedKeys.has(keyOf(cursor))) {
    cursor = new Date(cursor.getTime() - stepMs);
  }

  const MAX = frequency === "daily" ? 365 : 52;
  let streak = 0;
  while (completedKeys.has(keyOf(cursor)) && streak < MAX) {
    streak++;
    cursor = new Date(cursor.getTime() - stepMs);
  }
  return streak;
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
