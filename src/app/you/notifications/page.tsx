import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsToggle } from "@/components/notifications-toggle";
import { Chevron } from "@/components/ui/chevron";
import { PrefsForm } from "./prefs-form";

type Prefs = {
  notif_nudges: boolean | null;
  notif_checkins: boolean | null;
  reminders_enabled: boolean | null;
};

export default async function NotificationsPrefsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/you/notifications");

  const { data: prefs } = await supabase
    .from("profiles")
    .select("notif_nudges, notif_checkins, reminders_enabled")
    .eq("id", user.id)
    .maybeSingle<Prefs>();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <Link
        href="/you"
        className="press inline-flex min-h-10 items-center gap-1.5 text-sm"
        style={{ color: "var(--ink-soft)" }}
      >
        <Chevron direction="left" size={14} strokeWidth={2} />
        <span>you</span>
      </Link>

      <h1
        className="h-display m-0 mt-4 mb-2"
        style={{ fontSize: 36, lineHeight: 1.05 }}
      >
        notifications
      </h1>

      <p
        className="label mb-4"
        style={{ fontSize: 11, color: "var(--ink-soft)" }}
      >
        master switch first; per-type prefs below take effect once push is on.
      </p>

      <section className="mb-5">
        <ul
          className="overflow-hidden"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <NotificationsToggle />
        </ul>
      </section>

      <PrefsForm
        initial={{
          notif_nudges: prefs?.notif_nudges ?? true,
          notif_checkins: prefs?.notif_checkins ?? true,
          reminders_enabled: prefs?.reminders_enabled ?? true,
        }}
      />
    </main>
  );
}
