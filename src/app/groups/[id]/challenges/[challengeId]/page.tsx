import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/confirm-form";
import {
  CompletionFeed,
  type CompletionItemData,
} from "@/components/completion-item";
import {
  summarizeReactions,
  type ReactionRow,
} from "@/components/reactions/constants";
import { SubmitButton } from "@/components/submit-button";
import { Squiggle } from "@/components/ui/squiggle";
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
  reactions: ReactionRow[] | null;
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
    .select(
      "id, completed_at, note, user_id, profiles(display_name), reactions(emoji, user_id)",
    )
    .eq("challenge_id", challenge.id)
    .order("completed_at", { ascending: false })
    .returns<CompletionRow[]>();

  const completionItems: CompletionItemData[] = (completions ?? []).map(
    (row) => ({
      id: row.id,
      userName: row.profiles?.display_name ?? "Unknown",
      completedAt: row.completed_at,
      note: row.note,
      reactions: summarizeReactions(row.reactions, userData.user?.id ?? null),
    }),
  );

  return (
    <main className="mx-auto w-full max-w-2xl pt-6 pb-28">
      <div className="flex items-center justify-between px-5">
        <Link
          href={`/groups/${groupId}`}
          className="press inline-flex min-h-10 items-center text-sm"
          style={{ color: "var(--ink-soft)" }}
        >
          ← {challenge.groups?.name ?? "back"}
        </Link>
      </div>

      <header className="px-6 pt-5">
        <div className="flex items-center gap-2">
          <span className="pill">{challenge.frequency}</span>
          {challenge.archived && (
            <span
              className="pill"
              style={{
                background: "var(--accent2-soft)",
                color: "#7A4E0F",
                borderColor: "transparent",
              }}
            >
              archived
            </span>
          )}
        </div>
        <h1
          className="h-display m-0 mt-2"
          style={{ fontSize: 44, lineHeight: 1.05 }}
        >
          {challenge.title}
        </h1>
        <Squiggle width={110} />
        <p
          className="mt-3"
          style={{ color: "var(--mute)", fontSize: 14 }}
        >
          by {challenge.profiles?.display_name ?? "unknown"} ·{" "}
          {new Date(challenge.created_at).toLocaleDateString()}
        </p>
      </header>

      {error && (
        <div
          className="mx-5 mt-4 px-4 py-3 text-sm"
          style={{
            borderRadius: "var(--radius)",
            border: "1px solid rgba(156, 31, 31, 0.3)",
            background: "rgba(216, 98, 58, 0.1)",
            color: "#7A1F1F",
          }}
        >
          {error}
        </div>
      )}

      {challenge.description && (
        <p
          className="note mx-6 mt-4"
          style={{
            paddingLeft: 12,
            borderLeft: "2px solid var(--accent)",
            fontSize: 17,
          }}
        >
          &ldquo;{challenge.description}&rdquo;
        </p>
      )}

      <section className="px-5 pt-6">
        <details className="group">
          <summary
            className="press flex min-h-16 cursor-pointer list-none items-center justify-center gap-3 [&::-webkit-details-marker]:hidden"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius-lg)",
              padding: "0 24px",
              fontFamily: "var(--font-display)",
              fontSize: 24,
              boxShadow: "0 8px 30px rgba(216, 98, 58, 0.35)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
            <span>mark today done</span>
            <span
              aria-hidden
              className="transition-transform group-open:rotate-180"
              style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-body)" }}
            >
              ▾
            </span>
          </summary>
          <form
            action={logCompletion}
            className="mt-3 flex flex-col gap-3 p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="challenge_id" value={challenge.id} />
            <label className="block">
              <span className="label">Note (optional)</span>
              <textarea
                name="note"
                rows={3}
                maxLength={500}
                placeholder="how did it go?"
                className="mt-1.5 w-full resize-none outline-none"
                style={{
                  ...inputStyle,
                  height: "auto",
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontSize: 17,
                }}
              />
            </label>
            <SubmitButton
              pendingLabel="logging…"
              className="w-full"
              style={primaryStyle}
            >
              log it
            </SubmitButton>
          </form>
        </details>
      </section>

      <section className="px-5 pt-6">
        <div className="label mb-2">
          completions{completionItems.length ? ` (${completionItems.length})` : ""}
        </div>
        <CompletionFeed
          items={completionItems}
          revalidatePath={`/groups/${groupId}/challenges/${challengeId}`}
          emptyMessage="no completions yet. be the first."
        />
      </section>

      <section className="px-5 pt-5">
        <details className="group">
          <summary
            className="press inline-flex min-h-12 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "0 18px",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            <span>schedule</span>
            <span
              aria-hidden
              className="transition-transform group-open:rotate-180"
              style={{ color: "var(--mute)" }}
            >
              ▾
            </span>
          </summary>
          <dl
            className="mt-3 grid grid-cols-2 gap-3 p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              fontSize: 14,
            }}
          >
            <div>
              <dt className="label">Frequency</dt>
              <dd
                className="mt-1 capitalize"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  lineHeight: 1.1,
                }}
              >
                {challenge.frequency}
              </dd>
            </div>
            <div>
              <dt className="label">Starts</dt>
              <dd
                className="mt-1"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  lineHeight: 1.1,
                }}
              >
                {new Date(challenge.start_date).toLocaleDateString()}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="label">Ends</dt>
              <dd
                className="mt-1"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  lineHeight: 1.1,
                  fontStyle: challenge.end_date ? "normal" : "italic",
                  color: challenge.end_date ? "var(--ink)" : "var(--mute)",
                }}
              >
                {challenge.end_date
                  ? new Date(challenge.end_date).toLocaleDateString()
                  : "runs indefinitely"}
              </dd>
            </div>
          </dl>
        </details>
      </section>

      {isCreator && (
        <section className="px-5 pt-5">
          <details className="group">
            <summary
              className="press inline-flex min-h-12 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "0 18px",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                color: "var(--ink)",
              }}
            >
              <span>edit challenge</span>
              <span
                aria-hidden
                className="transition-transform group-open:rotate-180"
                style={{ color: "var(--mute)" }}
              >
                ▾
              </span>
            </summary>
            <div
              className="mt-3 p-4"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
              }}
            >
              <form action={updateChallenge} className="mb-5 flex flex-col gap-3">
                <input type="hidden" name="group_id" value={groupId} />
                <input type="hidden" name="challenge_id" value={challenge.id} />
                <label className="block">
                  <span className="label">Title</span>
                  <input
                    name="title"
                    type="text"
                    required
                    maxLength={120}
                    defaultValue={challenge.title}
                    className="mt-1.5 w-full outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="label">Description (optional)</span>
                  <textarea
                    name="description"
                    rows={2}
                    maxLength={500}
                    defaultValue={challenge.description ?? ""}
                    className="mt-1.5 w-full resize-none outline-none"
                    style={{
                      ...inputStyle,
                      height: "auto",
                      paddingTop: 12,
                      paddingBottom: 12,
                      fontFamily: "var(--font-display)",
                      fontStyle: "italic",
                    }}
                  />
                </label>
                <fieldset>
                  <legend className="label">Frequency</legend>
                  <div className="mt-2 flex gap-3">
                    {(["daily", "weekly"] as const).map((freq) => (
                      <label
                        key={freq}
                        className="press inline-flex flex-1 items-center justify-center gap-2 cursor-pointer"
                        style={{
                          minHeight: 44,
                          borderRadius: "var(--radius)",
                          border: "1.5px solid var(--line)",
                          background: "var(--card-inset)",
                          padding: "0 14px",
                          fontFamily: "var(--font-body)",
                          fontSize: 15,
                          color: "var(--ink)",
                          textTransform: "capitalize",
                        }}
                      >
                        <input
                          type="radio"
                          name="frequency"
                          value={freq}
                          defaultChecked={challenge.frequency === freq}
                          className="accent-[color:var(--accent)]"
                        />
                        {freq}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">Start date</span>
                    <input
                      name="start_date"
                      type="date"
                      required
                      defaultValue={challenge.start_date}
                      className="mt-1.5 w-full outline-none"
                      style={inputStyle}
                    />
                  </label>
                  <label className="block">
                    <span className="label">End date (optional)</span>
                    <input
                      name="end_date"
                      type="date"
                      defaultValue={challenge.end_date ?? ""}
                      className="mt-1.5 w-full outline-none"
                      style={inputStyle}
                    />
                  </label>
                </div>
                <SubmitButton
                  pendingLabel="saving…"
                  style={primaryStyle}
                >
                  save changes
                </SubmitButton>
              </form>

              <div
                className="p-3"
                style={{
                  borderRadius: "var(--radius)",
                  border: "1px solid rgba(156, 31, 31, 0.25)",
                  background: "rgba(216, 98, 58, 0.06)",
                }}
              >
                <p
                  className="mb-3 text-xs"
                  style={{ color: "#7A1F1F", lineHeight: 1.4 }}
                >
                  deleting this challenge also removes all of its completions
                  and reactions. this can&apos;t be undone.
                </p>
                <ConfirmForm
                  action={deleteChallenge}
                  message={`Delete "${challenge.title}"? All completions and reactions for this challenge will be permanently deleted. This cannot be undone.`}
                >
                  <input type="hidden" name="group_id" value={groupId} />
                  <input type="hidden" name="challenge_id" value={challenge.id} />
                  <SubmitButton
                    pendingLabel="deleting…"
                    style={dangerStyle}
                  >
                    delete challenge
                  </SubmitButton>
                </ConfirmForm>
              </div>
            </div>
          </details>
        </section>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  height: 52,
  background: "var(--card-inset)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 16px",
  fontSize: 16,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
};

const primaryStyle: React.CSSProperties = {
  minHeight: 52,
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "var(--radius)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 16,
  padding: "0 22px",
};

const dangerStyle: React.CSSProperties = {
  minHeight: 44,
  background: "var(--card)",
  color: "#9C1F1F",
  borderRadius: "var(--radius)",
  border: "1.5px solid rgba(156, 31, 31, 0.4)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  padding: "0 18px",
};
