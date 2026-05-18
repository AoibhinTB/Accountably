import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/confirm-form";
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

const today = () => new Date().toISOString().slice(0, 10);

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

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/join/${group.invite_code}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/groups" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← All groups
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-zinc-600">
          Created {new Date(group.created_at).toLocaleDateString()}
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">
          Challenges{challenges ? ` (${challenges.length})` : ""}
        </h2>
        {!challenges || challenges.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-6 text-center">
            <p className="text-sm text-zinc-600">
              No challenges yet. Start your first pact below.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
            {challenges.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/groups/${group.id}/challenges/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50"
                >
                  <div>
                    <div className="font-medium">{c.title}</div>
                    <div className="text-xs text-zinc-500">
                      {c.frequency} · starts {new Date(c.start_date).toLocaleDateString()}
                      {c.end_date && ` · ends ${new Date(c.end_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <span className="text-zinc-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <form
          action={createChallenge}
          className="space-y-3 rounded-lg border border-zinc-200 p-4"
        >
          <h2 className="text-sm font-semibold">New challenge</h2>
          <input type="hidden" name="group_id" value={group.id} />

          <label className="block">
            <span className="text-xs font-medium text-zinc-700">Title</span>
            <input
              name="title"
              type="text"
              required
              maxLength={120}
              placeholder="e.g. Meditate 10 minutes"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-700">Description (optional)</span>
            <textarea
              name="description"
              rows={2}
              maxLength={500}
              placeholder="What does counting count?"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <fieldset>
            <legend className="text-xs font-medium text-zinc-700">Frequency</legend>
            <div className="mt-1 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="frequency" value="daily" defaultChecked />
                Daily
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="frequency" value="weekly" />
                Weekly
              </label>
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-zinc-700">Start date</span>
              <input
                name="start_date"
                type="date"
                defaultValue={today()}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-700">End date (optional)</span>
              <input
                name="end_date"
                type="date"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Create challenge
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Invite friends</h2>
        <p className="mb-3 text-xs text-zinc-600">
          Anyone with this link can join the group.
        </p>
        <InviteLink url={inviteUrl} code={group.invite_code} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">
          Members{members ? ` (${members.length})` : ""}
        </h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">
                {m.profiles?.display_name ?? "Unknown"}
                {m.user_id === group.created_by && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                    creator
                  </span>
                )}
              </span>
              <span className="text-xs text-zinc-500">
                joined {new Date(m.joined_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isCreator && (
        <section className="rounded-lg border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-semibold">Manage group</h2>

          <form action={updateGroup} className="mb-6 space-y-3">
            <input type="hidden" name="group_id" value={group.id} />
            <label className="block">
              <span className="text-xs font-medium text-zinc-700">Group name</span>
              <input
                name="name"
                type="text"
                required
                maxLength={80}
                defaultValue={group.name}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Save changes
            </button>
          </form>

          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="mb-3 text-xs text-red-800">
              Deleting this group will permanently remove all of its challenges
              and completions. This cannot be undone.
            </p>
            <ConfirmForm
              action={deleteGroup}
              message={`Delete "${group.name}"? All challenges and completions in this group will be permanently deleted. This cannot be undone.`}
            >
              <input type="hidden" name="group_id" value={group.id} />
              <button className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                Delete group
              </button>
            </ConfirmForm>
          </div>
        </section>
      )}
    </main>
  );
}
