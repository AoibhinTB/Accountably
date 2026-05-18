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
import { deleteGroup, updateGroup } from "../actions";
import { InviteLink } from "./invite-link";
import { createChallenge } from "./challenges/actions";

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
  frequency: "daily" | "weekly";
  start_date: string;
  end_date: string | null;
  created_at: string;
};

type ActivityRow = {
  id: string;
  completed_at: string;
  note: string | null;
  profiles: { display_name: string } | null;
  challenges: { id: string; title: string; group_id: string } | null;
  reactions: ReactionRow[] | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const stickerForName = (name: string) =>
  name.trim()[0]?.toUpperCase() || "?";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, invite_code, created_by, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!group) notFound();

  const { data: userData } = await supabase.auth.getUser();
  const isCreator = userData.user?.id === group.created_by;

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, joined_at, profiles(display_name, avatar_url)")
    .eq("group_id", id)
    .order("joined_at", { ascending: true })
    .returns<Member[]>();

  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, title, frequency, start_date, end_date, created_at")
    .eq("group_id", id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .returns<Challenge[]>();

  const { data: activity } = await supabase
    .from("completions")
    .select(
      "id, completed_at, note, profiles(display_name), challenges!inner(id, title, group_id), reactions(emoji, user_id)",
    )
    .eq("challenges.group_id", id)
    .order("completed_at", { ascending: false })
    .limit(10)
    .returns<ActivityRow[]>();

  const activityItems: CompletionItemData[] = (activity ?? []).map((row) => ({
    id: row.id,
    userName: row.profiles?.display_name ?? "Unknown",
    completedAt: row.completed_at,
    note: row.note,
    challengeName: row.challenges?.title,
    challengeHref: row.challenges
      ? `/groups/${id}/challenges/${row.challenges.id}`
      : undefined,
    reactions: summarizeReactions(row.reactions, userData.user?.id ?? null),
  }));

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/join/${group.invite_code}`;

  return (
    <main className="mx-auto w-full max-w-2xl pt-6 pb-28">
      <div className="px-5">
        <Link
          href="/groups"
          className="press inline-flex min-h-10 items-center text-sm"
          style={{ color: "var(--ink-soft)" }}
        >
          ← all groups
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
          {stickerForName(group.name)}
        </div>
        <h1 className="h-display m-0" style={{ fontSize: 32 }}>
          {group.name}
        </h1>
        <div
          className="mt-2"
          style={{ color: "var(--mute)", fontSize: 13 }}
        >
          started {new Date(group.created_at).toLocaleDateString()}
        </div>
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

      <section className="px-5 pt-7">
        <div className="label mb-2">the pact</div>
        {!challenges || challenges.length === 0 ? (
          <div
            className="px-6 py-6 text-center"
            style={{
              borderRadius: "var(--radius)",
              border: "1.5px dashed var(--line-strong)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              no challenges yet. start your first pact below.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {challenges.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/groups/${group.id}/challenges/${c.id}`}
                  className="press flex items-center justify-between gap-3"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: "var(--density-pad)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 22,
                        lineHeight: 1.1,
                        color: "var(--ink)",
                      }}
                    >
                      {c.title}
                    </div>
                    <div
                      className="mt-1"
                      style={{ color: "var(--mute)", fontSize: 13 }}
                    >
                      {c.frequency} · starts {new Date(c.start_date).toLocaleDateString()}
                      {c.end_date && ` · ends ${new Date(c.end_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <span style={{ color: "var(--mute)" }} aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-5 pt-5">
        <details className="group">
          <summary
            className="press flex min-h-14 cursor-pointer list-none items-center justify-center gap-2 [&::-webkit-details-marker]:hidden"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius)",
              padding: "0 22px",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            <span>new challenge</span>
            <span
              aria-hidden
              className="transition-transform group-open:rotate-180"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              ▾
            </span>
          </summary>
          <form
            action={createChallenge}
            className="mt-3 flex flex-col gap-3 p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <input type="hidden" name="group_id" value={group.id} />
            <label className="block">
              <span className="label">Title</span>
              <input
                name="title"
                type="text"
                required
                maxLength={120}
                placeholder="e.g. Meditate 10 minutes"
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
                placeholder="what does counting count?"
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
                {(["daily", "weekly"] as const).map((freq, i) => (
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
                      defaultChecked={i === 0}
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
                  defaultValue={today()}
                  className="mt-1.5 w-full outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="label">End date (optional)</span>
                <input
                  name="end_date"
                  type="date"
                  className="mt-1.5 w-full outline-none"
                  style={inputStyle}
                />
              </label>
            </div>
            <SubmitButton
              pendingLabel="creating…"
              className="w-full"
              style={primaryStyle}
            >
              start the pact
            </SubmitButton>
          </form>
        </details>
      </section>

      <section className="px-5 pt-7">
        <div className="label mb-2">recent activity</div>
        <CompletionFeed
          items={activityItems}
          revalidatePath={`/groups/${id}`}
          emptyMessage="no completions yet in this group."
        />
      </section>

      <section className="px-5 pt-5">
        <details className="group">
          <summary
            className="press flex min-h-12 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "0 var(--density-pad)",
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
            <p
              className="mb-3 text-xs"
              style={{ color: "var(--mute)" }}
            >
              anyone with this link can join the group.
            </p>
            <InviteLink url={inviteUrl} code={group.invite_code} />
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
                borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <Avatar name={m.profiles?.display_name ?? "?"} size={34} />
              <div className="flex-1 min-w-0">
                <div style={{ fontWeight: 500, fontSize: 15 }}>
                  {m.profiles?.display_name ?? "unknown"}
                  {m.user_id === group.created_by && (
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
              <span>edit group</span>
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
              <form action={updateGroup} className="mb-5 flex flex-col gap-3">
                <input type="hidden" name="group_id" value={group.id} />
                <label className="block">
                  <span className="label">Group name</span>
                  <input
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    defaultValue={group.name}
                    className="mt-1.5 w-full outline-none"
                    style={inputStyle}
                  />
                </label>
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
                  deleting this group permanently removes all of its challenges
                  and completions. this can&apos;t be undone.
                </p>
                <ConfirmForm
                  action={deleteGroup}
                  message={`Delete "${group.name}"? All challenges and completions in this group will be permanently deleted. This cannot be undone.`}
                >
                  <input type="hidden" name="group_id" value={group.id} />
                  <SubmitButton
                    pendingLabel="deleting…"
                    style={dangerStyle}
                  >
                    delete group
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
