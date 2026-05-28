import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/confirm-form";
import { SubmitButton } from "@/components/submit-button";
import { Chevron } from "@/components/ui/chevron";
import { Squiggle } from "@/components/ui/squiggle";
import { deleteAccount } from "../profile-actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/you/settings");

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

      <header className="mt-4 mb-6">
        <h1 className="h-display m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>
          settings
        </h1>
        <Squiggle width={60} />
      </header>

      <section>
        <div className="label mb-2">danger zone</div>
        <div
          className="p-4"
          style={{
            borderRadius: "var(--radius)",
            border: "1px solid rgba(156, 31, 31, 0.25)",
            background: "rgba(216, 98, 58, 0.06)",
          }}
        >
          <p
            className="mb-3 text-sm"
            style={{ color: "#7A1F1F", lineHeight: 1.4 }}
          >
            deleting your account permanently removes your data —
            completions, notes, reactions, nudges, push subscriptions —
            across every pact. this cannot be undone.
          </p>
          <ConfirmForm
            action={deleteAccount}
            message="Delete your account? This permanently removes your data across every pact. This cannot be undone."
          >
            <SubmitButton
              pendingLabel="deleting…"
              style={{
                minHeight: 44,
                background: "var(--card)",
                color: "#9C1F1F",
                borderRadius: "var(--radius)",
                border: "1.5px solid rgba(156, 31, 31, 0.4)",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 14,
                padding: "0 18px",
              }}
            >
              delete account
            </SubmitButton>
          </ConfirmForm>
        </div>
      </section>
    </main>
  );
}
