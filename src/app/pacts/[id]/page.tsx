import { headers } from "next/headers";
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
import { Avatar } from "@/components/ui/avatar";
import { Squiggle } from "@/components/ui/squiggle";
import { startOfPeriodUTC } from "@/lib/period";
import {
  deletePact,
  saveCompletionNote,
  toggleQuickLogForm,
  updatePact,
} from "../actions";
import { InviteLink } from "./invite-link";

type Member = {
  user_id: string;
  joined_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly";
  start_date: string;
  end_date: string | null;
  archived: boolean;
  created_at: string;
};

type CompletionRow = {
  id: string;
  completed_at: string;
  note: string | null;
  user_id: string;
  profiles: { display_name: string } | null;
  reactions: ReactionRow[] | null;
};

const stickerForName = (name: string) =>
  name.trim()[0]?.toUpperCase() || "?";

export default async function PactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: pact } = await supabase
    .from("groups")
    .select(
      "id, name, invite_code, created_by, created_at, challenges(id, title, description, frequency, start_date, end_date, archived, created_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!pact) notFound();

  const challenge: Challenge | null =
    (pact.challenges as Challenge[] | null)?.find((c) => !c.archived) ?? null;

  const { data: userData } = await supabase.auth.getUser();
  const isCreator = userData.user?.id === pact.created_by;

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, joined_at, profiles(display_name, avatar_url)")
    .eq("group_id", id)
    .order("joined_at", { ascending: true })
    .returns<Member[]>();

  const { data: completions } = challenge
    ? await supabase
        .from("completions")
        .select(
          "id, completed_at, note, user_id, profiles(display_name), reactions(emoji, user_id)",
        )
        .eq("challenge_id", challenge.id)
        .order("completed_at", { ascending: false })
        .limit(30)
        .returns<CompletionRow[]>()
    : { data: [] as CompletionRow[] };

  // Find the user's most recent completion in the current period, if any.
  // That's the row a "today's note" / "this week's note" gets attached to.
  const myCurrentCompletion =
    challenge && userData.user
      ? (() => {
          const periodStart = startOfPeriodUTC(challenge.frequency);
          return (
            (completions ?? []).find(
              (c) =>
                c.user_id === userData.user!.id &&
                new Date(c.completed_at) >= periodStart,
            ) ?? null
          );
        })()
      : null;
  const periodLabel = challenge?.frequency === "weekly" ? "this week" : "today";

  const completionItems: CompletionItemData[] = (completions ?? []).map(
    (row) => ({
      id: row.id,
      userName: row.profiles?.display_name ?? "Unknown",
      completedAt: row.completed_at,
      note: row.note,
      reactions: summarizeReactions(row.reactions, userData.user?.id ?? null),
    }),
  );

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/join/${pact.invite_code}`;

  return (
    <main className="mx-auto w-full max-w-2xl pt-6 pb-28">
      <div className="px-5">
        <Link
          href="/pacts"
          className="press inline-flex min-h-10 items-center text-sm"
          style={{ color: "var(--ink-soft)" }}
        >
          ← your pacts
        </Link>
      </div>

      <section
        className="mx-5 mt-3 px-6 pt-8 pb-7 text-center"
        style={{
          background: "var(--accent2-soft)",
          borderRadius: "var(--radius-lg)",
          position: "relative",
        }}
      >
        <div
          className="-rotate-2 mx-auto mb-3 flex items-center justify-center"
          style={{
            width: 78,
            height: 78,
            borderRadius: 22,
            background: "var(--card)",
            color: "var(--accent)",
            fontFamily: "var(--font-display)",
            fontSize: 42,
            boxShadow: "0 4px 0 rgba(42,31,24,0.08)",
          }}
          aria-hidden
        >
          {stickerForName(pact.name)}
        </div>
        <h1 className="h-display m-0" style={{ fontSize: 32 }}>
          {pact.name}
        </h1>
        <Squiggle width={84} className="mx-auto" />
        {challenge && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="pill">{challenge.frequency}</span>
            <span className="label">
              since {new Date(challenge.start_date).toLocaleDateString()}
              {challenge.end_date &&
                ` · until ${new Date(challenge.end_date).toLocaleDateString()}`}
            </span>
          </div>
        )}
        {challenge?.description && (
          <p
            className="note mx-auto mt-4"
            style={{
              maxWidth: 360,
              paddingLeft: 12,
              borderLeft: "2px solid var(--accent)",
              textAlign: "left",
              fontSize: 16,
            }}
          >
            &ldquo;{challenge.description}&rdquo;
          </p>
        )}
        <div className="mt-4 flex items-center justify-center gap-2.5">
          {members && members.length > 0 && (
            <div className="avastack">
              {members.slice(0, 5).map((m) => (
                <Avatar
                  key={m.user_id}
                  name={m.profiles?.display_name ?? "?"}
                  size={28}
                />
              ))}
            </div>
          )}
          {members && members.length > 5 && (
            <span className="label">+{members.length - 5}</span>
          )}
        </div>
      </section>

      {error && (
        <div
          className="mx-5 mt-5 px-4 py-3 text-sm"
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

      {challenge && (
        <section className="px-5 pt-6">
          {myCurrentCompletion ? (
            <details className="group" open={!myCurrentCompletion.note}>
              <summary
                className="press flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  borderRadius: "var(--radius)",
                  padding: "0 18px",
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <svg
                    width="18"
                    height="18"
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
                  <span>
                    {myCurrentCompletion.note
                      ? `your note for ${periodLabel}`
                      : `add a note for ${periodLabel}`}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="transition-transform group-open:rotate-180"
                  style={{ color: "var(--accent)" }}
                >
                  ▾
                </span>
              </summary>
              <form
                action={saveCompletionNote}
                className="mt-3 flex flex-col gap-3 p-4"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                }}
              >
                <input type="hidden" name="pact_id" value={pact.id} />
                <input
                  type="hidden"
                  name="completion_id"
                  value={myCurrentCompletion.id}
                />
                <label className="block">
                  <span className="label">Note</span>
                  <textarea
                    name="note"
                    rows={3}
                    maxLength={500}
                    defaultValue={myCurrentCompletion.note ?? ""}
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
                  pendingLabel="saving…"
                  className="w-full"
                  style={primaryStyle}
                >
                  {myCurrentCompletion.note ? "update note" : "save note"}
                </SubmitButton>
              </form>
            </details>
          ) : (
            <form action={toggleQuickLogForm.bind(null, pact.id)}>
              <SubmitButton
                pendingLabel="marking…"
                className="w-full"
                style={{
                  minHeight: 64,
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: "var(--radius-lg)",
                  border: "none",
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  boxShadow: "0 8px 30px rgba(216, 98, 58, 0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
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
                <span>mark {periodLabel} done</span>
              </SubmitButton>
              <p
                className="mt-2 text-center text-xs"
                style={{ color: "var(--mute)", lineHeight: 1.4 }}
              >
                or tap the circle for this pact on{" "}
                <Link
                  href="/feed"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    color: "var(--ink-soft)",
                    textDecoration: "underline",
                    textDecorationColor: "var(--accent)",
                    textUnderlineOffset: 3,
                  }}
                >
                  feed
                </Link>
              </p>
            </form>
          )}
        </section>
      )}

      <section className="px-5 pt-6">
        <div className="label mb-2">
          completions
          {completionItems.length ? ` (${completionItems.length})` : ""}
        </div>
        <CompletionFeed
          items={completionItems}
          revalidatePath={`/pacts/${id}`}
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
            <span>invite friends</span>
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
            <p className="mb-3 text-xs" style={{ color: "var(--mute)" }}>
              anyone with this link can join the pact.
            </p>
            <InviteLink url={inviteUrl} code={pact.invite_code} />
          </div>
        </details>
      </section>

      <section className="px-5 pt-5">
        <div className="label mb-2">members ({members?.length ?? 0})</div>
        <ul
          className="overflow-hidden"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          {(members ?? []).map((m, i, arr) => (
            <li
              key={m.user_id}
              className="flex items-center gap-3 p-3"
              style={{
                borderBottom:
                  i < arr.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <Avatar name={m.profiles?.display_name ?? "?"} size={34} />
              <div className="flex-1 min-w-0">
                <div style={{ fontWeight: 500, fontSize: 15 }}>
                  {m.profiles?.display_name ?? "unknown"}
                  {m.user_id === pact.created_by && (
                    <span
                      className="ml-2"
                      style={{
                        fontFamily: "var(--font-stat-mono)",
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                      }}
                    >
                      creator
                    </span>
                  )}
                </div>
                <div className="label mt-0.5">
                  joined {new Date(m.joined_at).toLocaleDateString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {isCreator && challenge && (
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
              <span>edit pact</span>
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
              <form action={updatePact} className="mb-5 flex flex-col gap-3">
                <input type="hidden" name="pact_id" value={pact.id} />
                <label className="block">
                  <span className="label">Name</span>
                  <input
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    defaultValue={pact.name}
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
                  <legend className="label">How often</legend>
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
                <SubmitButton pendingLabel="saving…" style={primaryStyle}>
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
                  deleting this pact permanently removes all completions and
                  reactions. this can&apos;t be undone.
                </p>
                <ConfirmForm
                  action={deletePact}
                  message={`Delete "${pact.name}"? All completions and reactions in this pact will be permanently deleted. This cannot be undone.`}
                >
                  <input type="hidden" name="pact_id" value={pact.id} />
                  <SubmitButton pendingLabel="deleting…" style={dangerStyle}>
                    delete pact
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
