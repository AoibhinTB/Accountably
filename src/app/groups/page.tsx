import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createGroup, joinGroupByCode } from "./actions";

type Membership = {
  joined_at: string;
  groups: {
    id: string;
    name: string;
    created_at: string;
  } | null;
};

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("joined_at, groups(id, name, created_at)")
    .order("joined_at", { ascending: false })
    .returns<Membership[]>();

  const groups = (memberships ?? []).flatMap((m) => (m.groups ? [m.groups] : []));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your groups</h1>
          <p className="text-sm text-zinc-600">Pacts you&apos;ve made with friends.</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
            Sign out
          </button>
        </form>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mb-8">
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center">
            <p className="text-sm text-zinc-600">
              You&apos;re not in any groups yet. Create one or join with an invite code below.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50"
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(g.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <form action={createGroup} className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <h2 className="text-sm font-semibold">Create a group</h2>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">Group name</span>
            <input
              name="name"
              type="text"
              required
              maxLength={80}
              placeholder="e.g. Morning Run Crew"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Create
          </button>
        </form>

        <form action={joinGroupByCode} className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <h2 className="text-sm font-semibold">Join with invite code</h2>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">Invite code</span>
            <input
              name="code"
              type="text"
              required
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <button className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50">
            Join
          </button>
        </form>
      </div>
    </main>
  );
}
