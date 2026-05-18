"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logCompletion(formData: FormData) {
  const supabase = await createClient();

  const groupId = String(formData.get("group_id") ?? "").trim();
  const challengeId = String(formData.get("challenge_id") ?? "").trim();
  if (!groupId || !challengeId) {
    redirect("/groups?error=Missing+challenge");
  }

  const detailUrl = `/groups/${groupId}/challenges/${challengeId}`;

  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw : null;

  const { error } = await supabase
    .from("completions")
    .insert({ challenge_id: challengeId, note });

  if (error) {
    redirect(`${detailUrl}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(detailUrl);
  redirect(detailUrl);
}
