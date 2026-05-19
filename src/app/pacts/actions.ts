"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startOfPeriodUTC, type Frequency } from "@/lib/period";

const isFrequency = (v: string): v is Frequency => v === "daily" || v === "weekly";

const parseDaysOfWeek = (raw: FormDataEntryValue | null): number[] | null => {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  const days = s
    .split(",")
    .map((d) => parseInt(d, 10))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const unique = Array.from(new Set(days)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : null;
};

export async function createPact(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/pacts/new?error=Name+is+required");
  }

  const frequency = String(formData.get("frequency") ?? "daily");
  if (!isFrequency(frequency)) {
    redirect("/pacts/new?error=Invalid+frequency");
  }

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const startDate = startDateRaw || new Date().toISOString().slice(0, 10);

  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const endDate = endDateRaw ? endDateRaw : null;

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw : null;

  const iconRaw = String(formData.get("icon") ?? "").trim();
  const icon = iconRaw && iconRaw.length <= 16 ? iconRaw : null;

  const daysOfWeek = parseDaysOfWeek(formData.get("days_of_week"));

  const { data, error } = await supabase.rpc("create_pact", {
    p_name: name,
    p_frequency: frequency,
    p_start_date: startDate,
    p_end_date: endDate,
    p_description: description,
    p_icon: icon,
    p_days_of_week: daysOfWeek,
  });

  if (error || !data) {
    redirect(
      `/pacts/new?error=${encodeURIComponent(error?.message ?? "Could not create pact")}`,
    );
  }

  revalidatePath("/pacts");
  revalidatePath("/feed");
  redirect(`/pacts/${data}`);
}

export async function updatePact(formData: FormData) {
  const supabase = await createClient();

  const pactId = String(formData.get("pact_id") ?? "").trim();
  if (!pactId) {
    redirect("/pacts?error=Missing+pact");
  }

  const detailUrl = `/pacts/${pactId}`;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect(`${detailUrl}?error=Name+is+required`);
  }

  const frequency = String(formData.get("frequency") ?? "");
  if (!isFrequency(frequency)) {
    redirect(`${detailUrl}?error=Frequency+must+be+daily+or+weekly`);
  }

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  if (!startDateRaw) {
    redirect(`${detailUrl}?error=Start+date+is+required`);
  }

  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const endDate = endDateRaw ? endDateRaw : null;

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw : null;

  const iconRaw = String(formData.get("icon") ?? "").trim();
  const icon = iconRaw && iconRaw.length <= 16 ? iconRaw : null;

  const daysOfWeek = parseDaysOfWeek(formData.get("days_of_week"));

  const { data: groupUpdate, error: groupErr } = await supabase
    .from("groups")
    .update({ name, icon })
    .eq("id", pactId)
    .select("id")
    .maybeSingle();

  if (groupErr) {
    redirect(`${detailUrl}?error=${encodeURIComponent(groupErr.message)}`);
  }
  if (!groupUpdate) {
    redirect(`${detailUrl}?error=Only+members+can+edit+this+pact`);
  }

  const { error: challengeErr } = await supabase
    .from("challenges")
    .update({
      title: name,
      description,
      frequency,
      start_date: startDateRaw,
      end_date: endDate,
      days_of_week: daysOfWeek,
    })
    .eq("group_id", pactId)
    .eq("archived", false);

  if (challengeErr) {
    redirect(`${detailUrl}?error=${encodeURIComponent(challengeErr.message)}`);
  }

  revalidatePath(detailUrl);
  revalidatePath("/pacts");
  revalidatePath("/feed");
  redirect(detailUrl);
}

export async function deletePact(formData: FormData) {
  const supabase = await createClient();

  const pactId = String(formData.get("pact_id") ?? "").trim();
  if (!pactId) {
    redirect("/pacts?error=Missing+pact");
  }

  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", pactId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`/pacts/${pactId}?error=${encodeURIComponent(error.message)}`);
  }
  if (!data) {
    redirect(`/pacts/${pactId}?error=Only+the+creator+can+delete+this+pact`);
  }

  revalidatePath("/pacts");
  revalidatePath("/feed");
  redirect("/pacts");
}

export async function joinPactByCode(formData: FormData) {
  const supabase = await createClient();

  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    redirect("/pacts?error=Invite+code+is+required");
  }

  const { data: groupId, error } = await supabase.rpc(
    "join_group_with_invite_code",
    { code },
  );

  if (error || !groupId) {
    redirect(
      `/pacts?error=${encodeURIComponent(error?.message ?? "Invalid invite code")}`,
    );
  }

  revalidatePath("/pacts");
  revalidatePath("/feed");
  redirect(`/pacts/${groupId}`);
}

export async function saveCompletionNote(formData: FormData) {
  const supabase = await createClient();

  const pactId = String(formData.get("pact_id") ?? "").trim();
  const completionId = String(formData.get("completion_id") ?? "").trim();
  if (!pactId || !completionId) {
    redirect("/pacts?error=Missing+pact");
  }

  const detailUrl = `/pacts/${pactId}`;
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw : null;

  const { data, error } = await supabase
    .from("completions")
    .update({ note })
    .eq("id", completionId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`${detailUrl}?error=${encodeURIComponent(error.message)}`);
  }
  if (!data) {
    redirect(`${detailUrl}?error=Only+your+own+notes+can+be+edited`);
  }

  revalidatePath(detailUrl);
  revalidatePath("/feed");
  redirect(detailUrl);
}

// Form-action shim: same behavior as toggleQuickLog, but returns void so it
// can be used directly with `<form action={...}>` (pact-detail "mark done"
// button binds pactId via .bind(null, pactId)).
export async function toggleQuickLogForm(pactId: string): Promise<void> {
  await toggleQuickLog(pactId);
}

// Tap-to-log AND tap-to-undo from the Feed today-band. If the user already
// has a completion in the current period (today for daily, this week for
// weekly), delete the most recent one; otherwise insert a fresh completion.
export async function toggleQuickLog(
  pactId: string,
): Promise<{ ok: true; done: boolean } | { ok: false; error: string }> {
  if (!pactId) return { ok: false, error: "Missing pact" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: challenge, error: chErr } = await supabase
    .from("challenges")
    .select("id, frequency")
    .eq("group_id", pactId)
    .eq("archived", false)
    .maybeSingle();

  if (chErr) return { ok: false, error: chErr.message };
  if (!challenge) return { ok: false, error: "No active challenge for this pact" };

  if (challenge.frequency !== "daily" && challenge.frequency !== "weekly") {
    return { ok: false, error: "Unsupported frequency" };
  }

  const periodStart = startOfPeriodUTC(challenge.frequency);

  const { data: existing } = await supabase
    .from("completions")
    .select("id")
    .eq("challenge_id", challenge.id)
    .eq("user_id", user.id)
    .gte("completed_at", periodStart.toISOString())
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await supabase
      .from("completions")
      .delete()
      .eq("id", existing.id);
    if (delErr) return { ok: false, error: delErr.message };
    revalidatePath("/feed");
    revalidatePath(`/pacts/${pactId}`);
    return { ok: true, done: false };
  }

  const { error: insErr } = await supabase
    .from("completions")
    .insert({ challenge_id: challenge.id });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/feed");
  revalidatePath(`/pacts/${pactId}`);
  return { ok: true, done: true };
}
