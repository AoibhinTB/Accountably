import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";

export default async function YouPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/you");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">You</h1>
      </header>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs font-medium text-zinc-500">Display name</dt>
            <dd className="mt-0.5 text-base">
              {profile?.display_name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Email</dt>
            <dd className="mt-0.5 text-base break-all">{user.email}</dd>
          </div>
        </dl>
      </section>

      <form action="/auth/signout" method="post">
        <SubmitButton
          pendingLabel="Signing out…"
          className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-base font-medium hover:bg-zinc-50"
        >
          Sign out
        </SubmitButton>
      </form>
    </main>
  );
}
