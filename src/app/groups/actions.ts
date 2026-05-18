"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createGroup(formData: FormData) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login?next=/groups");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/groups?error=Group+name+is+required");
  }

  const { data, error } = await supabase
    .from("groups")
    .insert({ name })
    .select("id")
    .single();

  if (error) {
    redirect(`/groups?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}

export async function updateGroup(formData: FormData) {
  const supabase = await createClient();

  const groupId = String(formData.get("group_id") ?? "").trim();
  if (!groupId) {
    redirect("/groups?error=Missing+group");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect(`/groups/${groupId}?error=Group+name+is+required`);
  }

  const { data, error } = await supabase
    .from("groups")
    .update({ name })
    .eq("id", groupId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }
  if (!data) {
    redirect(`/groups/${groupId}?error=Only+the+creator+can+edit+this+group`);
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  redirect(`/groups/${groupId}`);
}

export async function deleteGroup(formData: FormData) {
  const supabase = await createClient();

  const groupId = String(formData.get("group_id") ?? "").trim();
  if (!groupId) {
    redirect("/groups?error=Missing+group");
  }

  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }
  if (!data) {
    redirect(`/groups/${groupId}?error=Only+the+creator+can+delete+this+group`);
  }

  revalidatePath("/groups");
  redirect("/groups");
}

export async function joinGroupByCode(formData: FormData) {
  const supabase = await createClient();

  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    redirect("/groups?error=Invite+code+is+required");
  }

  const { data: groupId, error } = await supabase.rpc("join_group_with_invite_code", { code });

  if (error || !groupId) {
    redirect(`/groups?error=${encodeURIComponent(error?.message ?? "Invalid invite code")}`);
  }

  revalidatePath("/groups");
  redirect(`/groups/${groupId}`);
}
