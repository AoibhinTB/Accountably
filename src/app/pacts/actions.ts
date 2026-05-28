"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyCompletion, notifyNudge } from "@/lib/push/notify";
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

// Parses a metric_value form field. Returns undefined when the field is
// missing/empty (so we know to skip updating the column), null when the
// user explicitly cleared a previously-set value, and a non-negative
// integer otherwise.
const parseMetricValue = (
  raw: FormDataEntryValue | null,
): number | null | undefined => {
  if (raw === null) return undefined;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "") return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

const parseMetric = (
  kindRaw: FormDataEntryValue | null,
  nameRaw: FormDataEntryValue | null,
): { metric_kind: "count" | "minutes" | null; metric_name: string | null } => {
  const kind = typeof kindRaw === "string" ? kindRaw.trim() : "";
  if (kind !== "count" && kind !== "minutes") {
    return { metric_kind: null, metric_name: null };
  }
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (kind === "count") {
    const safeName = name.slice(0, 30) || "units";
    return { metric_kind: "count", metric_name: safeName };
  }
  return { metric_kind: "minutes", metric_name: "minutes" };
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
  const metric = parseMetric(
    formData.get("metric_kind"),
    formData.get("metric_name"),
  );

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

  // Metric fields are not in the create_pact RPC signature, so we set them
  // with a follow-up update on the just-created active challenge for this
  // group. Skipped when the pact opts out of metrics.
  if (metric.metric_kind) {
    await supabase
      .from("challenges")
      .update({
        metric_kind: metric.metric_kind,
        metric_name: metric.metric_name,
      })
      .eq("group_id", data)
      .eq("archived", false);
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
  const metric = parseMetric(
    formData.get("metric_kind"),
    formData.get("metric_name"),
  );

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
      metric_kind: metric.metric_kind,
      metric_name: metric.metric_name,
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
  const metricValue = parseMetricValue(formData.get("metric_value"));

  const update: Record<string, string | number | null> = { note };
  if (metricValue !== undefined) update.metric_value = metricValue;

  const { data, error } = await supabase
    .from("completions")
    .update(update)
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
// weekly), delete the most recent one; otherwise insert a fresh completion
// and return its id so the UI can offer to attach a note.
export async function toggleQuickLog(
  pactId: string,
): Promise<
  | { ok: true; done: true; completionId: string }
  | { ok: true; done: false }
  | { ok: false; error: string }
> {
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

  const { data: inserted, error: insErr } = await supabase
    .from("completions")
    .insert({ challenge_id: challenge.id })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { ok: false, error: insErr?.message ?? "Insert failed" };
  }

  revalidatePath("/feed");
  revalidatePath(`/pacts/${pactId}`);
  after(() => notifyCompletion({ actorUserId: user.id, pactId }));
  return { ok: true, done: true, completionId: inserted.id };
}

// Send a nudge to a member. Each tap inserts a new row (the table no longer
// has a per-period unique constraint), so the most-recent created_at acts
// as "last nudged". A 5-minute cooldown per (sender → recipient → challenge)
// keeps things from turning into spam.
const NUDGE_COOLDOWN_MS = 5 * 60 * 1000;

export async function sendNudge(
  pactId: string,
  toUserId: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; cooldown?: boolean }
> {
  if (!pactId || !toUserId) return { ok: false, error: "Missing args" };

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
  if (!challenge) return { ok: false, error: "No active challenge" };
  if (challenge.frequency !== "daily" && challenge.frequency !== "weekly") {
    return { ok: false, error: "Unsupported frequency" };
  }

  const periodStartKey = startOfPeriodUTC(challenge.frequency)
    .toISOString()
    .slice(0, 10);

  const cooldownCutoff = new Date(Date.now() - NUDGE_COOLDOWN_MS).toISOString();
  const { data: recent } = await supabase
    .from("nudges")
    .select("id")
    .eq("from_user_id", user.id)
    .eq("to_user_id", toUserId)
    .eq("challenge_id", challenge.id)
    .gte("created_at", cooldownCutoff)
    .limit(1)
    .maybeSingle();

  if (recent) {
    return {
      ok: false,
      error: "wait a few minutes before nudging again",
      cooldown: true,
    };
  }

  const { error } = await supabase.from("nudges").insert({
    to_user_id: toUserId,
    challenge_id: challenge.id,
    period_start: periodStartKey,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pacts/${pactId}`);
  revalidatePath("/feed");
  after(() =>
    notifyNudge({
      fromUserId: user.id,
      toUserId,
      pactId,
      challengeId: challenge.id,
      periodStartKey,
    }),
  );
  return { ok: true };
}

// Toggle a check-in for any day (today or past). If the user has any
// completion in that day's period (today for daily, the date's week for
// weekly), delete them all (un-tick). Otherwise insert a new completion
// dated at noon UTC of that day. Used by the grid view — tap toggles
// regardless of current state.
export async function togglePeriodCompletion(
  pactId: string,
  dateISO: string,
): Promise<{ ok: true; done: boolean } | { ok: false; error: string }> {
  if (!pactId || !dateISO) return { ok: false, error: "Missing args" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return { ok: false, error: "Invalid date" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: challenge, error: chErr } = await supabase
    .from("challenges")
    .select("id, group_id, frequency, start_date")
    .eq("group_id", pactId)
    .eq("archived", false)
    .maybeSingle();

  if (chErr) return { ok: false, error: chErr.message };
  if (!challenge) return { ok: false, error: "No active challenge" };
  if (challenge.frequency !== "daily" && challenge.frequency !== "weekly") {
    return { ok: false, error: "Unsupported frequency" };
  }

  const target = new Date(`${dateISO}T12:00:00Z`);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  const startDay = new Date(`${challenge.start_date}T00:00:00Z`);

  if (target > today) return { ok: false, error: "Can't log a future day" };
  if (target < startDay) return { ok: false, error: "Before the pact started" };

  const periodStart = startOfPeriodUTC(challenge.frequency, target);
  const stepMs =
    (challenge.frequency === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000;
  const periodEnd = new Date(periodStart.getTime() + stepMs);

  // Delete-if-exists: all of my completions in that period.
  const { data: deleted } = await supabase
    .from("completions")
    .delete()
    .eq("challenge_id", challenge.id)
    .eq("user_id", user.id)
    .gte("completed_at", periodStart.toISOString())
    .lt("completed_at", periodEnd.toISOString())
    .select("id");

  if (deleted && deleted.length > 0) {
    revalidatePath(`/pacts/${pactId}`);
    revalidatePath("/feed");
    return { ok: true, done: false };
  }

  const { error } = await supabase
    .from("completions")
    .insert({
      challenge_id: challenge.id,
      completed_at: target.toISOString(),
    });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pacts/${pactId}`);
  revalidatePath("/feed");
  after(() => notifyCompletion({ actorUserId: user.id, pactId }));
  return { ok: true, done: true };
}

// Insert-only backdate (kept for any callers that explicitly want add-only).
// Grid uses togglePeriodCompletion instead so taps can also un-tick.
export async function backdateCompletion(
  pactId: string,
  dateISO: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await togglePeriodCompletion(pactId, dateISO);
  if (!result.ok) return result;
  return { ok: true };
}

// Edit window for notes: 24 hours after completed_at. The server enforces
// this so direct API calls cannot bypass the limit; the client also hides
// the edit affordance after the window so users do not see a button that
// returns an error.
const NOTE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Client-callable variant of saveCompletionNote — no redirect, used by the
// Feed today-band's post-log note sheet and the per-pact notes history.
// Passing metricValue as undefined leaves the column untouched; passing
// null clears it; passing a number sets it.
export async function saveNoteInline(
  completionId: string,
  note: string | null,
  metricValue?: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!completionId) return { ok: false, error: "Missing completion" };

  const supabase = await createClient();

  // Verify the completion exists and is still within the edit window. RLS
  // already scopes by ownership (only the author can update), so a missing
  // row here means either not-found or not-authorized.
  const { data: existing } = await supabase
    .from("completions")
    .select("completed_at")
    .eq("id", completionId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Not authorized" };
  const ageMs = Date.now() - new Date(existing.completed_at).getTime();
  if (ageMs > NOTE_EDIT_WINDOW_MS) {
    return {
      ok: false,
      error: "notes can only be edited within 24 hours of check-in",
    };
  }

  const update: Record<string, string | number | null> = {
    note: note ?? null,
  };
  if (metricValue !== undefined) update.metric_value = metricValue;

  const { data, error } = await supabase
    .from("completions")
    .update(update)
    .eq("id", completionId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Not authorized" };

  revalidatePath(`/pacts`);
  revalidatePath("/feed");
  return { ok: true };
}
