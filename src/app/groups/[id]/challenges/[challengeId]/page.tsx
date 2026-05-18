import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/confirm-form";
import {
  CompletionFeed,
  type CompletionItemData,
} from "@/components/completion-item";
import { SubmitButton } from "@/components/submit-button";
import { deleteChallenge, updateChallenge } from "../actions";
import { logCompletion } from "./completions/actions";

type Challenge = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly";
  start_date: string;
  end_date: string | null;
  archived: boolean;
  created_at: string;
  created_by: string;
  profiles: { display_name: string } | null;
  groups: { name: string } | null;
};

type CompletionRow = {
  id: string;
  completed_at: string;
  note: string | null;
  user_id: string;
  profiles: { display_name: string } | null;
};

export default async function ChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; challengeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: groupId, challengeId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select(
      "id, group_id, title, description, frequency, start_date, end_date, archived, created_at, created_by, profiles(display_name), groups(name)",
    )
    .eq("id", challengeId)
    .maybeSingle<Challenge>();

  if (!challenge || challenge.group_id !== groupId) notFound();

  const { data: userData } = await supabase.auth.getUser();
  const isCreator = userData.user?.id === challenge.created_by;

  const { data: completions } = await supabase
    .from("completions")
    .select("id, completed_at, note, user_id, profiles(display_name)")
    .eq("challenge_id", challenge.id)
    .order("completed_at", { ascending: false })
    .returns<CompletionRow[]>();

  const completionItems: CompletionItemData[] = (completions ?? []).map((row) => ({
    id: row.id,
    userName: row.profiles?.display_name ?? "Unknown",
    completedAt: row.completed_at,
    note: row.note,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-24">
      <Link
        href={`/groups/${groupId}`}
        className="inline-flex min-h-10 items-center text-sm text-zinc-600"
      >
        ← {challenge.groups?.name ?? "Back to group"}
      </Link>

      <header className="mt-3 mb-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {challenge.frequency}
          </span>
          {challenge.archived && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              archived
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold">{challenge.title}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Created by {challenge.profiles?.display_name ?? "Unknown"} ·{" "}
          {new Date(challenge.created_at).toLocaleDateString()}
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {challenge.description && (
        <p className="mb-4 whitespace-pre-wrap text-sm text-zinc-700">
          {challenge.description}
        </p>
      )}

      <section className="mb-6">
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-md bg-black px-4 py-3 text-base font-medium text-white [&::-webkit-details-marker]:hidden">
            <span>Log completion</span>
            <span aria-hidden className="text-zinc-300 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <form
            action={logCompletion}
            className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="challenge_id" value={challenge.id} />
            <label className="block">
              <span className="text-xs font-medium text-zinc-700">Note (optional)</span>
              <textarea
                name="note"
                rows={3}
                maxLength={500}
                placeholder="How did it go?"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base"
              />
            </label>
            <SubmitButton
              pendingLabel="Logging…"
              className="min-h-11 w-full rounded-md bg-black px-4 py-3 text-base font-medium text-white"
            >
              Log it
            </SubmitButton>
          </form>
        </details>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Completions{completionItems.length ? ` (${completionItems.length})` : ""}
        </h2>
        <CompletionFeed
          items={completionItems}
          emptyMessage="No completions yet. Be the first to log one."
        />
      </section>

      <section className="mb-4">
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
            <span>Schedule</span>
            <span className="text-zinc-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-zinc-500">Frequency</dt>
              <dd className="mt-0.5 capitalize">{challenge.frequency}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Starts</dt>
              <dd className="mt-0.5">
                {new Date(challenge.start_date).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Ends</dt>
              <dd className="mt-0.5">
                {challenge.end_date
                  ? new Date(challenge.end_date).toLocaleDateString()
                  : "Runs indefinitely"}
              </dd>
            </div>
          </dl>
        </details>
      </section>

      {isCreator && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
            <span>Edit challenge</span>
            <span className="text-zinc-400 transition-transform group-open:rotate-180">▾</span>
          </summary>

          <section className="mt-3 rounded-lg border border-zinc-200 bg-white p-4">
            <form action={updateChallenge} className="mb-6 space-y-3">
              <input type="hidden" name="group_id" value={groupId} />
              <input type="hidden" name="challenge_id" value={challenge.id} />

              <label className="block">
                <span className="text-xs font-medium text-zinc-700">Title</span>
                <input
                  name="title"
                  type="text"
                  required
                  maxLength={120}
                  defaultValue={challenge.title}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-zinc-700">Description (optional)</span>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={500}
                  defaultValue={challenge.description ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base"
                />
              </label>

              <fieldset>
                <legend className="text-xs font-medium text-zinc-700">Frequency</legend>
                <div className="mt-2 flex gap-4 text-base">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="frequency"
                      value="daily"
                      defaultChecked={challenge.frequency === "daily"}
                    />
                    Daily
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="frequency"
                      value="weekly"
                      defaultChecked={challenge.frequency === "weekly"}
                    />
                    Weekly
                  </label>
                </div>
              </fieldset>

              <label className="block">
                <span className="text-xs font-medium text-zinc-700">Start date</span>
                <input
                  name="start_date"
                  type="date"
                  required
                  defaultValue={challenge.start_date}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-700">End date (optional)</span>
                <input
                  name="end_date"
                  type="date"
                  defaultValue={challenge.end_date ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base"
                />
              </label>

              <SubmitButton
                pendingLabel="Saving…"
                className="min-h-11 rounded-md bg-black px-4 py-3 text-base font-medium text-white"
              >
                Save changes
              </SubmitButton>
            </form>

            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="mb-3 text-xs text-red-800">
                Deleting this challenge will also remove all of its completions
                and reactions. This cannot be undone.
              </p>
              <ConfirmForm
                action={deleteChallenge}
                message={`Delete "${challenge.title}"? All completions and reactions for this challenge will be permanently deleted. This cannot be undone.`}
              >
                <input type="hidden" name="group_id" value={groupId} />
                <input type="hidden" name="challenge_id" value={challenge.id} />
                <SubmitButton
                  pendingLabel="Deleting…"
                  className="min-h-11 rounded-md border border-red-300 bg-white px-4 py-3 text-base font-medium text-red-700"
                >
                  Delete challenge
                </SubmitButton>
              </ConfirmForm>
            </div>
          </section>
        </details>
      )}
    </main>
  );
}
