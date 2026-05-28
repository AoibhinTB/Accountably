"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_NAME_LEN = 60;

type UpdateInput = {
  display_name?: string;
  // 0-7 palette index, null clears the override.
  avatar_color_index?: number | null;
};

// Persists the current user's display_name and / or avatar_color_index.
// Fields omitted from the input are left untouched. RLS scopes the row to
// the caller.
export async function updateProfile(
  input: UpdateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const patch: Record<string, string | number | null> = {};
  if (typeof input.display_name === "string") {
    const trimmed = input.display_name.trim();
    if (!trimmed) return { ok: false, error: "Name cannot be empty" };
    patch.display_name = trimmed.slice(0, MAX_NAME_LEN);
  }
  if (input.avatar_color_index !== undefined) {
    const v = input.avatar_color_index;
    if (v !== null && !(Number.isInteger(v) && v >= 0 && v <= 7)) {
      return { ok: false, error: "Invalid color" };
    }
    patch.avatar_color_index = v;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

// Hard-deletes the current user from Supabase Auth via the service role,
// which cascades to all their data through the foreign keys defined in the
// initial schema (profiles, group_members, completions, notes, reactions,
// nudges, push subscriptions). After deletion we cannot stay on the page
// because the session is gone, so we redirect to /login.
//
// Signature accepts FormData so it can be bound to ConfirmForm as a form
// action without a wrapper.
export async function deleteAccount(_formData?: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    redirect(`/you?error=${encodeURIComponent(error.message)}`);
  }

  // Sign the local browser session out so the redirect lands cleanly on
  // the login page.
  await supabase.auth.signOut();
  redirect("/login?goodbye=1");
}
