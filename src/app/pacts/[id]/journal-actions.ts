"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_LEN = 5000;

// Adds a private journal entry for the current user in this pact. The
// BEFORE INSERT trigger fills user_id from auth.uid(); RLS scopes reads to
// the author only.
export async function addJournalEntry(
  pactId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pactId) return { ok: false, error: "Missing pact" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Entry cannot be empty" };
  if (trimmed.length > MAX_LEN) {
    return { ok: false, error: "Entry is too long" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("journal_entries").insert({
    pact_id: pactId,
    body: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pacts/${pactId}/logbook`);
  return { ok: true };
}

// Hard-delete a journal entry. RLS only lets the author delete.
export async function deleteJournalEntry(
  entryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!entryId) return { ok: false, error: "Missing entry" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pacts`);
  return { ok: true };
}
