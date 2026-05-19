"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURATED_EMOJIS } from "./constants";

const isCuratedEmoji = (value: string): boolean =>
  (CURATED_EMOJIS as readonly string[]).includes(value);

async function performToggle(
  completionId: string,
  emoji: string,
): Promise<void> {
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
}

// FormData entry point (kept for back-compat; no longer the primary path).
export async function toggleReaction(formData: FormData) {
  const completionId = String(formData.get("completion_id") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim();
  const path = String(formData.get("revalidate_path") ?? "").trim();

  await performToggle(completionId, emoji);
  if (path) revalidatePath(path);
}

// Client-callable variant — the ReactionBar uses this with useOptimistic.
// No redirect, no FormData round-trip.
export async function toggleReactionFor(
  completionId: string,
  emoji: string,
  path?: string,
): Promise<void> {
  await performToggle(completionId, emoji);
  if (path) revalidatePath(path);
}
