import { createClient } from "@/lib/supabase/server";
import { sendPushToUser, sendPushToUsers } from "@/lib/push/send";

// Sends "X nudged you" to the recipient. Looks up the sender's display
// name and the pact name so the push has useful context. `tag` collapses
// re-nudges within the same period into a single notification.
export async function notifyNudge(args: {
  fromUserId: string;
  toUserId: string;
  pactId: string;
  challengeId: string;
  periodStartKey: string;
}): Promise<void> {
  const supabase = await createClient();
  const [{ data: sender }, { data: group }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", args.fromUserId)
      .maybeSingle(),
    supabase.from("groups").select("name").eq("id", args.pactId).maybeSingle(),
  ]);

  const senderName = sender?.display_name?.trim() || "Someone";
  const pactName = group?.name?.trim();

  await sendPushToUser(args.toUserId, {
    title: "Accountably",
    body: pactName
      ? `${pactName}: ${senderName} nudged you`
      : `${senderName} nudged you`,
    url: `/pacts/${args.pactId}`,
    tag: `nudge:${args.challengeId}:${args.periodStartKey}:${args.fromUserId}`,
  });
}

// Sends "X checked in" to every pact member except the actor. RLS lets
// the cookie-bound client read group_members for any pact the user is in,
// so no admin client needed here — sendPushToUser is the one that needs
// admin (to read other users' push_subscriptions).
export async function notifyCompletion(args: {
  actorUserId: string;
  pactId: string;
}): Promise<void> {
  const supabase = await createClient();
  const [{ data: actor }, { data: group }, { data: members }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", args.actorUserId)
      .maybeSingle(),
    supabase.from("groups").select("name").eq("id", args.pactId).maybeSingle(),
    supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", args.pactId),
  ]);

  const recipientIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((id) => id && id !== args.actorUserId);
  if (recipientIds.length === 0) return;

  const actorName = actor?.display_name?.trim() || "Someone";
  const pactName = group?.name?.trim();

  await sendPushToUsers(recipientIds, {
    title: "Accountably",
    body: pactName
      ? `${pactName}: ${actorName} checked in`
      : `${actorName} checked in`,
    url: `/pacts/${args.pactId}`,
  });
}
