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
