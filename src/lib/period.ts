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
