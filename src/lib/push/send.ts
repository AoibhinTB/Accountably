import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Lazy one-time VAPID setup. web-push throws if setVapidDetails is called
// without a subject, so we only configure on the first send and treat
// missing env vars as a no-op (push disabled in this environment).
let vapidConfigured: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    vapidConfigured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  // Notifications with the same tag collapse — useful for "X nudged you"
  // where re-sending shouldn't pile up.
  tag?: string;
};

// Sends a push to every device subscribed by `userId`. Fire-and-forget:
// callers should NOT await this in a way that blocks the user response.
// Dead subscriptions (404/410) are deleted from the table.
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapid()) return;
  if (!userId) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const deadIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(s.id);
        }
        // Other errors (network, 5xx) are transient; leave the subscription
        // in place and let the next send retry.
      }
    }),
  );

  if (deadIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", deadIds);
  }
}

// Convenience for fanning out to many recipients in parallel.
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}
