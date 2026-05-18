import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Squiggle } from "@/components/ui/squiggle";
import { Avatar } from "@/components/ui/avatar";

export default async function YouPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/you");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: "long",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="flex flex-col items-center pt-2 text-center">
        <Avatar name={profile?.display_name ?? "?"} size={96} ring />
        <h1
          className="h-display m-0"
          style={{ fontSize: 36, marginTop: 14, lineHeight: 1 }}
        >
          {profile?.display_name ?? "you"}
        </h1>
        <Squiggle width={70} />
        <div
          className="mt-2"
          style={{ color: "var(--mute)", fontSize: 14 }}
        >
          {user.email}
          {joined && <> · joined {joined}</>}
        </div>
      </header>

      <form action="/auth/signout" method="post" className="mt-10">
        <SubmitButton
          pendingLabel="signing out…"
          className="w-full"
          style={{
            minHeight: 52,
            background: "transparent",
            color: "var(--mute)",
            borderRadius: "var(--radius)",
            border: "1.5px dashed var(--line-strong)",
            fontFamily: "var(--font-stat-mono)",
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          sign out
        </SubmitButton>
      </form>
    </main>
  );
}
