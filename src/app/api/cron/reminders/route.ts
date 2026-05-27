import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

// Hourly cron. Looks for users who:
//   1. have a reminder_time set
//   2. are past that time in their own timezone today
//   3. haven't already been reminded today (last_reminder_sent_date != today)
//   4. still have a daily pact pending today
// For each match, fires one consolidated push and marks last_reminder_sent_date
// to today (in the user's tz) so we do not re-send.
//
// Auth: Vercel's cron runner sends Authorization: Bearer ${CRON_SECRET}.

export const dynamic = "force-dynamic";

type Candidate = {
  id: string;
  reminder_time: string;
  reminder_timezone: string | null;
  last_reminder_sent_date: string | null;
};

type ChallengeRow = {
  id: string;
  frequency: "daily" | "weekly";
  archived: boolean;
  days_of_week: number[] | null;
};

type MemberRow = {
  groups: {
    id: string;
    name: string;
    challenges: ChallengeRow[];
  } | null;
};

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
  };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: candidatesRaw, error: candErr } = await supabase
    .from("profiles")
    .select("id, reminder_time, reminder_timezone, last_reminder_sent_date")
    .not("reminder_time", "is", null);

  if (candErr) {
    return NextResponse.json({ ok: false, error: candErr.message }, { status: 500 });
  }
  const candidates = (candidatesRaw ?? []) as Candidate[];

  const todayDayIdx = (now.getUTCDay() + 6) % 7;
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;

  for (const c of candidates) {
    const tz = c.reminder_timezone || "UTC";
    const local = localParts(now, tz);

    const [rhStr, rmStr] = c.reminder_time.split(":");
    const remH = parseInt(rhStr, 10);
    const remM = parseInt(rmStr, 10);
    const reachedTime =
      local.hour > remH || (local.hour === remH && local.minute >= remM);
    if (!reachedTime) {
      skipped++;
      continue;
    }
    if (c.last_reminder_sent_date === local.date) {
      skipped++;
      continue;
    }

    // Look up the user's pacts and their active daily challenges.
    const { data: memberRows } = await supabase
      .from("group_members")
      .select(
        "groups(id, name, challenges(id, frequency, archived, days_of_week))",
      )
      .eq("user_id", c.id)
      .returns<MemberRow[]>();

    const pending: { challengeId: string; pactName: string }[] = [];
    for (const mr of memberRows ?? []) {
      const g = mr.groups;
      if (!g) continue;
      for (const ch of g.challenges ?? []) {
        if (ch.archived) continue;
        if (ch.frequency !== "daily") continue;
        const dow = ch.days_of_week;
        if (dow && dow.length > 0 && !dow.includes(todayDayIdx)) continue;
        pending.push({ challengeId: ch.id, pactName: g.name });
      }
    }

    if (pending.length === 0) {
      skipped++;
      continue;
    }

    // Filter out ones already completed today (UTC day).
    const challengeIds = pending.map((p) => p.challengeId);
    const { data: completions } = await supabase
      .from("completions")
      .select("challenge_id")
      .eq("user_id", c.id)
      .in("challenge_id", challengeIds)
      .gte("completed_at", dayStart.toISOString());
    const done = new Set((completions ?? []).map((row) => row.challenge_id));
    const stillPending = pending.filter((p) => !done.has(p.challengeId));

    if (stillPending.length === 0) {
      skipped++;
      continue;
    }

    const count = stillPending.length;
    const title = count === 1 ? stillPending[0].pactName : "Accountably";
    const body =
      count === 1
        ? "you have not checked in yet today"
        : `${count} pacts still need you today`;

    await sendPushToUser(c.id, { title, body, url: "/feed" });

    await supabase
      .from("profiles")
      .update({ last_reminder_sent_date: local.date })
      .eq("id", c.id);

    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped, candidates: candidates.length });
}
