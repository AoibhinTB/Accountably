"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createChallenge(formData: FormData) {
  const supabase = await createClient();

  const groupId = String(formData.get("group_id") ?? "").trim();
  if (!groupId) {
    redirect("/groups?error=Missing+group");
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`/groups/${groupId}?error=Title+is+required`);
  }

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw : null;

  const frequency = String(formData.get("frequency") ?? "");
  if (frequency !== "daily" && frequency !== "weekly") {
    redirect(`/groups/${groupId}?error=Frequency+must+be+daily+or+weekly`);
  }

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const startDate = startDateRaw || new Date().toISOString().slice(0, 10);

  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const endDate = endDateRaw ? endDateRaw : null;

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      group_id: groupId,
      title,
      description,
      frequency,
      start_date: startDate,
      end_date: endDate,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}/challenges/${data.id}`);
}

export async function updateChallenge(formData: FormData) {
  const supabase = await createClient();

  const groupId = String(formData.get("group_id") ?? "").trim();
  const challengeId = String(formData.get("challenge_id") ?? "").trim();
  if (!groupId || !challengeId) {
    redirect("/groups?error=Missing+challenge");
  }

  const detailUrl = `/groups/${groupId}/challenges/${challengeId}`;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`${detailUrl}?error=Title+is+required`);
  }

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw : null;

  const frequency = String(formData.get("frequency") ?? "");
  if (frequency !== "daily" && frequency !== "weekly") {
    redirect(`${detailUrl}?error=Frequency+must+be+daily+or+weekly`);
  }

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  if (!startDateRaw) {
    redirect(`${detailUrl}?error=Start+date+is+required`);
  }

  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const endDate = endDateRaw ? endDateRaw : null;

  const { data, error } = await supabase
    .from("challenges")
    .update({
      title,
      description,
      frequency,
      start_date: startDateRaw,
      end_date: endDate,
    })
    .eq("id", challengeId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`${detailUrl}?error=${encodeURIComponent(error.message)}`);
  }
  if (!data) {
    redirect(`${detailUrl}?error=Only+the+creator+can+edit+this+challenge`);
  }

  revalidatePath(detailUrl);
  revalidatePath(`/groups/${groupId}`);
  redirect(detailUrl);
}

export async function deleteChallenge(formData: FormData) {
  const supabase = await createClient();

  const groupId = String(formData.get("group_id") ?? "").trim();
  const challengeId = String(formData.get("challenge_id") ?? "").trim();
  if (!groupId || !challengeId) {
    redirect("/groups?error=Missing+challenge");
  }

  const detailUrl = `/groups/${groupId}/challenges/${challengeId}`;

  const { data, error } = await supabase
    .from("challenges")
    .delete()
    .eq("id", challengeId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`${detailUrl}?error=${encodeURIComponent(error.message)}`);
  }
  if (!data) {
    redirect(`${detailUrl}?error=Only+the+creator+can+delete+this+challenge`);
  }

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
