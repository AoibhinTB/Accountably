import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteLink } from "./invite-link";

type Member = {
  user_id: string;
  joined_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, invite_code, created_by, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, joined_at, profiles(display_name, avatar_url)")
    .eq("group_id", id)
    .order("joined_at", { ascending: true })
    .returns<Member[]>();

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

      <section className="mb-8 rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Invite friends</h2>
        <p className="mb-3 text-xs text-zinc-600">
          Anyone with this link can join the group.
        </p>
        <InviteLink url={inviteUrl} code={group.invite_code} />
      </section>

      <section>
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
    </main>
  );
}
