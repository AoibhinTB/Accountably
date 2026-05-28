"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Reactions accept any emoji the picker hands us. We do a coarse sanity
// check on the value: trimmed length 1-16 chars (covers compound emojis
// like flags and family glyphs) and only characters in the unicode
// emoji / symbol ranges. The hard-coded curated list still exists in
// constants.ts as a starting point for the in-app pickers.
const EMOJI_RANGE = /[\p{Extended_Pictographic}\p{Emoji_Component}‍️]/u;

const looksLikeEmoji = (raw: string): boolean => {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 16) return false;
  return EMOJI_RANGE.test(trimmed);
};

async function performToggle(
  completionId: string,
  emoji: string,
): Promise<void> {
  if (!completionId || !emoji) return;
  if (!looksLikeEmoji(emoji)) return;

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
