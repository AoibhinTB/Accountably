"use server";

import { createClient } from "@/lib/supabase/server";

type SubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Persists (or refreshes) a Web Push subscription for the current user.
// The BEFORE INSERT trigger fills user_id from auth.uid(); we delete any
// existing row with the same endpoint first so re-subscribing on the same
// browser overwrites stale keys cleanly. (Same user only — RLS scopes the
// delete to own rows.)
export async function saveSubscription(
  sub: SubscriptionPayload,
  userAgent: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, error: "Invalid subscription" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);

  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: userAgent,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSubscription(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!endpoint) return { ok: false, error: "Missing endpoint" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

type NotifPrefs = {
  notif_nudges?: boolean;
  notif_checkins?: boolean;
};

// Updates the current user's notification preferences. Only the fields
// present in `prefs` are written. RLS scopes the update to the caller's own
// row so we don not need an explicit user_id filter, but we add one for
// belt-and-braces.
export async function updateNotificationPrefs(
  prefs: NotifPrefs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const update: Record<string, boolean> = {};
  if (typeof prefs.notif_nudges === "boolean") {
    update.notif_nudges = prefs.notif_nudges;
  }
  if (typeof prefs.notif_checkins === "boolean") {
    update.notif_checkins = prefs.notif_checkins;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Per-pact daily reminder for the current user's membership in `pactId`.
// Passing `time: null` disables the reminder (also clears the sent-today
// marker so re-enabling later starts fresh). RLS on group_members scopes
// the update to the caller's own row.
export async function updatePactReminder(args: {
  pactId: string;
  time: string | null;
  timezone: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!args.pactId) return { ok: false, error: "Missing pact" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const update: Record<string, string | null> = {
    reminder_time: args.time,
    reminder_timezone: args.timezone,
  };
  if (args.time === null) update.last_reminder_sent_date = null;

  const { error } = await supabase
    .from("group_members")
    .update(update)
    .eq("group_id", args.pactId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
