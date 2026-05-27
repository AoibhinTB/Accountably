import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

// Per-pact reminder cron. Iterates rows of group_members where reminder_time
// is set, looks at each row's pact and active daily challenge, and fires
// a per-pact push if:
//   1. it is past the user's reminder_time in their stored timezone today,
//   2. we have not already sent for this membership today (in user-local tz),
//   3. the pact's active challenge requires today (frequency + days_of_week),
//   4. the user has not completed it today.
//
// Push title = pact name so the user knows which pact the reminder is for.
// Auth: Vercel cron / cron-job.org sends Authorization: Bearer ${CRON_SECRET}.

export const dynamic = "force-dynamic";

type Candidate = {
  user_id: string;
  group_id: string;
  reminder_time: string;
  reminder_timezone: string | null;
  last_reminder_sent_date: string | null;
  groups: {
    id: string;
    name: string;
    challenges: {
      id: string;
      frequency: "daily" | "weekly";
      archived: boolean;
      days_of_week: number[] | null;
    }[];
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
    .from("group_members")
    .select(
      "user_id, group_id, reminder_time, reminder_timezone, last_reminder_sent_date, groups(id, name, challenges(id, frequency, archived, days_of_week))",
    )
    .not("reminder_time", "is", null)
    .returns<Candidate[]>();

  if (candErr) {
    return NextResponse.json({ ok: false, error: candErr.message }, { status: 500 });
  }
  const candidates = candidatesRaw ?? [];

  const todayDayIdx = (now.getUTCDay() + 6) % 7;
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;

  for (const c of candidates) {
    if (!c.groups) {
      skipped++;
      continue;
    }
    const challenge = (c.groups.challenges ?? []).find(
      (ch) => !ch.archived && ch.frequency === "daily",
    );
    if (!challenge) {
      skipped++;
      continue;
    }
    const dow = challenge.days_of_week;
    if (dow && dow.length > 0 && !dow.includes(todayDayIdx)) {
      skipped++;
      continue;
    }

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

    // Has the user already checked this pact in today?
    const { data: done } = await supabase
      .from("completions")
      .select("id")
      .eq("user_id", c.user_id)
      .eq("challenge_id", challenge.id)
      .gte("completed_at", dayStart.toISOString())
      .limit(1);
    if (done && done.length > 0) {
      skipped++;
      continue;
    }

    await sendPushToUser(c.user_id, {
      title: c.groups.name,
      body: "you have not checked in today",
      url: `/pacts/${c.group_id}`,
    });

    await supabase
      .from("group_members")
      .update({ last_reminder_sent_date: local.date })
      .eq("user_id", c.user_id)
      .eq("group_id", c.group_id);

    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped, candidates: candidates.length });
}
