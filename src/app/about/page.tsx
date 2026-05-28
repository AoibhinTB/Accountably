import Link from "next/link";
import { Chevron } from "@/components/ui/chevron";
import { Squiggle } from "@/components/ui/squiggle";

const COMMIT_SHA =
  process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? "dev";

const h2Style: React.CSSProperties = {
  fontSize: 22,
  lineHeight: 1.1,
  fontStyle: "italic",
};

export default function AboutPage() {
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
          about <span style={{ fontStyle: "italic" }}>accountably</span>
        </h1>
        <Squiggle width={90} />
      </header>

      <div style={{ color: "var(--ink)", fontSize: 16, lineHeight: 1.5 }}>
        <p>
          a small habit app for groups. you start a pact with friends, agree on
          a rhythm, and check in together. notes, nudges, and a shared metric
          per pact keep it social without turning into a leaderboard.
        </p>

        <p className="mt-4">
          runs on next.js and supabase. push notifications via web push and a
          tiny external cron. no analytics, no ad tracking, no third-party
          embeds in the app.
        </p>

        <h2 className="h-display mt-8" style={h2Style}>
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

        <h2 className="h-display mt-6" style={h2Style}>
          where it lives
        </h2>
        <p className="mt-2">
          a single postgres database on supabase in their eu-west-1 region.
          row-level security policies scope every read so a user can only see
          their own data plus data shared inside a pact they belong to.
        </p>

        <h2 className="h-display mt-6" style={h2Style}>
          who can see what
        </h2>
        <p className="mt-2">
          members of a pact see each other&apos;s check-ins, notes, metric
          values, reactions, and nudges within that pact. nothing crosses
          pacts. account-level settings (email, push prefs, reminder times) are
          only visible to you.
        </p>

        <h2 className="h-display mt-6" style={h2Style}>
          third parties
        </h2>
        <p className="mt-2">
          push notifications go through the push service your browser or os
          chose (apple, google, mozilla). a small cron service
          (cron-job.org) calls the app on an interval to trigger reminder
          checks; it sees no user data, only a shared secret. hosting is
          vercel.
        </p>

        <h2 className="h-display mt-6" style={h2Style}>
          deleting your account
        </h2>
        <p className="mt-2">
          on the{" "}
          <Link href="/you/settings" style={{ textDecoration: "underline" }}>
            settings
          </Link>{" "}
          page, tap delete account. this removes your auth account and
          cascades through every row associated with you in the database —
          completions, notes, reactions, nudges, memberships, push
          subscriptions.
        </p>
      </div>

      <div
        className="label mt-12"
        style={{ fontSize: 10, color: "var(--mute)" }}
      >
        build · {COMMIT_SHA}
      </div>
    </main>
  );
}
