import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
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
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Your groups</h1>
        <p className="text-sm text-zinc-600">Pacts you&apos;ve made with friends.</p>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mb-6">
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center">
            <p className="text-sm text-zinc-600">
              You&apos;re not in any groups yet. Create one or join with an invite code below.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex min-h-14 items-center justify-between px-4 py-3 active:bg-zinc-100"
                >
                  <span className="text-base font-medium">{g.name}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(g.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-4">
        <details className="group rounded-lg border border-zinc-200 bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span>Create a group</span>
            <span className="text-zinc-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <form action={createGroup} className="space-y-3 border-t border-zinc-200 p-4">
            <label className="block">
              <span className="text-xs font-medium text-zinc-700">Group name</span>
              <input
                name="name"
                type="text"
                required
                maxLength={80}
                placeholder="e.g. Morning Run Crew"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base"
              />
            </label>
            <SubmitButton
              pendingLabel="Creating…"
              className="min-h-11 w-full rounded-md bg-black px-4 py-3 text-base font-medium text-white"
            >
              Create
            </SubmitButton>
          </form>
        </details>

        <details className="group rounded-lg border border-zinc-200 bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span>Join with invite code</span>
            <span className="text-zinc-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <form action={joinGroupByCode} className="space-y-3 border-t border-zinc-200 p-4">
            <label className="block">
              <span className="text-xs font-medium text-zinc-700">Invite code</span>
              <input
                name="code"
                type="text"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 font-mono text-base"
              />
            </label>
            <SubmitButton
              pendingLabel="Joining…"
              className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-base font-medium"
            >
              Join
            </SubmitButton>
          </form>
        </details>
      </div>
    </main>
  );
}
