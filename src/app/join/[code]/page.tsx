import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: groupId, error } = await supabase.rpc("join_group_with_invite_code", { code });

  if (error || !groupId) {
    redirect(`/groups?error=${encodeURIComponent(error?.message ?? "Invalid invite code")}`);
  }

  redirect(`/groups/${groupId}`);
}
