import Link from "next/link";
import { Chevron } from "@/components/ui/chevron";
import { Squiggle } from "@/components/ui/squiggle";

export default function PrivacyPage() {
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

      <header className="mt-4 mb-4">
        <h1 className="h-display m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>
          privacy
        </h1>
        <Squiggle width={70} />
      </header>

      <div
        style={{
          color: "var(--ink)",
          fontSize: 15,
          lineHeight: 1.5,
        }}
      >
        <p>
          plain english — no dark patterns. last updated 2026-05-28.
        </p>

        <h2
          className="h-display mt-6"
          style={{ fontSize: 22, lineHeight: 1.1, fontStyle: "italic" }}
        >
          what we store
        </h2>
        <ul className="mt-2 list-disc pl-5">
          <li>your email and display name</li>
          <li>your check-ins, notes, and any metric values you log</li>
          <li>reactions to other members&apos; notes</li>
          <li>nudges you send and receive within your pacts</li>
          <li>web push subscription details, if you opt in</li>
          <li>per-pact reminder time and timezone, if you set one</li>
        </ul>

        <h2
          className="h-display mt-6"
          style={{ fontSize: 22, lineHeight: 1.1, fontStyle: "italic" }}
        >
          where it lives
        </h2>
        <p className="mt-2">
          a single postgres database on supabase in their eu-west-1 region.
          row-level security policies scope every read so a user can only see
          their own data plus data shared inside a pact they belong to.
        </p>

        <h2
          className="h-display mt-6"
          style={{ fontSize: 22, lineHeight: 1.1, fontStyle: "italic" }}
        >
          who can see what
        </h2>
        <p className="mt-2">
          members of a pact see each other&apos;s check-ins, notes, metric
          values, reactions, and nudges within that pact. nothing crosses
          pacts. account-level settings (email, push prefs, reminder times)
          are only visible to you.
        </p>

        <h2
          className="h-display mt-6"
          style={{ fontSize: 22, lineHeight: 1.1, fontStyle: "italic" }}
        >
          third parties
        </h2>
        <p className="mt-2">
          push notifications go through the push service your browser/os
          chose (apple, google, mozilla). a small cron service
          (cron-job.org) calls the app once an interval to trigger reminder
          checks; it sees no user data, only a shared secret. hosting is
          vercel. no analytics, no ad networks, no third-party scripts
          loaded in-app.
        </p>

        <h2
          className="h-display mt-6"
          style={{ fontSize: 22, lineHeight: 1.1, fontStyle: "italic" }}
        >
          deleting your account
        </h2>
        <p className="mt-2">
          on the <Link href="/you" style={{ textDecoration: "underline" }}>you</Link>{" "}
          page, tap delete account. this removes your auth account and
          cascades through every row associated with you in the database —
          completions, notes, reactions, nudges, memberships, push
          subscriptions. data shared inside pacts you authored (notes,
          metric values) is removed; reactions you left on others&apos;
          notes are removed too.
        </p>

        <h2
          className="h-display mt-6"
          style={{ fontSize: 22, lineHeight: 1.1, fontStyle: "italic" }}
        >
          contact
        </h2>
        <p className="mt-2">
          questions, requests for data export, anything else:{" "}
          <a
            href="mailto:davidsh@tcd.ie"
            style={{
              color: "var(--ink)",
              textDecoration: "underline",
              textDecorationColor: "var(--accent)",
              textDecorationThickness: 1.5,
              textUnderlineOffset: 3,
            }}
          >
            davidsh@tcd.ie
          </a>
          .
        </p>
      </div>
    </main>
  );
}
