import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, sendPushToUsers } from "@/lib/push/send";

// All reads here use the admin client because notifyNudge / notifyCompletion
// are invoked from `after()` after the response has shipped. In that context
// the cookie-bound auth client is unreliable (the user session may already
// be released), so RLS-gated reads of OTHER users' rows can come back empty.
// The admin client bypasses RLS and gives us the same data deterministically.

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
  const supabase = createAdminClient();
  const [{ data: sender }, { data: group }, { data: recipient }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", args.fromUserId)
      .maybeSingle(),
    supabase.from("groups").select("name").eq("id", args.pactId).maybeSingle(),
    supabase
      .from("profiles")
      .select("notif_nudges")
      .eq("id", args.toUserId)
      .maybeSingle(),
  ]);

  // Recipient has nudge pushes turned off — drop the send silently.
  if (recipient && recipient.notif_nudges === false) return;

  const senderName = sender?.display_name?.trim() || "Someone";
  const pactName = group?.name?.trim();

  await sendPushToUser(args.toUserId, {
    title: pactName || "Accountably",
    body: `${senderName} nudged you`,
    url: `/pacts/${args.pactId}`,
    tag: `nudge:${args.challengeId}:${args.periodStartKey}:${args.fromUserId}`,
  });
}

// Sends "X checked in" to every pact member except the actor.
export async function notifyCompletion(args: {
  actorUserId: string;
  pactId: string;
}): Promise<void> {
  const supabase = createAdminClient();
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

  const candidateIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((id) => id && id !== args.actorUserId);
  if (candidateIds.length === 0) return;

  // Filter to recipients who want check-in pushes. notif_checkins defaults
  // to true at the column level, so absent / true / null all mean opt-in.
  const { data: prefs } = await supabase
    .from("profiles")
    .select("id, notif_checkins")
    .in("id", candidateIds);
  const recipientIds = (prefs ?? [])
    .filter((p) => p.notif_checkins !== false)
    .map((p) => p.id);
  if (recipientIds.length === 0) return;

  const actorName = actor?.display_name?.trim() || "Someone";
  const pactName = group?.name?.trim();

  await sendPushToUsers(recipientIds, {
    title: pactName || "Accountably",
    body: `${actorName} checked in`,
    url: `/pacts/${args.pactId}`,
  });
}
