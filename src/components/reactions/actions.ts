"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURATED_EMOJIS } from "./constants";

const isCuratedEmoji = (value: string): boolean =>
  (CURATED_EMOJIS as readonly string[]).includes(value);

export async function toggleReaction(formData: FormData) {
  const completionId = String(formData.get("completion_id") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim();
  const path = String(formData.get("revalidate_path") ?? "").trim();

  if (!completionId || !emoji) return;
  if (!isCuratedEmoji(emoji)) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: deleted } = await supabase
    .from("reactions")
    .delete()
    .eq("completion_id", completionId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .select("id")
    .maybeSingle();

  if (!deleted) {
    await supabase.from("reactions").insert({
      completion_id: completionId,
      emoji,
    });
  }

  if (path) revalidatePath(path);
}
